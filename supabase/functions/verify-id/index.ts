// verify-id — server-controlled ID OCR + conservative comparison.
//
// Deploy: supabase functions deploy verify-id
// Secrets: GOOGLE_VISION_API_KEY (optional — without it the function returns
//          ocr_unavailable and the client falls back to manual review).
//
// Guarantees:
//   * OCR runs HERE with server-held credentials — the browser's OCR output,
//     confidence, and match flags are never read or trusted.
//   * Extracted fields are produced from raw OCR text only; declared values
//     are never copied into extraction results.
//   * Outcomes: 'pending_admin', 'correction_required', 'auto_approved',
//     'auto_rejected'. Auto-approval fires ONLY on server OCR: confidence
//     >= 90% AND every field verified as a real match (declared-value
//     fallbacks don't count). Confidence < 30% means the image is
//     unreadable → auto-rejected with a resubmission email. Anything in
//     between stays pending for a human.
//   * Decision emails go through _shared/email.ts (Resend); they no-op
//     until RESEND_API_KEY is set.
//   * The ID image goes to the private 'id-documents' bucket at an
//     unpredictable path; nothing lands in auth metadata or logs.
//   * Rate-limited per user (default 5 submissions/hour).
//
// Prompt-injection note: OCR text is treated strictly as document content —
// it is parsed by deterministic label/regex rules and never fed to an LLM.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  compareNames, compareBirthdates, compareAddressJurisdiction,
  decideVerification, normalizeText,
  OUTCOME_PENDING, OUTCOME_CORRECTION,
} from '../_shared/verificationRules.ts';
import { sendEmail, decisionEmail } from '../_shared/email.ts';

const RATE_LIMIT_PER_HOUR = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// Auto-approve only when server OCR is this confident AND all fields match.
const AUTO_APPROVE_CONFIDENCE = 90;
// Below this confidence the document is unreadable — auto-reject, the
// applicant is emailed to resubmit a clearer image.
const AUTO_REJECT_CONFIDENCE = 30;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// ---------------------------------------------------------------------------
// Image validation — magic bytes, not the declared mime type
// ---------------------------------------------------------------------------
const sniffImage = (bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | null => {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
  return null;
};

// ---------------------------------------------------------------------------
// OCR provider — Google Cloud Vision DOCUMENT_TEXT_DETECTION.
// Swap in Textract/Azure by replacing runOcr; the contract is { text, confidence }.
// ---------------------------------------------------------------------------
// Free-tier provider (25k req/month, no card): https://ocr.space/ocrapi
// Caveat: OCR.space returns no per-document confidence, so a fixed mid-band
// score is used — real field mismatches still reach correction_required, but
// auto-approve (<90% never reached) is disabled on this provider and every
// submission lands in manual review. Set GOOGLE billing later to restore
// true confidence and auto-decisions.
const runOcrSpace = async (
  imageBytes: Uint8Array,
  apiKey: string,
  format: 'jpeg' | 'png' | 'webp',
): Promise<{ text: string; confidence: number }> => {
  const ext = format === 'jpeg' ? 'jpg' : format;
  const form = new FormData();
  form.append('file', new Blob([imageBytes as unknown as BlobPart]), `id-image.${ext}`);
  form.append('filetype', ext.toUpperCase());
  form.append('language', 'eng');
  form.append('isOverlayRequired', 'false');
  form.append('scale', 'true');
  form.append('OCREngine', '2');
  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { apikey: apiKey },
    body: form,
  });
  if (!res.ok) throw new Error(`OCR provider error ${res.status}`);
  const data = await res.json();
  if (data?.IsErroredOnProcessing) {
    throw new Error(`OCR provider error: ${(data?.ErrorMessage ?? []).join('; ') || 'processing_failed'}`);
  }
  const text: string = (data?.ParsedResults ?? [])
    .map((r: { ParsedText?: string }) => r?.ParsedText ?? '')
    .join('\n');
  return { text, confidence: text.trim() ? 70 : 0 };
};

const runOcr = async (
  imageBytes: Uint8Array,
  format: 'jpeg' | 'png' | 'webp',
): Promise<{ text: string; confidence: number } | null> => {
  const ocrSpaceKey = Deno.env.get('OCR_SPACE_API_KEY');
  if (ocrSpaceKey) return runOcrSpace(imageBytes, ocrSpaceKey, format);

  const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
  if (!apiKey) return null; // provider not configured → caller falls back to manual review

  const base64 = btoa(String.fromCharCode(...imageBytes));
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      }],
    }),
  });
  if (!res.ok) throw new Error(`OCR provider error ${res.status}`);
  const data = await res.json();
  const annotation = data?.responses?.[0];
  const text: string = annotation?.fullTextAnnotation?.text ?? '';
  // Vision returns per-page confidence in fullTextAnnotation.pages[].confidence
  const confidence = Math.round((annotation?.fullTextAnnotation?.pages?.[0]?.confidence ?? 0) * 100);
  return { text, confidence };
};

