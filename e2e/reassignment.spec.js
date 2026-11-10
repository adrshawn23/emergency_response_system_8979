import { test, expect } from '@playwright/test';
import { client, createReport, deleteReportsByContent, signInWithRetry } from './helpers.js';

// Reassignment requests: dept admin flags a wrongly-dispatched incident
// (required reason), dispatcher sees it in the banner and acts on it.
const DESC = `E2E reassign ${Date.now()}`;
const LOC = 'E2E Reassign Avenue';
const REASON = 'Wrong department — this is a medical incident';
const DEPT_ADMIN = { email: 'deptadmin.fire@emergency.gov', password: 'deptadmin123' };
const DISPATCHER = { email: 'dispatcher@emergency.gov', password: 'dispatcher123' };

async function login(page, email, password) {
  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 60000 });
}

async function signOut(page) {
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
  });
  await page.goto('/login');
  await page.waitForURL('/login', { timeout: 30000 });
}

let deptAdminDeptId = null;

test.beforeAll(async () => {
  // deptadmin.fire@emergency.gov only exists after running
  // supabase/create_deptadmin_fire.sql — skip gracefully until then
  // (same gating as department_dispatch.spec.js, but auto-detected).
  // Sign in as the dept admin: user_profiles RLS only exposes your own row.
  try {
    const sb = client();
    await signInWithRetry(sb, DEPT_ADMIN.email, DEPT_ADMIN.password);
    const { data: prof } = await sb.from('user_profiles')
      .select('department_id').eq('email', DEPT_ADMIN.email).maybeSingle();
    deptAdminDeptId = prof?.department_id || null;
    await sb.auth.signOut();
  } catch { deptAdminDeptId = null; }
});

test.describe.serial('Reassignment requests', () => {
  test('dept admin files a request with a required reason', async ({ page }) => {
    test.skip(!deptAdminDeptId,
      'deptadmin.fire@emergency.gov missing — run supabase/create_deptadmin_fire.sql');
    // Seed: a report assigned to the dept admin's department. The client
    // needs a session — user_profiles + report update are RLS-gated.
    const sb = client();
    await signInWithRetry(sb, DISPATCHER.email, DISPATCHER.password);
    await createReport(DESC, 'assigned', LOC);
    const { data: report } = await sb.from('emergency_reports')
      .select('id').eq('content', DESC)
      .order('created_at', { ascending: false }).limit(1).single();
    await sb.from('emergency_reports')
      .update({ assigned_department_id: deptAdminDeptId })
      .eq('id', report.id);

    await login(page, DEPT_ADMIN.email, DEPT_ADMIN.password);
    await page.goto('/report-management');

    const row = page.locator('div.cursor-pointer', { hasText: DESC }).last();
    const reqBtn = row.getByRole('button', { name: 'Request reassign' });
    await expect(reqBtn).toBeVisible({ timeout: 15000 });
    await reqBtn.click();

    // Reason is required — Send stays disabled until filled.
    const sendBtn = page.getByRole('button', { name: 'Send request' });
    await expect(sendBtn).toBeDisabled();
    await page.fill('#reassignReason', REASON);
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // Request appears in the blue banner.
    await expect(page.getByText('Reassignment requests')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`"${REASON}"`)).toBeVisible({ timeout: 10000 });
  });

  test('dispatcher sees the request and dismisses it', async ({ page }) => {
    test.skip(!deptAdminDeptId,
      'deptadmin.fire@emergency.gov missing — run supabase/create_deptadmin_fire.sql');
    await login(page, DISPATCHER.email, DISPATCHER.password);
    await page.goto('/report-management');

    await expect(page.getByText('Reassignment requests')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(`"${REASON}"`)).toBeVisible({ timeout: 10000 });

    // The banner row offers Reassign + Dismiss; dismiss marks it denied.
    const row = page.locator('li', { hasText: DESC }).first();
    await expect(row.getByRole('button', { name: 'Reassign' })).toBeVisible();
    await row.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByText(`"${REASON}"`)).toHaveCount(0, { timeout: 10000 });
  });
});

test.afterAll(async () => {
  const sb = client();
  await signInWithRetry(sb, DISPATCHER.email, DISPATCHER.password);
  const { data: report } = await sb.from('emergency_reports')
    .select('id').eq('content', DESC).maybeSingle();
  if (report?.id) {
    await sb.from('reassignment_requests').delete().eq('report_id', report.id);
  }
  await deleteReportsByContent(DESC);
});
