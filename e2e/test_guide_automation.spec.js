import { test, expect } from '@playwright/test';
import { deleteReportsByContent, deleteDepartmentsByName } from './helpers.js';

/**
 * Automated tests based on TESTING.md
 */

const TEST_INCIDENT_DESC = 'Test incident with image upload';
let createdDeptName = null;

test.describe('Manual Test Automation', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // Safety net: if a test fails mid-way, remove whatever it created so
  // repeated runs don't accumulate duplicate departments/incidents.
  test.afterEach(async () => {
    if (createdDeptName) {
      await deleteDepartmentsByName(createdDeptName);
      createdDeptName = null;
    }
    await deleteReportsByContent(TEST_INCIDENT_DESC);
  });

  test('Test 1: Department Management', async ({ page }) => {
    // 1. Login as admin
    await page.fill('input[type="email"]', 'admin@emergency.gov');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 30000 });

    // 2. Click "Departments" in sidebar
    await page.click('text=Departments');

    // 3. Click "Create Department"
    await page.click('button:has-text("Create Department")');

    // 4. Fill in details (unique name so repeats don't collide)
    createdDeptName = `Test Department ${Date.now()}`;
    await page.getByLabel('Department Name').fill(createdDeptName);
    await page.getByLabel('Description').fill('Test department');

    // 5. Click "Create Department" in the modal
    // The sidebar button is visible too, so let's find the button within the modal explicitly.
    await page.locator('button:has-text("Create Department")').last().click();

    // 6. Verify department appears in list
    const card = page.locator('div.rounded-2xl')
      .filter({ has: page.locator(`h4:has-text("${createdDeptName}")`) });
    await expect(card).toBeVisible();

    // 7. Click "Assign members" on the new department
    await card.locator('text=Assign members').click();
    const modal = page.locator('div.fixed.inset-0');
    await expect(modal.locator('h3:has-text("Assign members to")')).toBeVisible();

    // 8. Click "Assign" next to the dispatcher (any user verifies the feature;
    // using the responder would race with the workflow spec, which owns the
    // responder's department membership while running in parallel)
    const dispatcherRow = modal.locator('div.p-3.border').filter({ hasText: 'dispatcher' }).first();
    await dispatcherRow.getByText('Assign', { exact: true }).click();
    await expect(dispatcherRow.getByText('Remove', { exact: true })).toBeVisible({ timeout: 30000 });

    // 9. Close the modal and verify member count updates to 1
    await modal.locator('div.border-b button').click();
    await expect(card.getByText('1 members')).toBeVisible();

    // 10. Clean up: delete the department via the UI trash button
    // (window.confirm must be accepted; deleting also unassigns the responder)
    page.once('dialog', d => d.accept());
    await card.locator('button.ml-4').click();
    await expect(page.locator(`h4:has-text("${createdDeptName}")`)).toBeHidden();

    // 11. Sign out
    await page.goto('/login');
  });

  test('Test 2: Incident Creation with Image Upload', async ({ page }) => {
    // 1. Login as dispatcher
    await page.fill('input[type="email"]', 'dispatcher@emergency.gov');
    await page.fill('input[type="password"]', 'dispatcher123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 30000 });

    // 2. Click "New incident" in sidebar
    await page.click('text=New incident');

    // 3. Fill in incident details (the form uses select dropdowns)
    await page.getByLabel('Emergency type').selectOption('fire');
    await page.getByLabel('Priority').selectOption('high');
    await page.getByLabel('Incident location').fill('123 Test Street');
    await page.getByLabel('What is happening?').fill('Test incident with image upload');

    // 4. Upload an image as evidence
    await page.setInputFiles('input[type="file"]', {
      name: 'evidence.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
    });
    await expect(page.locator('img[alt="evidence.png"]')).toBeVisible();

    // 5. Click "Submit report"
    await page.click('button:has-text("Submit report")');

    // 6. Verify success message with report ID appears
    await expect(page.locator('h3:has-text("Report submitted")')).toBeVisible();

    // 7. Sign out
    await page.goto('/login');
  });

});

