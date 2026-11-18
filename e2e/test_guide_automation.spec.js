import { test, expect } from '@playwright/test';
import { deleteReportsByContent, deleteDepartmentsByName, EVIDENCE_PNG } from './helpers.js';

/**
 * Automated tests based on TESTING.md
 */

const TEST_INCIDENT_DESC = 'Test incident with image upload';
let createdDeptName = null;

test.describe('Manual Test Automation', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    // The 'new' composer auto-captures GPS; submit stays disabled without it.
    geolocation: { latitude: 10.2968, longitude: 123.8979 },
    permissions: ['geolocation'],
  });
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

    // 4. Fill in details (unique name so repeats don't collide).
    // Department Type is required — it's the same custom listbox Select used
    // by the register flow.
    createdDeptName = `Test Department ${Date.now()}`;
    await page.getByLabel('Department Name').fill(createdDeptName);
    await page.getByLabel('Department Type').click();
    await page.locator('div.absolute.z-50').getByText('Fire Department').click();
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

    // 8. Click "Assign" on the first assignable member row — for a new,
    // empty department the modal only lists dept-less responders/admins, so
    // any row with an Assign button works. Deleting the department afterward
    // restores the member's null department_id, so no fixture is disturbed.
    const memberRow = modal.locator('div.p-3.border')
      .filter({ has: page.getByText('Assign', { exact: true }) }).first();
    await expect(memberRow).toBeVisible({ timeout: 15000 });
    await memberRow.getByText('Assign', { exact: true }).click();
    // The row's button flips Assign→Remove — re-locate instead of reusing
    // memberRow (its Assign filter no longer matches after the click).
    await expect(modal.locator('div.p-3.border')
      .filter({ has: page.getByText('Remove', { exact: true }) }).first())
      .toBeVisible({ timeout: 30000 });

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

    // 2. Go to the composer — /emergency-report mounts the dashboard 'new'
    // section (GPS-only location, native selects, 'New incident report').
    await page.goto('/emergency-report');
    await expect(page.getByRole('heading', { level: 2, name: 'New incident report' })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=Current GPS location captured')).toBeVisible({ timeout: 30000 });

    // 3. Type/priority are native selects (defaults fire/high); description
    // is the 'What is happening?' textarea.
    await page.getByLabel('Emergency type').selectOption('fire');
    await page.getByLabel('Priority').selectOption('high');
    await page.getByLabel('What is happening?').fill('Test incident with image upload');

    // 4. Upload an image as evidence — preview uses the file name as alt.
    await page.setInputFiles('input[type="file"]', EVIDENCE_PNG);
    await expect(page.locator('img[alt="evidence.png"]')).toBeVisible();

    // 5. Submit — the button enables once GPS coords land.
    const submit = page.getByRole('button', { name: /Submit report|Waiting for GPS/ });
    await page.waitForFunction(el => el && !el.disabled, await submit.elementHandle(), { timeout: 30000 });
    await submit.click();

    // 6. Verify success state — the composer's 'Report submitted' heading.
    await expect(page.getByRole('heading', { name: 'Report submitted' })).toBeVisible({ timeout: 30000 });

    // 7. Sign out
    await page.goto('/login');
  });

});

