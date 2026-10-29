import { test, expect } from '@playwright/test';
import { deleteReportsByContent } from './helpers.js';

/**
 * Complete incident lifecycle, end to end:
 *   Phase 1 (resident):   submits an emergency report -> lands pending
 *   Phase 2 (dispatcher): sees it in the queue -> assigns dept + responder -> 'assigned'
 *   Phase 3 (responder):  acknowledges -> 'in-progress' -> resolves -> 'resolved'
 *   Phase 4 (dispatcher): incident appears under the resolved filter
 *
 * Phases run serially and share the incident description via a module constant.
 * The resident owns the report, so cleanup signs in as the resident.
 */

const DESC = `E2E lifecycle ${Date.now()}`;

async function login(page, email, password) {
  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 60000 });
}

async function signOut(page) {
  await page.locator('button[aria-label="Sign out"], button[title="Sign out"]').first().click();
  await page.waitForURL('/login', { timeout: 30000 });
}

test.describe.serial('Full incident lifecycle (resident -> dispatch -> responder)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.afterAll(async () => {
    await deleteReportsByContent(DESC, 'resident@example.com', 'resident123');
  });

  test('Phase 1 (resident): create incident', async ({ page }) => {
    await login(page, 'resident@example.com', 'resident123');

    // ResidentHome -> "Report an emergency" -> /emergency-report (section 'new')
    await Promise.all([
      page.waitForURL('/emergency-report'),
      page.getByRole('button', { name: 'Report an emergency' }).click(),
    ]);

    await page.getByLabel('Emergency type').selectOption('fire');
    await page.getByLabel('Priority').selectOption('high');
    await page.getByLabel('Incident location').fill('789 Lifecycle Road');
    await page.getByLabel('What is happening?').fill(DESC);
    await page.click('button:has-text("Submit report")');

    await expect(page.getByRole('heading', { name: 'Report submitted' })).toBeVisible({ timeout: 30000 });
    await signOut(page);
  });

  test('Phase 2 (dispatcher): incident lands pending in queue -> assign responder', async ({ page }) => {
    await login(page, 'dispatcher@emergency.gov', 'dispatcher123');
    await page.click('button[title="Incident queue"]');

    const row = page.locator('div.grid.cursor-pointer').filter({ hasText: DESC }).first();
    await expect(row).toBeVisible({ timeout: 30000 });
    await expect(row.locator('span.capitalize')).toHaveText('pending');

    // Open the assign modal
    await row.locator('button:has-text("Assign")').click();
    const modal = page.locator('div.fixed.inset-0')
      .filter({ has: page.locator('h3:has-text("Assign Incident")') });
    await expect(modal.locator('h3:has-text("Assign Incident")')).toBeVisible();

    const deptSelect = modal.locator('select').first();
    const responderSelect = modal.locator('select').nth(1);

    // Wait for async fetches: departments first, then responders populate
    // per selected department. <option> elements are never 'visible', so
    // wait for 'attached'.
    await deptSelect.locator('option').nth(1).waitFor({ state: 'attached', timeout: 30000 });
    await responderSelect.locator('option').nth(1).waitFor({ state: 'attached', timeout: 30000 });

    // Scan departments until one yields responder options
    const deptValues = await deptSelect.locator('option').evaluateAll(opts =>
      opts.map(o => o.getAttribute('value')).filter(Boolean)
    );
    let deptFound = false;
    for (const v of deptValues) {
      await deptSelect.selectOption(v);
      await page.waitForTimeout(300); // React re-filters responder options
      if ((await responderSelect.locator('option:not([value=""])').count()) > 0) {
        deptFound = true;
        break;
      }
    }
    expect(deptFound, 'no department has assignable responders').toBe(true);

    const responderValue = await responderSelect
      .locator('option:not([value=""])').first().getAttribute('value');
    await responderSelect.selectOption(responderValue);
    await modal.getByRole('button', { name: 'Assign' }).click();

    // Modal closes; the row now shows 'assigned' and offers Resolve
    await expect(modal).toBeHidden();
    await expect(row.locator('span.capitalize')).toHaveText('assigned', { timeout: 30000 });
    await expect(row.locator('button:has-text("Resolve")')).toBeVisible();

    await signOut(page);
  });

  test('Phase 3 (responder): acknowledge then resolve', async ({ page }) => {
    await login(page, 'responder@emergency.gov', 'responder123');
    await expect(page.locator('h1:has-text("Response board")')).toBeVisible({ timeout: 30000 });

    const card = page.locator('article').filter({ hasText: DESC });
    await expect(card).toBeVisible({ timeout: 30000 });
    await expect(card.getByText('assigned', { exact: true })).toBeVisible();

    // Acknowledge -> in-progress
    await card.getByRole('button', { name: 'Acknowledge' }).click();
    await expect(card.getByText('in-progress', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(card.getByRole('button', { name: 'Resolve' })).toBeVisible();

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

    await signOut(page);
  });

  test('Phase 4 (dispatcher): incident shows resolved in queue', async ({ page }) => {
    await login(page, 'dispatcher@emergency.gov', 'dispatcher123');
    await page.click('button[title="Incident queue"]');
    await page.click('button:has-text("resolved")');

    const row = page.locator('div.grid.cursor-pointer').filter({ hasText: DESC }).first();
    await expect(row).toBeVisible({ timeout: 30000 });
    await expect(row.locator('span.capitalize')).toHaveText('resolved');
    // Resolved rows no longer offer Assign/Resolve actions
    await expect(row.locator('button:has-text("Resolve")')).toBeHidden();

    await signOut(page);
  });
});
