import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

/**
 * Deletes emergency_reports whose content matches `content` exactly.
 * Reports are only deletable by their reporter (residents_manage_own_reports),
 * so this signs in as dispatcher — the account the E2E tests submit reports with.
 */
// 1×1 PNG for photo-evidence fields (report composer requires ≥1 photo for
// residents post-F-03; attaching one is harmless for staff too).
export const EVIDENCE_PNG = {
  name: 'evidence.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
};

/**
 * Submit a report via the dashboard 'new' composer (/emergency-report).
 * The form requires Incident location + What is happening? (submitIncident
 * silently returns without them); residents also need ≥1 photo (F-03).
 */
export async function submitIncident(page, { location, description }) {
  if (location) await page.getByLabel('Incident location').fill(location);
  await page.getByLabel('What is happening?').fill(description);
  await page.locator('input[type="file"]').setInputFiles(EVIDENCE_PNG);
  // Button is disabled until profile.id loads — clicking early is a no-op.
  const submit = page.getByRole('button', { name: 'Submit report' });
  await submit.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(
    el => el && !el.disabled,
    await submit.elementHandle(),
    { timeout: 30000 }
  );
  await submit.click();
  await page.getByRole('heading', { name: 'Report submitted' }).waitFor({ timeout: 30000 });
}

export async function deleteReportsByContent(
  content,
  email = 'dispatcher@emergency.gov',
  password = 'dispatcher123'
) {
  const sb = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );
  const user = await signInWithRetry(sb, email, password);
  const { error } = await sb
    .from('emergency_reports')
    .delete()
    .eq('content', content)
    .eq('reporter_id', user.id);
  await sb.auth.signOut();
  if (error) console.warn(`cleanup: could not delete "${content}": ${error.message}`);
}

/**
 * Deletes departments whose name matches `name` exactly.
 * Uses the admin account (admin_manage_departments is FOR ALL).
 * FK references use ON DELETE SET NULL, so members are unassigned cleanly.
 */
export async function deleteDepartmentsByName(name) {
  const sb = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );
  await sb.auth.signInWithPassword({
    email: 'admin@emergency.gov',
    password: 'admin123',
  });
  const { error } = await sb.from('departments').delete().eq('name', name);
  await sb.auth.signOut();
  if (error) console.warn(`cleanup: could not delete dept "${name}": ${error.message}`);
}

export function client() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );
}

/**
 * Assigns a responder (and their department) to the newest report matching
 * `content`. Signed in as admin — the UI responder-assignment path belongs
 * to department_admins (no seed account), so tests set the same fields the
 * dept_admin flow would write.
 */
export async function assignResponderToReport(
  content,
  responderEmail = 'responder@emergency.gov'
) {
  const sb = client();
  await signInWithRetry(sb, 'admin@emergency.gov', 'admin123');
  const { data: profiles } = await sb
    .from('user_profiles')
    .select('id, department_id')
    .eq('email', responderEmail)
    .limit(1);
  const responder = profiles?.[0];
  const { data: reports } = await sb
    .from('emergency_reports')
    .select('id')
    .eq('content', content)
    .order('created_at', { ascending: false })
    .limit(1);
  const report = reports?.[0];
  if (responder?.department_id && report) {
    await sb
      .from('emergency_reports')
      .update({
        assigned_to: responder.id,
        assigned_department_id: responder.department_id,
      })
      .eq('id', report.id);
  } else {
    console.warn(`seed: could not assign responder — responder dept or report missing for "${content}"`);
  }
  await sb.auth.signOut();
}

/**
 * Signs in with retries — Supabase auth occasionally fails transiently
 * (rate limits, network blips), after which getUser() returns null and
 * downstream code crashes on `me.user.id`.
 */
