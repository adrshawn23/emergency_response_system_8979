import { test, expect } from '@playwright/test';
import { deleteReportsByContent, assignResponderToReport, submitIncident } from './helpers.js';

/**
 * End-to-End Incident Workflow (TESTING.md Tests 3-5)
 *
 * Full lifecycle: responder joins department -> dispatcher creates incident
 * -> dispatcher assigns incident -> responder acknowledges -> responder resolves.
 * Phases run serially and share state via module variables.
 */
test.describe.serial('End-to-End Incident Workflow', () => {
  test.use({
  viewport: { width: 1280, height: 800 },
  // The 'new' composer auto-captures GPS; submit stays disabled without it.
  geolocation: { latitude: 10.2968, longitude: 123.8979 },
  permissions: ['geolocation'],
});

  const uniqueDesc = `E2E workflow incident ${Date.now()}`;
  let departmentName = null;
  let responderName = null;

  // Remove the incident created by Phase 2 (even if later phases fail),
  // so repeated runs don't pile up test incidents in the queue.
  test.afterAll(async () => {
    await deleteReportsByContent(uniqueDesc);
  });

  test('Phase 1 (admin): ensure responder belongs to a department', async ({ page }) => {
    // Login as admin
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@emergency.gov');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 30000 });
    await expect(page.getByRole('heading', { name: /Command Center/ })).toBeVisible();

    // Open Departments section
    await page.click('text=Departments');
    const deptList = page.locator('h4.font-bold').or(page.getByText('No departments found'));
    await expect(deptList.first()).toBeVisible();

    // Prefer the stable barangay department 'Health and First Aid Team' —
    // picking "the first card" is racy because a parallel test may have
    // created (and will delete) a temp department that happens to sort first.
    let deptCard = page.locator('div.rounded-2xl')
      .filter({ has: page.locator('h4.font-bold:has-text("Health and First Aid Team")') });

    // Fallback: create a dedicated department if the seed is absent
    if (!(await deptCard.count())) {
      if (!(await page.locator('h4.font-bold:has-text("E2E Workflow Department")').count())) {
        await page.click('button:has-text("Create Department")');
        await page.getByLabel('Department Name').fill('E2E Workflow Department');
        // Department Type is required — custom listbox Select
        await page.getByLabel('Department Type').click();
        await page.locator('div.absolute.z-50').getByText('Fire Department').click();
        await page.getByLabel('Description').fill('Created by end-to-end workflow test');
        await page.locator('button:has-text("Create Department")').last().click();
      }
      deptCard = page.locator('div.rounded-2xl')
        .filter({ has: page.locator('h4.font-bold:has-text("E2E Workflow Department")') });
      await expect(deptCard).toBeVisible();
    }

    departmentName = (await deptCard.locator('h4.font-bold').textContent()).trim();

    // Open "Assign members" for that department
    await deptCard.locator('text=Assign members').click();
    const modal = page.locator('div.fixed.inset-0');
    await expect(modal.locator('h3:has-text("Assign members to")')).toBeVisible();

    // Find the responder row (only row containing the role text "responder")
    const responderRow = modal.locator('div.p-3.border').filter({ hasText: 'responder' }).first();
    await expect(responderRow).toBeVisible();
    responderName = (await responderRow.locator('p.font-medium').textContent()).trim();

    // Assign responder to the department (idempotent if already a member)
    const assignBtn = responderRow.getByText('Assign', { exact: true });
    if (await assignBtn.count()) {
      await assignBtn.click();
      await expect(responderRow.getByText('Remove', { exact: true })).toBeVisible({ timeout: 30000 });
    }

    // Close modal and sign out. Both aria-label matches resolve to the
    // hidden mobile-nav button at desktop widths, so clicking is flaky —
    // clear the supabase session keys and navigate to /login instead.
    await modal.locator('div.border-b button').click();
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k));
    });
    await page.goto('/login');
    await page.waitForURL('/login', { timeout: 30000 });
  });

  test('Phase 2 (dispatcher): create incident and assign the main department', async ({ page }) => {
    // Login as dispatcher
    await page.goto('/');
    await page.fill('input[type="email"]', 'dispatcher@emergency.gov');
    await page.fill('input[type="password"]', 'dispatcher123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 30000 });
    await expect(page.getByRole('heading', { name: /Command Center/ })).toBeVisible();

    // Create a new incident with a unique description — the redesigned
    // composer's type/priority buttons are clicked inside submitIncident.
    await page.goto('/emergency-report');
    await expect(page.getByRole('heading', { level: 2, name: 'New incident report' })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=Current GPS location captured')).toBeVisible({ timeout: 30000 });
    await submitIncident(page, { description: uniqueDesc });

    // Go to the incident queue — the sidebar nav button opens the dashboard
    // 'queue' section where 'Status / action' is the table header.
    await page.goto('/');
    await page.click('button[title="Incident queue"]');
    await expect(page.getByText('Status / action')).toBeVisible({ timeout: 30000 });
    const row = page.locator('div.cursor-pointer').filter({ hasText: uniqueDesc });
    await expect(row).toBeVisible();
    await expect(row.getByText('pending', { exact: true })).toBeVisible();

    // Open the assign modal for this incident
    await row.locator('button', { hasText: 'Assign' }).click();
    const modal = page.locator('div.fixed.inset-0')
      .filter({ has: page.locator('h3:has-text("Assign Incident")') });
    await expect(modal.locator('h3:has-text("Assign Incident")')).toBeVisible();

    const deptSelect = modal.locator('select').first();

    // Dispatch-gate flow: the dispatcher assigns the MAIN department only —
    // there is exactly one select and no responder picker. Responder
    // selection belongs to each department's admin (Phase 2.5).
    await expect(modal.locator('select')).toHaveCount(1);
    await deptSelect.locator('option').nth(1).waitFor({ state: 'attached', timeout: 30000 });

    // Pick the department Phase 1 placed the responder into.
    await deptSelect.selectOption({ label: departmentName });
    await modal.getByRole('button', { name: 'Assign department' }).click();

    // Modal closes and the queue row reflects the assigned status
    await expect(modal).toBeHidden();
    await expect(row.getByText('assigned', { exact: true })).toBeVisible();
    await expect(row.locator('button', { hasText: 'Resolve' })).toBeVisible();

    // Sign out — same session-clear approach as Phase 1.
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k));
    });
    await page.goto('/login');
    await page.waitForURL('/login', { timeout: 30000 });
  });

  // In production this step is the department_admin picking a responder from
  // their own department. No dept-admin seed account exists, so the admin
  // API writes the same fields (assigned_to + assigned_department_id).
  test('Phase 2.5 (dept admin stand-in): assign the responder via API', async () => {
    await assignResponderToReport(uniqueDesc, 'healthandfirstaidteam.responder1@emergency.gov');
  });

  test('Phase 3 (responder): acknowledge and resolve the incident', async ({ page }) => {
    // Login as responder - lands directly on the Response board
    await page.goto('/');
    await page.fill('input[type="email"]', 'healthandfirstaidteam.responder1@emergency.gov');
    await page.fill('input[type="password"]', 'responder123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 30000 });
    await expect(page.locator('h1:has-text("Response board")')).toBeVisible();

    // The assigned incident appears on the response board
    const card = page.locator('article').filter({ hasText: uniqueDesc });
    await expect(card).toBeVisible();
    await expect(card.getByText('assigned', { exact: true })).toBeVisible();

    // Acknowledge -> status becomes in-progress
    await card.getByRole('button', { name: 'Acknowledge' }).click();
    await expect(card.getByRole('button', { name: 'Resolve' })).toBeVisible();
    await expect(card.getByText('in-progress', { exact: true })).toBeVisible();

    // Resolve requires photo proof via the incident modal
    await card.getByRole('button', { name: 'Resolve' }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await modal.locator('input[type="file"]').setInputFiles({
      name: 'proof.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
    });
    await modal.getByRole('button', { name: 'Resolve', exact: true }).click();
    await expect(modal).toBeHidden({ timeout: 30000 });
    await expect(card.getByText('resolved', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(card.getByRole('button', { name: 'Resolve' })).toBeHidden();
  });
});
