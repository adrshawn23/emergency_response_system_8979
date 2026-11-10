import { test, expect } from '@playwright/test';
import {
  deleteReportsByContent,
  ensurePendingVerification,
  createReport,
  createAssistanceRequest,
  deleteAssistanceRequests,
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

  test('Test 6: Cross-department assistance banner', async ({ page }) => {
    // The manual request modal is gone — CDA rows are created by the
    // auto-dispatch trigger on assignment (needs ≥2 depts, so seed the row
    // directly) and surface in the queue's amber banner.
    const desc = `E2E assist ${Date.now()}`;
    await createReport(desc, 'pending');
    await createAssistanceRequest(desc);

    await login(page, 'dispatcher@emergency.gov', 'dispatcher123');
    await page.click('button[title="Incident queue"]');

    await expect(page.locator('text=Assistance requests')).toBeVisible({ timeout: 30000 });
    // Banner row: report id, target dept, requester, pending status chip
    await expect(page.locator('text=requested by').first()).toBeVisible();

    await deleteAssistanceRequests();
    await deleteReportsByContent(desc);
    await page.goto('/login');
  });

  test('Test 7: Emergency contacts add and delete', async ({ page }) => {
    await login(page, 'dispatcher@emergency.gov', 'dispatcher123');
    await page.click('button[title="Profile"]');

    // Profile re-renders keep Playwright's stability check from settling — force it
    await page.locator('button:has-text("Add Contact")').click({ force: true });
    const modal = page.locator('div.fixed.inset-0');
    await expect(modal.locator('h3:has-text("Add Emergency Contact")')).toBeVisible();

    const contactName = `John Doe ${Date.now()}`;
    await modal.locator('input[placeholder="Contact name"]').fill(contactName);
    await modal.locator('input[placeholder="e.g., Spouse, Parent, Friend"]').fill('Spouse');
    await modal.locator('input[placeholder="Phone number"]').fill('09948270026');
    await modal.locator('button:has-text("Add Contact")').click();

    // Contact appears in list (the name also matches the parent card — take
    // the innermost row)
    const row = page.locator('div.flex.items-center.justify-between.rounded-lg.border')
      .filter({ hasText: contactName }).first();
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

    // Sidebar badge on "Incident queue" must equal the pending row count.
    // The badge query resolves before the filtered grid's rows land, so
    // poll the row count until it settles instead of sampling once.
    await page.click('button:has-text("pending")');
    // The badge is a nested span fed by pendingCount, which lands after the
    // reports fetch — wait for it to render before reading the number.
    const badge = page.locator('button[title="Incident queue"] span.rounded-full').first();
    await expect(badge).toBeVisible({ timeout: 30000 });
    const badgeNum = Number(await badge.textContent());
    const rows = page.locator('div.grid.cursor-pointer');
    await expect.poll(() => rows.count(), { timeout: 30000 }).toBe(badgeNum);

    // Each status filter shows only matching rows — the button text is
    // already formatted ('in progress' renders for the 'in-progress' value).
    for (const [filter, chip] of [['assigned', 'assigned'], ['in progress', 'in progress'], ['resolved', 'resolved']]) {
      await page.click(`button:has-text("${filter}")`);
      const rows = page.locator('div.grid.cursor-pointer');
      const n = await rows.count();
      for (let i = 0; i < n; i++) {
        await expect(rows.nth(i).locator('span.capitalize').last()).toHaveText(chip);
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
    await page.locator('input[name="email"]').fill(`dup${Date.now()}@kalubihan.ph`);
    await page.locator('input[name="phone"]').fill('09948270026');
    await page.locator('input[name="dateOfBirth"]').fill('1990-01-01');
    await page.locator('select[name="sitio"]').selectOption('Kalubihan Proper');
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

    // Step 4 - Emergency contacts (optional) + Terms checkboxes
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
    // Spec-003: pending rows live under the For Approval tab as row buttons
    // tagged 'pending' — the seeded row is the admin's own pending verification.
    await expect(page.getByRole('tab', { name: /For Approval/ })).toBeVisible({ timeout: 30000 });
    const row = page.getByRole('button', { name: /admin@emergency\.gov/ })
      .filter({ hasText: 'pending' }).first();
    await expect(row).toBeVisible({ timeout: 30000 });
    await row.click();
    const modal = page.locator('div.fixed.inset-0');
    await expect(modal.locator('h3:has-text("Review ID Verification")')).toBeVisible();
    return modal;
  };

  test('Test 13: Approve & Activate', async ({ page }) => {
    const modal = await openReviewModal(page);
    await modal.locator('button:has-text("Approve & Activate")').click();
    await expect(modal).toBeHidden();
    await page.getByRole('tab', { name: /Approved/ }).click();
    await expect(page.getByRole('button', { name: /admin@emergency\.gov/ })
      .filter({ hasText: 'approved' }).first()).toBeVisible({ timeout: 30000 });
    await page.goto('/login');
  });

  test('Test 14: Reject', async ({ page }) => {
    const modal = await openReviewModal(page);
    // Spec-003: a reviewer remark is required for Reject / Request clarity.
    await modal.locator('#reviewRemark').fill('E2E rejection — unclear document');
    await modal.locator('button:has-text("Reject")').click();
    await expect(modal).toBeHidden();
    await page.getByRole('tab', { name: /Rejected/ }).click();
    await expect(page.getByRole('button', { name: /admin@emergency\.gov/ })
      .filter({ hasText: 'rejected' }).first()).toBeVisible({ timeout: 30000 });
    await page.goto('/login');
  });

  test('Test 15: Request Clarity', async ({ page }) => {
    const modal = await openReviewModal(page);
    await modal.locator('#reviewRemark').fill('E2E clarity request — re-upload in good lighting');
    await modal.locator('button:has-text("Request Clarity")').click();
    await expect(modal).toBeHidden();
    await page.getByRole('tab', { name: /Returned/ }).click();
    await expect(page.getByRole('button', { name: /admin@emergency\.gov/ })
      .filter({ hasText: 'returned' }).first()).toBeVisible({ timeout: 30000 });
    await page.goto('/login');
  });
});
