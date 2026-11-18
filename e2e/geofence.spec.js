import { test, expect } from '@playwright/test';
import { deleteReportsByContent, getReportServiceArea, submitIncident, EVIDENCE_PNG } from './helpers.js';

/**
 * Geofence role scoping (post-20261116103000 enforcement):
 *   resident   -> boundary check applies; an OUTSIDE report is blocked at
 *                 the composer AND by the trg_enforce_service_area trigger
 *   dispatcher -> bypasses enforcement (submits fine, status 'outside')
 *   responder  -> bypasses enforcement (same)
 *   (admin is intentionally excluded from 'new' by SECTION_ROLES)
 *
 * The live composer (/emergency-report -> dashboard 'new' section)
 * auto-captures GPS on mount via captureGps(); the verdict shows in
 * gpsStatus, not a separate banner:
 *   resident outside -> 'GPS location is outside the Barangay Kalubihan
 *                       service area. Reports cannot be submitted…'
 *   everyone else    -> 'Current GPS location captured (+/-N m).'
 * Blocking is the submitError banner text, not a modal.
 *
 * Active boundary: the real Barangay Kalubihan polygon
 *   lat 10.2935-10.2996, lng 123.8955-123.9006 — see
 *   supabase/set_kalubihan_boundary.sql / migration 20261028162000.
 * INSIDE must sit inside that polygon (barangay center used).
 */

const OUTSIDE = { latitude: 10.45, longitude: 124.0 };
const INSIDE = { latitude: 10.2968, longitude: 123.8979 };

async function login(page, email, password) {
  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 60000 });
  // The geofence boundary fetches on workspace mount — the GPS callback
  // computes serviceAreaStatus against it, so let it settle first.
  await page.waitForLoadState('networkidle');
}


test.describe('Geofence: resident is affected', () => {
  test.use({ geolocation: OUTSIDE, permissions: ['geolocation'], viewport: { width: 1280, height: 800 } });

  test('resident outside boundary sees warning and the report is blocked', async ({ page }) => {
    const desc = `E2E geo outside ${Date.now()}`;
    await login(page, 'resident@example.com', 'resident123');
    await page.click('text=/Report (an )?emergency/');
    await page.waitForURL('/emergency-report');

    // Auto-capture computes the verdict — outside residents get the block copy.
    await expect(page.locator('text=GPS location is outside the Barangay Kalubihan service area'))
      .toBeVisible({ timeout: 30000 });

    // A fully valid form still cannot submit — the composer's hard geofence
    // surfaces the red submitError banner instead of 'Report submitted'.
    await page.getByLabel('What is happening?').fill(desc);
    await page.locator('input[type="file"]').setInputFiles(EVIDENCE_PNG);
    const submit = page.getByRole('button', { name: /Submit report|Waiting for GPS/ });
    await page.waitForFunction(el => el && !el.disabled, await submit.elementHandle(), { timeout: 30000 });
    await submit.click();
    await expect(page.locator('text=outside the Barangay Kalubihan service area — emergency reports'))
      .toBeVisible({ timeout: 30000 });

    // Nothing persisted — neither client nor trigger let it through.
    await page.waitForTimeout(2000);
    expect(await getReportServiceArea(desc)).toBeNull();
    await page.goto('/login');
  });
});

test.describe('Geofence: resident inside boundary', () => {
  test.use({ geolocation: INSIDE, permissions: ['geolocation'], viewport: { width: 1280, height: 800 } });

  test('resident inside boundary gets normal capture and flags inside', async ({ page }) => {
    const desc = `E2E geo inside ${Date.now()}`;
    await login(page, 'resident@example.com', 'resident123');
    await page.click('text=/Report (an )?emergency/');
    await page.waitForURL('/emergency-report');

    await expect(page.locator('text=Current GPS location captured')).toBeVisible({ timeout: 30000 });

    await submitIncident(page, { description: desc });
    await expect.poll(() => getReportServiceArea(desc), { timeout: 15000 }).toBe('inside');
    await deleteReportsByContent(desc, 'resident@example.com', 'resident123');
    await page.goto('/login');
  });
});

test.describe('Geofence: staff bypass', () => {
  test.use({ geolocation: OUTSIDE, permissions: ['geolocation'], viewport: { width: 1280, height: 800 } });

  for (const [email, password, label] of [
    ['dispatcher@emergency.gov', 'dispatcher123', 'dispatcher'],
    ['healthandfirstaidteam.responder1@emergency.gov', 'responder123', 'responder'],
  ]) {
    test(`${label} outside boundary bypasses geofence`, async ({ page }) => {
      const desc = `E2E geo ${label} ${Date.now()}`;
      await login(page, email, password);
      // URL nav — the sidebar no longer exposes a title="New incident" button.
      await page.goto('/emergency-report');
      await page.waitForURL('/emergency-report');

      // Staff never get the boundary verdict — gpsStatus shows the plain
      // capture line and serviceAreaStatus is hard-coded to 'staff'.
      await expect(page.locator('text=Current GPS location captured')).toBeVisible({ timeout: 30000 });

      await submitIncident(page, { description: desc });
      await expect.poll(() => getReportServiceArea(desc), { timeout: 15000 }).toBe('staff');
      await deleteReportsByContent(desc, email, password);
      await page.goto('/login');
    });
  }
});
