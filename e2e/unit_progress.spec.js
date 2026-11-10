import { test, expect } from '@playwright/test';
import { client, signInWithRetry, deleteReportsByContent, deleteAssistanceRequests, EVIDENCE_PNG } from './helpers.js';

/**
 * Per-department unit progress (20261110220000_cda_unit_progress.sql).
 * An assisting unit gets its own chain: Assigned → Responding →
 * Arrived (GPS-geofenced via mark_cda_arrived) → Resolved (photo required),
 * while the main incident status stays with the main department.
 *
 * Uses police.responder1 — the CDA row is pre-accepted to model "dept
 * admin already picked the responder".
 *
 * Requires the migration applied — the beforeAll probe fails fast with the
 * file name when the columns are missing.
 */

const RESP = { email: 'police.responder1@emergency.gov', password: 'responder123' };
const INCIDENT_COORDS = { latitude: 10.297085, longitude: 123.907249 };
const NEARBY = { latitude: INCIDENT_COORDS.latitude + 0.0002, longitude: INCIDENT_COORDS.longitude };
const FAR_AWAY = { latitude: 10.45, longitude: 124.0 };

async function login(page, email, password) {
  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 60000 });
}

// Report owned by the dispatcher — cleanup via deleteReportsByContent.
async function seedReport(content) {
  const sb = client();
  const user = await signInWithRetry(sb, 'dispatcher@emergency.gov', 'dispatcher123');
  const { data, error } = await sb.from('emergency_reports').insert({
    reporter_id: user.id,
    report_type: 'fire',
    content,
    attachments: {
      location: `GPS: ${INCIDENT_COORDS.latitude}, ${INCIDENT_COORDS.longitude} — E2E unit test`,
      ...INCIDENT_COORDS,
    },
    status: 'in-progress',
    priority: 'high',
  }).select('id').single();
  await sb.auth.signOut();
  if (error) throw new Error(`report seed failed: ${error.message}`);
  return data.id;
}

// CDA row as if the assisting dept admin already picked responder3.
async function seedAcceptedUnit(reportId) {
  const sb = client();
  const admin = await signInWithRetry(sb, 'admin@emergency.gov', 'admin123');
  const { data: resp, error: respErr } = await sb
    .from('user_profiles').select('id, department_id').eq('email', RESP.email).single();
  if (respErr || !resp?.department_id) throw new Error(`responder3 lookup failed: ${respErr?.message || 'no department'}`);
  const { error } = await sb.from('cross_department_assistance').insert({
    report_id: reportId,
    assisting_department_id: resp.department_id,
    requested_by: admin.id,
    responder_id: resp.id,
    status: 'accepted',
    assigned_at: new Date().toISOString(),
    notes: 'e2e seed',
  });
  await sb.auth.signOut();
  if (error) throw new Error(`cda seed failed: ${error.message}`);
}

// Server-side position seed (RPC reads responder_locations, not browser GPS).
async function seedResponderLocation(pos = NEARBY) {
  const sb = client();
  const me = await signInWithRetry(sb, RESP.email, RESP.password);
  const { error } = await sb.from('responder_locations').upsert({
    responder_id: me.id, ...pos, updated_at: new Date().toISOString(),
  });
  await sb.auth.signOut();
  if (error) throw new Error(`location seed failed: ${error.message}`);
}

// Position rows leak across tests — delete the seed after each run.
async function clearResponderLocation() {
  const sb = client();
  const me = await signInWithRetry(sb, RESP.email, RESP.password);
  await sb.from('responder_locations').delete().eq('responder_id', me.id);
  await sb.auth.signOut();
}

async function readCda(reportId) {
  const sb = client();
  await signInWithRetry(sb, 'admin@emergency.gov', 'admin123');
  const { data } = await sb
    .from('cross_department_assistance')
    .select('acknowledged_at, arrived_at, resolved_at, resolution_proof')
    .eq('report_id', reportId).single();
  await sb.auth.signOut();
  return data;
}

