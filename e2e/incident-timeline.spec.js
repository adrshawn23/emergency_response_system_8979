import { test, expect } from '@playwright/test';
import { client, signInWithRetry, deleteReportsByContent } from './helpers.js';

/**
 * Spec 001 — incident tracking timeline + proximity-gated Arrived.
 * Surface under test: responder-view incident modal (card -> Resolve opens it).
 *
 * Incident coords are seeded inside Kalubihan (~10.297, 123.907); the mocked
 * responder position sits ~23 km away so the 50 m radius blocks arrival.
 * Without the history migration applied the timeline falls back to legacy
 * synthesis — the assertions below hold either way.
 */

const INCIDENT_COORDS = { latitude: 10.297085, longitude: 123.907249 };
const FAR_AWAY = { latitude: 10.45, longitude: 124.0 };

async function login(page, email, password) {
  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 60000 });
}

async function seedAssignedInProgress(content) {
  const sb = client();
  await signInWithRetry(sb, 'dispatcher@emergency.gov', 'dispatcher123');
  const { data: me } = await sb.auth.getUser();
  const { data: resp, error: respErr } = await sb
    .from('user_profiles')
    .select('id')
    .eq('email', 'responder@emergency.gov')
    .single();
  if (respErr) throw new Error(`responder lookup failed: ${respErr.message}`);
  const { data: report, error } = await sb.from('emergency_reports').insert({
    reporter_id: me.user.id,
    report_type: 'fire',
    content,
    attachments: {
      location: `GPS: ${INCIDENT_COORDS.latitude}, ${INCIDENT_COORDS.longitude}`,
      ...INCIDENT_COORDS,
    },
    status: 'in-progress',
    priority: 'high',
    assigned_to: resp.id,
  }).select('id').single();
  await sb.auth.signOut();
  if (error) throw new Error(`seed failed: ${error.message}`);
  return { reportId: report.id, responderId: resp.id };
}

// The RPC checks the SERVER's copy of responder position — seed
// responder_locations ~30 m from the pin via the responder's own session
// (RLS lets a responder upsert only their own row).
const NEARBY = { latitude: INCIDENT_COORDS.latitude + 0.0002, longitude: INCIDENT_COORDS.longitude };

async function seedResponderLocationNearIncident() {
  const sb = client();
  await signInWithRetry(sb, 'responder@emergency.gov', 'responder123');
  const { data: me } = await sb.auth.getUser();
  const { error } = await sb.from('responder_locations').upsert({
    responder_id: me.user.id,
    ...NEARBY,
    updated_at: new Date().toISOString(),
  });
  await sb.auth.signOut();
  if (error) throw new Error(`loc seed failed: ${error.message}`);
}

async function arrivedRow(reportId) {
  const sb = client();
  await signInWithRetry(sb, 'dispatcher@emergency.gov', 'dispatcher123');
  const { data } = await sb
    .from('incident_status_history')
    .select('to_status, meta')
    .eq('report_id', reportId)
    .eq('to_status', 'arrived')
    .maybeSingle();
  await sb.auth.signOut();
  return data;
}

test.describe('Incident timeline — responder modal', () => {
  test.use({ geolocation: FAR_AWAY, permissions: ['geolocation'], viewport: { width: 1280, height: 800 } });

  test('timeline renders all steps; Arrived blocked outside 50 m radius', async ({ page }) => {
    const desc = `E2E timeline ${Date.now()}`;
    await seedAssignedInProgress(desc);

    await login(page, 'responder@emergency.gov', 'responder123');
    const card = page.locator('article').filter({ hasText: desc });
    await expect(card).toBeVisible({ timeout: 30000 });
    await card.getByRole('button', { name: 'Resolve' }).click();

    // Shared tracking surface (FR-006) — every canonical step labeled.
    await expect(page.getByText('Tracking')).toBeVisible({ timeout: 15000 });
    for (const step of ['Reported', 'Assigned', 'Responding', 'Arrived', 'Resolved']) {
      await expect(page.getByText(step, { exact: true }).first()).toBeVisible();
    }

    // Proximity gate: ~23 km away → visible but disabled with reason (FR-012).
    const arrived = page.getByRole('button', { name: 'Arrived on scene' });
    await expect(arrived).toBeVisible();
    await expect(arrived).toBeDisabled();
    await expect(page.getByText(/move within 50 m/)).toBeVisible();

    await deleteReportsByContent(desc);
    await page.goto('/login');
  });
});

test.describe('Incident timeline — arrival happy path', () => {
  // Browser GPS reports ~30 m from the pin; the seeded responder_locations row
  // is what mark_incident_arrived actually measures against.
  test.use({ geolocation: NEARBY, permissions: ['geolocation'], viewport: { width: 1280, height: 800 } });

  test('within radius: Arrived enables, records GPS-verified event, hides button', async ({ page }) => {
    const desc = `E2E timeline arrived ${Date.now()}`;
    const { reportId } = await seedAssignedInProgress(desc);
    await seedResponderLocationNearIncident();

    await login(page, 'responder@emergency.gov', 'responder123');
    const card = page.locator('article').filter({ hasText: desc });
    await expect(card).toBeVisible({ timeout: 30000 });
    await card.getByRole('button', { name: 'Resolve' }).click();

    const arrived = page.getByRole('button', { name: 'Arrived on scene' });
    await expect(arrived).toBeVisible({ timeout: 15000 });
    await expect(arrived).toBeEnabled();
    await arrived.click();

    // Durable outcome, not the transient toast: the realtime history row
    // flips hasArrived → step done + button unmounts (can race the toast).
    await expect(page.getByText('GPS-verified')).toBeVisible({ timeout: 15000 });
    await expect(arrived).toBeHidden(); // one event per incident (FR-013)

    // Server-side truth: history row written by the SECURITY DEFINER RPC.
    await expect.poll(() => arrivedRow(reportId), { timeout: 15000 })
      .toMatchObject({ to_status: 'arrived', meta: { method: 'gps' } });

    await deleteReportsByContent(desc);
    await page.goto('/login');
  });
});

test.describe('Incident timeline — GPS unavailable', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Arrived stays disabled with a plain-language reason when GPS is denied', async ({ page }) => {
    const desc = `E2E timeline nogps ${Date.now()}`;
    await seedAssignedInProgress(desc);

    await login(page, 'responder@emergency.gov', 'responder123');
    const card = page.locator('article').filter({ hasText: desc });
    await expect(card).toBeVisible({ timeout: 30000 });
    await card.getByRole('button', { name: 'Resolve' }).click();

    const arrived = page.getByRole('button', { name: 'Arrived on scene' });
    await expect(arrived).toBeVisible({ timeout: 15000 });
    await expect(arrived).toBeDisabled();
    await expect(page.getByText(/enable GPS/i)).toBeVisible();

    await deleteReportsByContent(desc);
    await page.goto('/login');
  });
});
