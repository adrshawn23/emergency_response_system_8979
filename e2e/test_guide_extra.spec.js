import { test, expect } from '@playwright/test';
import {
  deleteReportsByContent,
  ensurePendingVerification,
  createReport,
} from './helpers.js';

/**
 * Remaining TESTING.md flows not covered by workflow.spec.js /
 * test_guide_automation.spec.js:
 *   Test 6  - Cross-department assistance modal
 *   Test 7  - Emergency contacts add/delete
 *   Test 10 - Community verification section
 *   Test 11 - Duplicate name prevention (rejection only)
 *   Tests 13-15 - ID verification review actions
 *   Test 16 - Queue badge count
 *   Test 17 - Incident status filtering
 *   Test 18 - Resolve incident from queue
 */

const RESOLVE_DESC = `E2E queue resolve ${Date.now()}`;

async function login(page, email, password) {
  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 60000 });
}

test.describe('TESTING.md remaining tests', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Test 6: Cross-department assistance modal', async ({ page }) => {
    await login(page, 'dispatcher@emergency.gov', 'dispatcher123');
    await page.click('button[title="Incident queue"]');
    await page.waitForSelector('div.grid.cursor-pointer', { timeout: 30000 });

    // Any non-resolved incident row has the assistance (users) icon button
    const assistBtn = page.locator('button[title="Request cross-department assistance"]').first();
    await expect(assistBtn).toBeVisible({ timeout: 30000 });
    await assistBtn.click();

    const modal = page.locator('div.fixed.inset-0');
    await expect(modal.locator('h3:has-text("Request Assistance")')).toBeVisible();

    // Select the first department checkbox, then Request
    const checkbox = modal.locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    await modal.locator('button:has-text("Request")').click();

    // Modal closes after request
    await expect(modal.locator('h3:has-text("Request Assistance")')).toBeHidden();

    await page.goto('/login');
  });

  test('Test 7: Emergency contacts add and delete', async ({ page }) => {
    await login(page, 'dispatcher@emergency.gov', 'dispatcher123');
    await page.click('button[title="Profile"]');

    await page.click('button:has-text("Add Contact")');
    const modal = page.locator('div.fixed.inset-0');
    await expect(modal.locator('h3:has-text("Add Emergency Contact")')).toBeVisible();

    const contactName = `John Doe ${Date.now()}`;
    await modal.locator('input[placeholder="Contact name"]').fill(contactName);
    await modal.locator('input[placeholder="e.g., Spouse, Parent, Friend"]').fill('Spouse');
    await modal.locator('input[placeholder="Phone number"]').fill('09948270026');
    await modal.locator('button:has-text("Add Contact")').click();

    // Contact appears in list
    const row = page.locator('div.rounded-lg.border').filter({ hasText: contactName });
    await expect(row).toBeVisible();

    // Delete removes it
    await row.locator('button').click();
    await expect(row).toBeHidden();

    await page.goto('/login');
  });

  test('Test 10: Community verification section', async ({ page }) => {
    await login(page, 'admin@emergency.gov', 'admin123');
    await page.click('button[title="Residents & review"]');

    await expect(page.locator('h3:has-text("Community verification")')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=Duplicate prevention enabled')).toBeVisible();
    await page.click('button:has-text("View duplicates")');

    await page.goto('/login');
  });

  test('Test 16/17: Queue badge count and status filtering', async ({ page }) => {
    await login(page, 'dispatcher@emergency.gov', 'dispatcher123');
    await page.click('button[title="Incident queue"]');
    await page.waitForSelector('button:has-text("pending")', { timeout: 30000 });

    // Sidebar badge on "Incident queue" must equal the pending row count
    await page.click('button:has-text("pending")');
    const badgeText = (await page.locator('button[title="Incident queue"] span').last().textContent()).trim();
    const pendingRows = await page.locator('div.grid.cursor-pointer').count();
    expect(Number(badgeText)).toBe(pendingRows);

    // Each status filter shows only matching rows
    for (const status of ['assigned', 'in progress', 'resolved']) {
      await page.click(`button:has-text("${status}")`);
      const rows = page.locator('div.grid.cursor-pointer');
      const n = await rows.count();
      for (let i = 0; i < n; i++) {
        await expect(rows.nth(i).locator('span.capitalize').last()).toHaveText(status);
      }
    }

    await page.goto('/login');
  });

  test('Test 18: Resolve incident from queue', async ({ page }) => {
    // Seed an assigned incident owned by dispatcher (deletable after)
    await createReport(RESOLVE_DESC, 'assigned');

    await login(page, 'dispatcher@emergency.gov', 'dispatcher123');
    await page.click('button[title="Incident queue"]');
    await page.click('button:has-text("assigned")');

    const row = page.locator('div.grid.cursor-pointer').filter({ hasText: RESOLVE_DESC }).first();
    await expect(row).toBeVisible({ timeout: 30000 });
    await row.locator('button:has-text("Resolve")').click();

    // Resolved rows leave the 'assigned' filter — verify under 'resolved'
    await expect(row).toBeHidden({ timeout: 30000 });
    await page.click('button:has-text("resolved")');
    const resolvedRow = page.locator('div.grid.cursor-pointer').filter({ hasText: RESOLVE_DESC }).first();
    await expect(resolvedRow.locator('span.capitalize')).toHaveText('resolved', { timeout: 30000 });

    await deleteReportsByContent(RESOLVE_DESC);
    await page.goto('/login');
  });
});

