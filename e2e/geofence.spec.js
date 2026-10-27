import { test, expect } from '@playwright/test';
import { deleteReportsByContent, getReportServiceArea } from './helpers.js';

/**
 * Geofence role scoping:
 *   resident   -> boundary check applies (inside/outside flag + outside warning)
 *   dispatcher -> bypasses geofence (no warning, service_area_status 'staff')
 *   admin      -> bypasses geofence (no warning, service_area_status 'staff')
 *
 * Default demo polygon: lat 10.3172-10.3192, lng 123.8951-123.8981
 * (localStorage 'service_boundary' is empty in a fresh context, so the
 * built-in default applies.)
 */

const OUTSIDE = { latitude: 10.45, longitude: 124.0 };
const INSIDE = { latitude: 10.318, longitude: 123.8965 };

async function login(page, email, password) {
  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 60000 });
}

async function submitIncident(page, description) {
  await page.fill('textarea', description);
  await page.click('button[type="submit"]');
  await expect(page.getByRole('heading', { name: 'Report submitted' })).toBeVisible({ timeout: 30000 });
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

    await submitIncident(page, desc);
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

    await submitIncident(page, desc);
    await expect.poll(() => getReportServiceArea(desc), { timeout: 15000 }).toBe('inside');
    await deleteReportsByContent(desc, 'resident@example.com', 'resident123');
    await page.goto('/login');
  });
});

test.describe('Geofence: staff bypass', () => {
  test.use({ geolocation: OUTSIDE, permissions: ['geolocation'], viewport: { width: 1280, height: 800 } });

  for (const [email, password, label] of [
    ['dispatcher@emergency.gov', 'dispatcher123', 'dispatcher'],
    ['admin@emergency.gov', 'admin123', 'admin'],
  ]) {
    test(`${label} outside boundary bypasses geofence`, async ({ page }) => {
      const desc = `E2E geo ${label} ${Date.now()}`;
      await login(page, email, password);
      // Click and wait for navigation atomically — otherwise a slow dashboard
      // mount can swallow the sidebar click before handlers attach.
      await Promise.all([
        page.waitForURL('/emergency-report'),
        page.click('button[title="New incident"]'),
      ]);

      // Staff get neutral GPS text — no outside-boundary warning
      await expect(page.locator('text=Current GPS location captured'))
        .toBeVisible({ timeout: 30000 });
      await expect(page.locator('text=outside the Barangay Kalubihan service area'))
        .toBeHidden();

      await submitIncident(page, desc);
      await expect.poll(() => getReportServiceArea(desc), { timeout: 15000 }).toBe('staff');
      await deleteReportsByContent(desc, email, password);
      await page.goto('/login');
    });
  }
});
