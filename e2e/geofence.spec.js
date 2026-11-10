import { test, expect } from '@playwright/test';
import { deleteReportsByContent, getReportServiceArea, submitIncident } from './helpers.js';

/**
 * Geofence role scoping:
 *   resident   -> boundary check applies (inside/outside flag + outside warning)
 *   dispatcher -> bypasses geofence (no warning, service_area_status 'staff')
 *   responder  -> bypasses geofence (no warning, service_area_status 'staff')
 *   (admin is intentionally excluded from 'new' by SECTION_ROLES)
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

  test('resident outside boundary sees warning and report is flagged outside', async ({ page }) => {
    const desc = `E2E geo outside ${Date.now()}`;
    await login(page, 'resident@example.com', 'resident123');
    await page.click('text=Report an emergency');
    await page.waitForURL('/emergency-report');

    await expect(page.locator('text=outside the Barangay Kalubihan service area'))
      .toBeVisible({ timeout: 30000 });

    await submitIncident(page, { description: desc });
    await expect.poll(() => getReportServiceArea(desc), { timeout: 15000 }).toBe('outside');
    await deleteReportsByContent(desc, 'resident@example.com', 'resident123');
    await page.goto('/login');
  });
});

test.describe('Geofence: resident inside boundary', () => {
  test.use({ geolocation: INSIDE, permissions: ['geolocation'], viewport: { width: 1280, height: 800 } });

  test('resident inside boundary gets normal capture and flags inside', async ({ page }) => {
    const desc = `E2E geo inside ${Date.now()}`;
    await login(page, 'resident@example.com', 'resident123');
    await page.click('text=Report an emergency');
    await page.waitForURL('/emergency-report');

    await expect(page.locator('text=Current GPS location captured'))
      .toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=outside the Barangay Kalubihan service area'))
      .toBeHidden();

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
    ['responder@emergency.gov', 'responder123', 'responder'],
  ]) {
    test(`${label} outside boundary bypasses geofence`, async ({ page }) => {
      const desc = `E2E geo ${label} ${Date.now()}`;
      await login(page, email, password);
      // URL nav — the sidebar no longer exposes a title="New incident" button.
      await page.goto('/emergency-report');
      await page.waitForURL('/emergency-report');

      // Staff get neutral GPS text — no outside-boundary warning
      await expect(page.locator('text=Current GPS location captured'))
        .toBeVisible({ timeout: 30000 });
      await expect(page.locator('text=outside the Barangay Kalubihan service area'))
        .toBeHidden();

      await submitIncident(page, { description: desc });
      await expect.poll(() => getReportServiceArea(desc), { timeout: 15000 }).toBe('staff');
      await deleteReportsByContent(desc, email, password);
      await page.goto('/login');
    });
  }
});