test.describe('Unit progress: assisting department chain', () => {
  test.use({ geolocation: NEARBY, permissions: ['geolocation'], viewport: { width: 1280, height: 800 } });

  test.beforeAll(async () => {
    // Column probe — fails fast when the migration isn't applied yet.
    const sb = client();
    await signInWithRetry(sb, 'admin@emergency.gov', 'admin123');
    const { error } = await sb.from('cross_department_assistance').select('assigned_at').limit(1);
    await sb.auth.signOut();
    if (error) throw new Error(
      `Unit-progress columns missing — apply supabase/migrations/20261110220000_cda_unit_progress.sql in the SQL editor. (${error.message})`);
  });

  test.afterEach(async () => {
    await deleteAssistanceRequests();
    await deleteReportsByContent(CONTENT);
    await clearResponderLocation();
  });

  const CONTENT = `E2E unit progress ${Date.now()}`;

  test('unit: Responding → GPS Arrived → photo Resolve, timeline shows unit chips', async ({ page }) => {
    const reportId = await seedReport(CONTENT);
    await seedAcceptedUnit(reportId);
    await seedResponderLocation();

    await login(page, RESP.email, RESP.password);
    await page.waitForLoadState('networkidle');

    // Accepted unit shows on the assistance card — open the incident.
    await page.getByRole('button', { name: 'View incident' }).first().click();
    await expect(page.getByText('Tracking')).toBeVisible({ timeout: 15000 });

    // 1) Start responding — stamps acknowledged_at on the CDA row.
    await page.getByRole('button', { name: 'Start responding' }).click();
    await expect.poll(async () => (await readCda(reportId))?.acknowledged_at, { timeout: 15000 })
      .toBeTruthy();

    // 2) Arrived — geofenced by mark_cda_arrived (server position ~20 m out).
    await page.getByRole('button', { name: 'Arrived on scene' }).click();
    await expect.poll(async () => (await readCda(reportId))?.arrived_at, { timeout: 15000 })
      .toBeTruthy();

    // 3) Resolve — blocked until a proof photo is attached.
    const resolveBtn = page.getByRole('button', { name: 'Resolve unit task' });
    await expect(resolveBtn).toBeDisabled();
    await page.locator('input[type="file"]').last().setInputFiles(EVIDENCE_PNG);
    await page.getByRole('button', { name: 'Resolve unit task' }).click();
    await expect.poll(async () => (await readCda(reportId))?.resolved_at, { timeout: 15000 })
      .toBeTruthy();
    await expect.poll(async () => (await readCda(reportId))?.resolution_proof, { timeout: 15000 })
      .toBeTruthy();

    // 4) Timeline units section reflects the full chain + proof thumbnail.
    await expect(page.getByText('Responding units')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('img[alt="Unit resolution proof"]')).toBeVisible();
  });

});

test.describe('Unit progress: GPS denied', () => {
  // No geolocation permission — watchPosition errors, myPosition stays
  // null, so the client preview blocks before the RPC is even reachable.
  test.use({ viewport: { width: 1280, height: 800 } });

  test('unit arrive blocked when GPS permission is denied', async ({ page }) => {
    const content = `E2E unit no-gps ${Date.now()}`;
    const reportId = await seedReport(content);
    await seedAcceptedUnit(reportId);
    await login(page, RESP.email, RESP.password);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'View incident' }).first().click();
    await page.getByRole('button', { name: 'Start responding' }).click();
    await expect.poll(async () => (await readCda(reportId))?.acknowledged_at, { timeout: 15000 })
      .toBeTruthy();

    await expect(page.getByRole('button', { name: 'Arrived on scene' })).toBeDisabled();
    await expect(page.getByText('Location unavailable')).toBeVisible();
    await deleteAssistanceRequests();
    await deleteReportsByContent(content);
  });
});

test.describe('Unit progress: far GPS blocks client preview', () => {
  test.use({ geolocation: FAR_AWAY, permissions: ['geolocation'], viewport: { width: 1280, height: 800 } });

  test('arrive disabled with distance hint', async ({ page }) => {
    const content = `E2E unit far ${Date.now()}`;
    const reportId = await seedReport(content);
    await seedAcceptedUnit(reportId);
    await login(page, RESP.email, RESP.password);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'View incident' }).first().click();
    await page.getByRole('button', { name: 'Start responding' }).click();
    await expect.poll(async () => (await readCda(reportId))?.acknowledged_at, { timeout: 15000 })
      .toBeTruthy();
    await expect(page.getByRole('button', { name: 'Arrived on scene' })).toBeDisabled();
    await expect(page.getByText(/move within/)).toBeVisible();
    await deleteAssistanceRequests();
    await deleteReportsByContent(content);
  });
});
