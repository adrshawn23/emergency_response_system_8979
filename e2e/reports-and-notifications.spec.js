import { test, expect } from '@playwright/test';
import { client, signInWithRetry, deleteReportsByContent } from './helpers.js';

/**
 * Reports page + assignment notifications + stale-assignment flags.
 *
 * Covers the post-spec-001 work: the /reports records+activity surface
 * (admin/dispatcher only), the trigger-driven 'assignment' notification that
 * deep-links into the incident modal, and the >10m stale-assignment markers.
 * updated_at is trigger-managed on UPDATE but preserved on INSERT — that's
 * how the stale row is seeded.
 */

const SEED = { latitude: 10.297085, longitude: 123.907249 };

async function login(page, email, password) {
  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 60000 });
}

async function seedReport(content, extra = {}) {
  const sb = client();
  await signInWithRetry(sb, 'dispatcher@emergency.gov', 'dispatcher123');
  const { data: me } = await sb.auth.getUser();
  const { data: report, error } = await sb.from('emergency_reports').insert({
    reporter_id: me.user.id,
    report_type: 'fire',
    priority: 'high',
    content,
    attachments: { location: `E2E-REPORTS-${Date.now()}`, ...SEED },
    status: 'pending',
    ...extra,
  }).select('id, report_id').single();
  await sb.auth.signOut();
  if (error) throw new Error(`seed failed: ${error.message}`);
  return report;
}

test.describe('Reports page', () => {
  test('dispatcher sees records, activity feed; search filters rows', async ({ page }) => {
    const desc = `E2E reports records ${Date.now()}`;
    await seedReport(desc);

    await login(page, 'dispatcher@emergency.gov', 'dispatcher123');
    await page.goto('/reports');

    await expect(page.getByText('Reports & system activity').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Incident records')).toBeVisible();
    await expect(page.getByText('System activity', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export CSV/ })).toBeVisible();

    // Search narrows the table to the seeded row.
    await page.getByPlaceholder(/Search reports/).fill(desc);
    await expect(page.getByText(desc).first()).toBeVisible({ timeout: 15000 });
    await page.getByPlaceholder(/Search reports/).fill('zzz-nothing-matches');
    await expect(page.getByText('No reports match these filters.')).toBeVisible();

    await deleteReportsByContent(desc);
    await page.goto('/login');
  });

  test('responder is bounced off /reports (page permission)', async ({ page }) => {
    await login(page, 'responder@emergency.gov', 'responder123');
    await page.goto('/reports');
    await page.waitForTimeout(3000); // let RoleRoute decide
    await expect(page.getByText('Incident records')).toBeHidden();
  });
});

test.describe('Assignment notification deep-link', () => {
  test('responder bell shows assignment with incident ref; click opens incident modal', async ({ page }) => {
    const desc = `E2E notif assign ${Date.now()}`;
    const report = await seedReport(desc);

    // Admin assigns the responder — trg_notify_incident_assignment fires.
    const sb = client();
    await signInWithRetry(sb, 'admin@emergency.gov', 'admin123');
    const { data: resp } = await sb.from('user_profiles')
      .select('id').eq('email', 'responder@emergency.gov').single();
    const { error: e1 } = await sb.from('emergency_reports')
      .update({ assigned_to: resp.id, status: 'assigned' }).eq('id', report.id);
    await sb.auth.signOut();
    if (e1) throw new Error(`assign failed: ${e1.message}`);

    await login(page, 'responder@emergency.gov', 'responder123');
    await page.getByRole('button', { name: /Notifications/ }).click();
    // The menu must be open before item matching — under suite load the bell
    // opens late and the row arrives on the realtime poll after that.
    await expect(page.locator('div[role="menu"]')).toBeVisible({ timeout: 15000 });
    const item = page.getByRole('menuitem').filter({ hasText: 'New incident assignment' }).first();
    await expect(item).toBeVisible({ timeout: 30000 });
    // Incident-identifying info is in the message (report ref like RPT-xxxx).
    await expect(item).toContainText(/\(RPT-|incident/i);
    await item.click();

    // Deep-link lands on the incident modal — shared timeline renders.
    await expect(page.getByText('Tracking')).toBeVisible({ timeout: 15000 });

    await deleteReportsByContent(desc);
    await page.goto('/login');
  });
});

test.describe('Stale-assignment flag', () => {
  test('assigned >10m untouched → command-center "no response" pill + queue badge', async ({ page }) => {
    const desc = `E2E stale flag ${Date.now()}`;
    await seedReport(desc, {
      status: 'assigned',
      updated_at: '2020-01-01T00:00:00Z', // survives INSERT; trigger only fires on UPDATE
    });

    await login(page, 'dispatcher@emergency.gov', 'dispatcher123');

    // CommandOps pill.
    await expect(page.getByText('Live operations')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/assigned — no response/)).toBeVisible();

    // Queue row badge.
    await page.goto('/report-management');
    await expect(page.getByText(/No response \d+m/).first()).toBeVisible({ timeout: 30000 });

    await deleteReportsByContent(desc);
    await page.goto('/login');
  });
});