test.describe('Test 11: Duplicate name prevention', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('rejects registration with an existing name', async ({ page }) => {
    await page.goto('/register');

    // Step 1 - Personal Information ('Shawn Michael Dagatan' is an existing profile)
    await page.locator('input[name="firstName"]').fill('Shawn Michael');
    await page.locator('input[name="lastName"]').fill('Dagatan');
    await page.locator('input[name="email"]').fill(`dup${Date.now()}@example.com`);
    await page.locator('input[name="phone"]').fill('09948270026');
    await page.locator('input[name="dateOfBirth"]').fill('1990-01-01');
    await page.locator('input[name="address"]').fill('123 Test Street, Brgy Kalubihan, Cebu City');
    await page.click('button:has-text("Continue")');

    // Step 2 - Account Security (needs upper, lower, digit, special char)
    await page.locator('input[name="password"]').fill('Test@1234');
    await page.locator('input[name="confirmPassword"]').fill('Test@1234');
    await page.click('button:has-text("Continue")');

    // Step 3 - Role Selection (custom Select: button opens listbox;
    // scope to the visible dropdown — a hidden sr-only <option> matches text= too)
    await page.locator('button[aria-haspopup="listbox"]').click();
    await page.locator('div.absolute.z-50').getByText('Resident/Boarder').click();
    await page.click('button:has-text("Continue")');

    // Step 4 - Identity Verification (file input is visually hidden)
    await page.setInputFiles('input[type="file"]', {
      name: 'id.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-id-image'),
    });
    await page.click('button:has-text("Continue")');

    // Step 5 - Terms (checkbox inputs are sr-only, force-check)
    const terms = page.locator('input[type="checkbox"]');
    const count = await terms.count();
    for (let i = 0; i < count; i++) await terms.nth(i).check({ force: true });
    await page.click('button:has-text("Create Account")');

    // Duplicate-name rejection appears, no account created
    await expect(page.locator('text=already exists')).toBeVisible({ timeout: 30000 });
  });
});

test.describe.serial('ID verification review (Tests 13-15)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.beforeEach(async () => {
    await ensurePendingVerification();
  });

  const openReviewModal = async (page) => {
    await login(page, 'admin@emergency.gov', 'admin123');
    await page.click('button[title="Residents & review"]');
    const card = page.locator('div.rounded-lg.border')
      .filter({ hasText: 'OCR Confidence' })
      .filter({ hasText: 'pending' })
      .first();
    await expect(card).toBeVisible({ timeout: 30000 });
    await card.click();
    const modal = page.locator('div.fixed.inset-0');
    await expect(modal.locator('h3:has-text("Review ID Verification")')).toBeVisible();
    return modal;
  };

  test('Test 13: Approve & Activate', async ({ page }) => {
    const modal = await openReviewModal(page);
    await expect(modal.locator('text=OCR Confidence').first()).toBeVisible();
    await modal.locator('button:has-text("Approve & Activate")').click();
    await expect(modal).toBeHidden();
    await expect(page.locator('div.rounded-lg.border')
      .filter({ hasText: 'OCR Confidence' })
      .filter({ hasText: 'approved' }).first()).toBeVisible();
    await page.goto('/login');
  });

  test('Test 14: Reject', async ({ page }) => {
    const modal = await openReviewModal(page);
    await modal.locator('button:has-text("Reject")').click();
    await expect(modal).toBeHidden();
    await expect(page.locator('div.rounded-lg.border')
      .filter({ hasText: 'OCR Confidence' })
      .filter({ hasText: 'rejected' }).first()).toBeVisible();
    await page.goto('/login');
  });

  test('Test 15: Request Clarity', async ({ page }) => {
    const modal = await openReviewModal(page);
    await modal.locator('button:has-text("Request Clarity")').click();
    await expect(modal).toBeHidden();
    await expect(page.locator('div.rounded-lg.border')
      .filter({ hasText: 'OCR Confidence' })
      .filter({ hasText: 'needs_clarity' }).first()).toBeVisible();
    await page.goto('/login');
  });
});