// ---------------------------------------------------------------------------
// Field extraction from raw OCR text. Label-first heuristics for common PH ID
// layouts; conservative — a field we can't isolate stays null (pending path),
// it is never filled from the declared registration value.
// ---------------------------------------------------------------------------
const extractFields = (rawText: string) => {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const joined = lines.join(' ');

  const pick = (patterns: RegExp[]): string | null => {
    for (const re of patterns) {
      const m = joined.match(re);
      if (m?.[1]?.trim()) return m[1].trim();
    }
    return null;
  };

  const fullName = pick([
    /(?:last\s*name|surname|family\s*name|name|pangalan)[:\s]*([^\n;|]{3,60}?)(?=\s*(?:first|middle|date|birth|address|sex|nationality|$))/i,
    /\bname[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/,
  ]);

  const birthdate = pick([
    /(?:date\s*of\s*birth|birth\s*date|birthday|born|kapanganakan)[:\s]*([^\n;|]{6,30}?)(?=\s*(?:place|address|sex|nationality|age|$))/i,
    /\b(\d{4}-\d{2}-\d{2})\b/,
    /\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})\b/,
  ]);

  const address = pick([
    /(?:address|tirahan|residence)[:\s]*([^\n;|]{8,120}?)(?=\s*(?:date|birth|sex|nationality|issue|expiry|valid|signature|$))/i,
    /\b((?:brgy|barangay|purok|sitio|blk|block)\s+[^\n;|]{4,90})/i,
  ]);

  return { fullName, birthdate, address, rawLineCount: lines.length };
};

// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // --- authenticate the caller with THEIR token -------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // --- rate limit: max N verification submissions per user per hour -----
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin
      .from('id_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since);
    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return json({ error: 'rate_limited', message: 'Too many submissions. Try again later.' }, 429);
    }

    const body = await req.json().catch(() => null);
    const declared = body?.declared ?? {};
    const imageBase64: string | undefined = body?.image_base64;
    if (!imageBase64) return json({ error: 'image_base64 required' }, 400);

    const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    if (imageBytes.length > MAX_IMAGE_BYTES) {
      return json({ error: 'image_too_large', max_bytes: MAX_IMAGE_BYTES }, 413);
    }
    const format = sniffImage(imageBytes);
    if (!format) return json({ error: 'invalid_image', message: 'File is not a valid JPEG/PNG/WebP image.' }, 415);

    // --- store the document privately at an unpredictable path ------------
    const objectPath = `${user.id}/${crypto.randomUUID()}.${format === 'jpeg' ? 'jpg' : format}`;
    const { error: uploadError } = await admin.storage
      .from('id-documents')
      .upload(objectPath, imageBytes, { contentType: `image/${format}`, upsert: false });
    if (uploadError) {
      // Storage not configured → still allow manual-review submission.
      console.error('id-document upload failed:', uploadError.message);
    }

    // --- OCR (provider optional) ------------------------------------------
    let ocr: { text: string; confidence: number } | null = null;
    let ocrError: string | null = null;
    try {
      ocr = await runOcr(imageBytes, format);
    } catch (e) {
      ocrError = e instanceof Error ? e.message : 'ocr_failed';
    }

    if (!ocr || !ocr.text.trim()) {
      // OCR unavailable or read nothing → manual review path, document kept.
      const { data: row, error } = await admin
        .from('id_verifications')
        .insert({
          user_id: user.id,
          id_document_url: objectPath,
          document_storage_path: objectPath,
          verification_status: 'pending',
          ocr_data: { ocr_unavailable: true, error: ocrError },
          ocr_confidence: null,
        })
        .select('id')
        .single();
      if (error) return json({ error: 'insert_failed', message: error.message }, 500);

      if (user.email) {
        await sendEmail(user.email, 'ID under review — Kalubihan Emergency Command', decisionEmail('pending', 'Your ID was received and is queued for manual verification.'));
      }
      return json({ outcome: OUTCOME_PENDING, verification_id: row?.id, ocr_unavailable: true });
    }

    // --- extract + compare (server-trusted values only) -------------------
    const extracted = extractFields(ocr.text);
    const nameCmp = compareNames(declared.fullName ?? '', extracted.fullName);
    const dobCmp = compareBirthdates(declared.birthdate ?? '', extracted.birthdate);
    const addrCmp = compareAddressJurisdiction(extracted.address ?? declared.address ?? '');
    const decision = decideVerification({
      name: nameCmp,
      birthdate: dobCmp,
      address: addrCmp,
      ocrConfidence: ocr.confidence,
    });

    // --- auto-reject: document too unreadable for any comparison ----------
    const rejectReason =
      `Your ID photo could not be read automatically (scan quality ${ocr.confidence}%). ` +
      'Please submit a clearer, well-lit image of a valid ID.';
    if (ocr.confidence < AUTO_REJECT_CONFIDENCE) {
      const { data: row, error } = await admin
        .from('id_verifications')
        .insert({
          user_id: user.id,
          id_document_url: objectPath,
          document_storage_path: objectPath,
          verification_status: 'rejected',
          decision_reason: `Auto-rejected: OCR confidence ${ocr.confidence}% below ${AUTO_REJECT_CONFIDENCE}%.`,
          ocr_data: {
            extracted_name: extracted.fullName,
            extracted_birthdate: extracted.birthdate,
            extracted_address: extracted.address,
            outcome: 'auto_rejected',
            notes: decision.notes,
            policy_version: 'verify-1.1',
          },
          ocr_confidence: ocr.confidence,
        })
        .select('id')
        .single();
      if (error) return json({ error: 'insert_failed', message: error.message }, 500);

      if (user.email) {
        await sendEmail(user.email, 'Registration not approved — ID unreadable', decisionEmail('rejected', rejectReason));
      }
      return json({ outcome: 'auto_rejected', verification_id: row?.id, reasons: [rejectReason] });
    }

    // --- auto-approve: high-confidence server OCR + every field matched ---
    // extracted.address must be non-null — without it the jurisdiction check
    // silently falls back to the applicant's own declared address.
    const allFieldsMatch =
      nameCmp.status === 'match' &&
      dobCmp.status === 'match' &&
      addrCmp.status === 'match' &&
      !!extracted.address;

    if (allFieldsMatch && ocr.confidence >= AUTO_APPROVE_CONFIDENCE) {
      const { data: row, error } = await admin
        .from('id_verifications')
        .insert({
          user_id: user.id,
          id_document_url: objectPath,
          document_storage_path: objectPath,
          verification_status: 'approved',
          decision_reason: `Auto-approved: OCR confidence ${ocr.confidence}% and all fields matched.`,
          ocr_data: {
            extracted_name: extracted.fullName,
            extracted_birthdate: extracted.birthdate,
            extracted_address: extracted.address,
            outcome: 'auto_approved',
            notes: decision.notes,
            policy_version: 'verify-1.1',
          },
          ocr_confidence: ocr.confidence,
        })
        .select('id')
        .single();
      if (error) return json({ error: 'insert_failed', message: error.message }, 500);

      await admin
        .from('user_profiles')
        .update({ status: 'active', account_status: 'active' })
        .eq('id', user.id);

      // Close out any earlier open submissions for this user.
      await admin
        .from('id_verifications')
        .update({ verification_status: 'superseded' })
        .eq('user_id', user.id)
        .eq('verification_status', 'pending')
        .neq('id', row?.id ?? '');

      if (user.email) {
        await sendEmail(user.email, 'Account approved — Kalubihan Emergency Command', decisionEmail('approved', 'Your ID was verified against your registration details.'));
      }
      return json({ outcome: 'auto_approved', verification_id: row?.id });
    }

    // Persist only extracted fields + decision notes — never raw OCR text.
    const { data: row, error } = await admin
      .from('id_verifications')
      .insert({
        user_id: user.id,
        id_document_url: objectPath,
        document_storage_path: objectPath,
        verification_status: decision.outcome === OUTCOME_CORRECTION ? 'correction_required' : 'pending',
        decision_reason: decision.reasons.join(' ') || null,
        ocr_data: {
          extracted_name: extracted.fullName,
          extracted_birthdate: extracted.birthdate,
          extracted_address: extracted.address,
          outcome: decision.outcome,
          notes: decision.notes,
          policy_version: 'verify-1.0',
        },
        ocr_confidence: ocr.confidence,
      })
      .select('id')
      .single();
    if (error) return json({ error: 'insert_failed', message: error.message }, 500);

    if (decision.outcome === OUTCOME_CORRECTION && user.email) {
      await sendEmail(
        user.email,
        'ID correction required — Kalubihan Emergency Command',
        decisionEmail('correction_required', decision.reasons.join(' ')),
      );
    } else if (decision.outcome === OUTCOME_PENDING && user.email) {
      await sendEmail(
        user.email,
        'ID under review — Kalubihan Emergency Command',
        decisionEmail('pending', 'Your ID was received and is queued for manual verification.'),
      );
    }

    return json({
      outcome: decision.outcome,
      verification_id: row?.id,
      // Reasons are applicant-facing; internal confidence is withheld.
      reasons: decision.reasons,
      notes: decision.outcome === OUTCOME_CORRECTION ? [] : decision.notes,
    });
  } catch (e) {
    console.error('verify-id unhandled error:', e);
    return json({ error: 'internal_error' }, 500);
  }
});