export async function signInWithRetry(sb, email, password, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (!error) {
      const { data: me } = await sb.auth.getUser();
      if (me?.user) return me.user;
      lastError = new Error('getUser returned no user after sign-in');
    } else {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  throw new Error(`sign-in failed for ${email}: ${lastError?.message}`);
}

/**
 * Ensures exactly one pending id_verifications row exists for the admin account
 * (marked via review_notes = 'E2E seed'). Reused across runs and reset to
 * 'pending' each time, so the review queue never accumulates test rows.
 * Returns the row's id.
 */
export async function ensurePendingVerification() {
  const sb = client();
  await sb.auth.signInWithPassword({
    email: 'admin@emergency.gov',
    password: 'admin123',
  });
  const { data: me } = await sb.auth.getUser();
  const { data: existing } = await sb
    .from('id_verifications')
    .select('id')
    .eq('review_notes', 'E2E seed')
    .limit(1);

  let id = existing?.[0]?.id;
  if (id) {
    await sb.from('id_verifications').update({ verification_status: 'pending' }).eq('id', id);
  } else {
    const { data } = await sb
      .from('id_verifications')
      .insert({
        user_id: me.user.id,
        id_document_url: 'e2e_seed',
        ocr_data: { extracted_name: 'E2E Test User', confidence: 85 },
        ocr_confidence: 85,
        verification_status: 'pending',
        review_notes: 'E2E seed',
      })
      .select('id')
      .single();
    id = data?.id;
  }
  await sb.auth.signOut();
  return id;
}

/**
 * Creates an incident owned by the dispatcher with a given status.
 * Deletable afterwards via deleteReportsByContent (reporter-owned policy).
 */
export async function createReport(content, status = 'pending', location = 'E2E Test Avenue') {
  const sb = client();
  const user = await signInWithRetry(
    sb,
    'dispatcher@emergency.gov',
    'dispatcher123'
  );
  const { error } = await sb.from('emergency_reports').insert({
    reporter_id: user.id,
    report_type: 'fire',
    content,
    attachments: { location },
    status,
    priority: 'high',
  });
  await sb.auth.signOut();
  if (error) console.warn(`seed: could not create report "${content}": ${error.message}`);
}

/**
 * Seeds a pending cross_department_assistance row for the newest report
 * matching `content`, pointed at the first department. The UI renders these
 * in the queue's "Assistance requests" banner; requested_by = dispatcher.
 */
export async function createAssistanceRequest(content) {
  const sb = client();
  const user = await signInWithRetry(sb, 'dispatcher@emergency.gov', 'dispatcher123');
  const { data: reports } = await sb
    .from('emergency_reports')
    .select('id')
    .eq('content', content)
    .order('created_at', { ascending: false })
    .limit(1);
  const { data: depts } = await sb.from('departments').select('id').limit(1);
  if (reports?.[0] && depts?.[0]) {
    const { error } = await sb.from('cross_department_assistance').insert({
      report_id: reports[0].id,
      assisting_department_id: depts[0].id,
      requested_by: user.id,
      status: 'pending',
      notes: 'e2e seed',
    });
    if (error) console.warn(`seed: could not insert CDA row: ${error.message}`);
  } else {
    console.warn('seed: CDA insert skipped — report or department missing');
  }
  await sb.auth.signOut();
}

/** Removes seeded CDA rows (notes = 'e2e seed') as dispatcher. */
export async function deleteAssistanceRequests() {
  const sb = client();
  await signInWithRetry(sb, 'dispatcher@emergency.gov', 'dispatcher123');
  const { error } = await sb
    .from('cross_department_assistance')
    .delete()
    .eq('notes', 'e2e seed');
  await sb.auth.signOut();
  if (error) console.warn(`cleanup: could not delete CDA rows: ${error.message}`);
}

/**
 * Reads attachments.service_area_status for a report by exact content match.
 * Signed in as dispatcher, which can read all reports.
 */
export async function getReportServiceArea(content) {
  const sb = client();
  await sb.auth.signInWithPassword({
    email: 'dispatcher@emergency.gov',
    password: 'dispatcher123',
  });
  const { data } = await sb
    .from('emergency_reports')
    .select('attachments')
    .eq('content', content)
    .order('created_at', { ascending: false })
    .limit(1);
  await sb.auth.signOut();
  return data?.[0]?.attachments?.service_area_status ?? null;
}

/**
 * Deletes a user_profiles row by email. Signed in as admin (admins manage
 * profiles). Note: the matching auth.users row cannot be removed with the
 * publishable key — that needs the service-role key or dashboard cleanup.
 */
export async function deleteUserProfileByEmail(email) {
  const sb = client();
  await sb.auth.signInWithPassword({
    email: 'admin@emergency.gov',
    password: 'admin123',
  });
  const { error } = await sb
    .from('user_profiles')
    .delete()
    .eq('email', email);
  await sb.auth.signOut();
  if (error) console.warn(`cleanup: could not delete profile "${email}": ${error.message}`);
}
