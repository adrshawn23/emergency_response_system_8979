import { test, expect } from '@playwright/test';
import { deleteReportsByContent } from './helpers.js';

/**
 * End-to-End Incident Workflow (TESTING.md Tests 3-5)
 *
 * Full lifecycle: responder joins department -> dispatcher creates incident
 * -> dispatcher assigns incident -> responder acknowledges -> responder resolves.
 * Phases run serially and share state via module variables.
 */
test.describe.serial('End-to-End Incident Workflow', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

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

    // Prefer the stable seed department 'Fire Department' — picking "the first
    // card" is racy because a parallel test may have created (and will delete)
    // a temp department that happens to sort first.
    let deptCard = page.locator('div.rounded-2xl')
      .filter({ has: page.locator('h4.font-bold:has-text("Fire Department")') });

    // Fallback: create a dedicated department if the seed is absent
    if (!(await deptCard.count())) {
      if (!(await page.locator('h4.font-bold:has-text("E2E Workflow Department")').count())) {
        await page.click('button:has-text("Create Department")');
        await page.getByLabel('Department Name').fill('E2E Workflow Department');
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

    // Close modal and sign out (dashboard renders a desktop-sidebar and a
    // mobile bottom-nav sign-out button — .first() picks the visible desktop one)
    await modal.locator('div.border-b button').click();
    await page.locator('button[aria-label="Sign out"]').first().click();
    await page.waitForURL('/login', { timeout: 30000 });
  });

  test('Phase 2 (dispatcher): create incident and assign it to the responder', async ({ page }) => {
    // Login as dispatcher
    await page.goto('/');
    await page.fill('input[type="email"]', 'dispatcher@emergency.gov');
    await page.fill('input[type="password"]', 'dispatcher123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 30000 });
    await expect(page.getByRole('heading', { name: /Command Center/ })).toBeVisible();

    // Create a new incident with a unique description
    await page.click('text=New incident');
    await page.getByLabel('Emergency type').selectOption('fire');
    await page.getByLabel('Priority').selectOption('high');
    await page.getByLabel('Incident location').fill('456 Workflow Avenue');
    await page.getByLabel('What is happening?').fill(uniqueDesc);
    await page.click('button:has-text("Submit report")');
    await expect(page.locator('h3:has-text("Report submitted")')).toBeVisible();

    // Go to the incident queue and find the new incident row
    await page.click('text=Incident queue');
    const row = page.locator('div.cursor-pointer').filter({ hasText: uniqueDesc });
    await expect(row).toBeVisible();
    await expect(row.getByText('pending', { exact: true })).toBeVisible();

    // Open the assign modal for this incident
    await row.locator('button', { hasText: 'Assign' }).click();
    const modal = page.locator('div.fixed.inset-0')
      .filter({ has: page.locator('h3:has-text("Assign Incident")') });
    await expect(modal.locator('h3:has-text("Assign Incident")')).toBeVisible();

    const deptSelect = modal.locator('select').first();
    const responderSelect = modal.locator('select').nth(1);

    // Wait for the modal's async fetches to finish: departments load first,
    // then responders (unfiltered until a department is chosen). NOTE: <option>
    // elements are never 'visible' in Playwright terms, so wait for 'attached'.
    await deptSelect.locator('option').nth(1).waitFor({ state: 'attached', timeout: 30000 });
    await responderSelect.locator('option').nth(1).waitFor({ state: 'attached', timeout: 30000 });

    // Many test departments share the same name, so match by unique option
    // value (department id) rather than label. For each department, the
    // responder select re-filters to that department's members.
    const deptValues = await deptSelect.locator('option').evaluateAll(opts =>
      opts.map(o => o.getAttribute('value')).filter(Boolean)
    );

    let deptFound = false;
    for (const v of deptValues) {
      await deptSelect.selectOption(v);
      // let React re-render the filtered responder options
      await page.waitForTimeout(300);
      // a real responder option has a non-empty value; the placeholder's is ''
      if ((await responderSelect.locator('option:not([value=""])').count()) > 0) {
        deptFound = true;
        break;
      }
    }
    expect(deptFound, `responder "${responderName}" not found under any department`).toBe(true);

    // Select the responder and confirm assignment
    const responderValue = await responderSelect
      .locator('option:not([value=""])').first().getAttribute('value');
    await responderSelect.selectOption(responderValue);
    await modal.getByRole('button', { name: 'Assign' }).click();

    // Modal closes and the queue row reflects the assigned status
    await expect(modal).toBeHidden();
    await expect(row.getByText('assigned', { exact: true })).toBeVisible();
    await expect(row.locator('button', { hasText: 'Resolve' })).toBeVisible();

    // Sign out (two sign-out buttons exist: desktop sidebar + mobile nav)
    await page.locator('button[aria-label="Sign out"]').first().click();
    await page.waitForURL('/login', { timeout: 30000 });
  });

  test('Phase 3 (responder): acknowledge and resolve the incident', async ({ page }) => {
    // Login as responder - lands directly on the Response board
    await page.goto('/');
    await page.fill('input[type="email"]', 'responder@emergency.gov');
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
