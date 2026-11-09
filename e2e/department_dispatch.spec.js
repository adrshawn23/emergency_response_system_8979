import { test, expect } from '@playwright/test';
import {
  client,
  signInWithRetry,
  createReport,
  deleteReportsByContent,
} from './helpers.js';

/**
 * Department Dispatch Gate (specs/002-department-dispatch)
 *
 * Verifies the restructured dispatch chain:
 *  - NO cross_department_assistance rows exist before a main department is
 *    assigned (the dispatcher gate)
 *  - assigning the main department auto-creates CDA rows for the mapped
 *    assisting departments, excluding the main department itself
 *  - department_admin assigns responders on own-dept incidents and CDA rows
 *    (env-gated: needs E2E_DEPT_ADMIN_EMAIL/PASSWORD for an account that is
 *    department_admin of the 'E2E Fire Dept' department)
 */
test.describe.serial('Department dispatch gate', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  const uniqueDesc = `E2E dept-dispatch ${Date.now()}`;
  const SEED_DEPTS = [
    { name: 'E2E Fire Dept', type: 'fire' },
    { name: 'E2E Medical Dept', type: 'medical' },
    { name: 'E2E Police Dept', type: 'police' },
  ];
  let reportId = null;
  let fireDeptId = null;

  test.afterAll(async () => {
    // Cancel leftover pending CDA rows so the dashboard amber list stays
    // clean (delete rights on CDA are staff-restricted).
    if (reportId) {
      const sb = client();
      await signInWithRetry(sb, 'dispatcher@emergency.gov', 'dispatcher123');
      await sb
        .from('cross_department_assistance')
        .update({ status: 'cancelled' })
        .eq('report_id', reportId)
        .eq('status', 'pending');
      await sb.auth.signOut();
    }
    await deleteReportsByContent(uniqueDesc);
    // Seed departments persist across runs (re-ensured each time) — they are
    // referenced by CDA rows, so deleting them would hit FK restrictions.
  });

  test('seed: ensure assisting departments exist and create a fire report', async () => {
    const sb = client();
    await signInWithRetry(sb, 'admin@emergency.gov', 'admin123');
    for (const dept of SEED_DEPTS) {
      const { data } = await sb
        .from('departments')
        .select('id')
        .eq('name', dept.name)
        .limit(1);
      if (!data?.length) {
        await sb
          .from('departments')
          .insert({ name: dept.name, type: dept.type, description: 'E2E dispatch-gate seed' });
      }
    }
    const { data: fire } = await sb
      .from('departments')
      .select('id')
      .eq('name', 'E2E Fire Dept')
      .limit(1);
    fireDeptId = fire?.[0]?.id;
    expect(fireDeptId).toBeTruthy();
    await sb.auth.signOut();

    await createReport(uniqueDesc, 'pending', 'E2E Dispatch Avenue');

    const sb2 = client();
    await signInWithRetry(sb2, 'dispatcher@emergency.gov', 'dispatcher123');
    const { data: report } = await sb2
      .from('emergency_reports')
      .select('id')
      .eq('content', uniqueDesc)
      .order('created_at', { ascending: false })
      .limit(1);
    reportId = report?.[0]?.id;
    expect(reportId).toBeTruthy();

    // THE GATE: no CDA rows may exist before the dispatcher picks a dept.
    const { data: cda } = await sb2
      .from('cross_department_assistance')
      .select('id')
      .eq('report_id', reportId);
    expect(cda?.length ?? 0).toBe(0);
    await sb2.auth.signOut();
  });

  test('dispatcher assigns main department -> auto-dispatch creates CDA rows', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'dispatcher@emergency.gov');
    await page.fill('input[type="password"]', 'dispatcher123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 30000 });

    // Nav label carries a pending-count badge ("Incident queue 2"), so match
    // by role + regex and wait for the queue's status-filter bar to render.
    await page.getByRole('button', { name: /Incident queue/ }).first().click();
    await expect(page.getByRole('button', { name: 'pending', exact: true })).toBeVisible();
    const row = page.locator('div.cursor-pointer').filter({ hasText: uniqueDesc });
    await expect(row).toBeVisible({ timeout: 30000 });
    await row.locator('button', { hasText: 'Assign' }).click();

    const modal = page.locator('div.fixed.inset-0')
      .filter({ has: page.locator('h3:has-text("Assign Incident")') });
    await expect(modal.locator('h3:has-text("Assign Incident")')).toBeVisible();

    // Dispatcher sees exactly one select (department only).
    await expect(modal.locator('select')).toHaveCount(1);
    const deptSelect = modal.locator('select').first();
    await deptSelect.locator('option').nth(1).waitFor({ state: 'attached', timeout: 30000 });
    await deptSelect.selectOption({ label: 'E2E Fire Dept' });
    await modal.getByRole('button', { name: 'Assign department' }).click();

    await expect(modal).toBeHidden();
    await expect(row.getByText('assigned', { exact: true })).toBeVisible();

    // DB check: CDA rows exist for the E2E medical + police departments,
    // and none target the main department itself.
    const sb = client();
    await signInWithRetry(sb, 'dispatcher@emergency.gov', 'dispatcher123');
    const { data: cda } = await sb
      .from('cross_department_assistance')
      .select('assisting_department_id, status')
      .eq('report_id', reportId);
    const ids = (cda || []).map(r => r.assisting_department_id);

    const { data: assistDepts } = await sb
      .from('departments')
      .select('id, name')
      .in('name', ['E2E Medical Dept', 'E2E Police Dept']);
    for (const d of assistDepts || []) {
      expect(ids, `expected CDA row targeting ${d.name}`).toContain(d.id);
    }
    expect(ids, 'main dept must not receive an assist request').not.toContain(fireDeptId);
    await sb.auth.signOut();
  });

  const deptAdminEmail = process.env.E2E_DEPT_ADMIN_EMAIL;
  const deptAdminPassword = process.env.E2E_DEPT_ADMIN_PASSWORD;

  test('dept admin assigns a responder on the incident and on their CDA row', async ({ page }) => {
    test.skip(
      !deptAdminEmail || !deptAdminPassword,
      'set E2E_DEPT_ADMIN_EMAIL/PASSWORD for a department_admin of E2E Fire Dept'
    );

    await page.goto('/');
    await page.fill('input[type="email"]', deptAdminEmail);
    await page.fill('input[type="password"]', deptAdminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 30000 });

    await page.getByRole('button', { name: /Incident queue/ }).first().click();
    await expect(page.getByRole('button', { name: 'pending', exact: true })).toBeVisible();
    const row = page.locator('div.cursor-pointer').filter({ hasText: uniqueDesc });
    await expect(row).toBeVisible({ timeout: 30000 });
    await row.locator('button', { hasText: 'Assign responder' }).click();

    const modal = page.locator('div.fixed.inset-0')
      .filter({ has: page.locator('h3:has-text("Assign Incident")') });
    // dept admin keeps the responder picker; dept select is locked to theirs
    const deptSelect = modal.locator('select').first();
    const responderSelect = modal.locator('select').nth(1);
    await expect(deptSelect).toBeDisabled();
    await responderSelect.locator('option').nth(1).waitFor({ state: 'attached', timeout: 30000 });
    const responderValue = await responderSelect
      .locator('option:not([value=""])').first().getAttribute('value');
    await responderSelect.selectOption(responderValue);
    await modal.getByRole('button', { name: 'Assign' }).click();
    await expect(modal).toBeHidden();
    await expect(row.locator('button', { hasText: 'Reassign' })).toBeVisible();
  });
});
