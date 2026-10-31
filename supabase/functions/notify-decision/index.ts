// notify-decision — emails an applicant the outcome of an ID verification.
//
// Called by the admin UI after a manual approve / reject / needs_clarity
// decision (auto decisions are emailed directly by verify-id). Requires an
// authenticated admin caller; reads the stored decision — the client cannot
// supply a fake reason.
//
// Deploy: supabase functions deploy notify-decision
// Secrets: RESEND_API_KEY, EMAIL_FROM — without them sendEmail no-ops.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, decisionEmail } from '../_shared/email.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Map DB status → email kind + subject line.
const EMAIL_KIND: Record<string, { kind: 'approved' | 'rejected' | 'correction_required'; subject: string }> = {
  approved: { kind: 'approved', subject: 'Account approved — Kalubihan Emergency Command' },
  rejected: { kind: 'rejected', subject: 'Registration not approved — Kalubihan Emergency Command' },
  needs_clarity: { kind: 'correction_required', subject: 'Clearer ID needed — Kalubihan Emergency Command' },
  correction_required: { kind: 'correction_required', subject: 'ID correction required — Kalubihan Emergency Command' },
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Admin-only: only staff may trigger decision emails.
    const { data: me } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (me?.role !== 'admin') return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => null);
    const verificationId = body?.verification_id;
    if (!verificationId) return json({ error: 'verification_id required' }, 400);

    const { data: v, error } = await admin
      .from('id_verifications')
      .select('verification_status, review_notes, decision_reason, user_profiles!id_verifications_user_id_fkey(email)')
      .eq('id', verificationId)
      .single();
    if (error || !v) return json({ error: 'not_found' }, 404);

    const kind = EMAIL_KIND[v.verification_status];
    if (!kind) return json({ skipped: true, reason: `no email for status ${v.verification_status}` });

    const email = (v as any).user_profiles?.email;
    if (!email) return json({ skipped: true, reason: 'no recipient email' });

    const reason =
      v.review_notes ||
      v.decision_reason ||
      (v.verification_status === 'approved'
        ? 'Your ID was verified against your registration details.'
        : 'Your submission did not meet the verification requirements.');

    const result = await sendEmail(email, kind.subject, decisionEmail(kind.kind, reason));
    return json(result);
  } catch (e) {
    console.error('notify-decision unhandled error:', e);
    return json({ error: 'internal_error' }, 500);
  }
});
