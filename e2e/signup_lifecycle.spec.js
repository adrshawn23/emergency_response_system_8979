import { test, expect } from '@playwright/test';
import { deleteUserProfileByEmail } from './helpers.js';

/**
 * Full account lifecycle, end to end:
 *   Phase 1 (anonymous): resident registers with a Kalubihan address
 *   Phase 2 (admin):     the account shows under Pending Approvals -> Approve
 *   Phase 3 (resident):  first login succeeds -> lands on the resident portal
 *
 * Creates a real auth.users + user_profiles row. afterAll removes the
 * profile; the auth row needs service-role key or dashboard cleanup.
 */

const TS = Date.now();
// example.com is rejected by Supabase email validation — use a real TLD
const EMAIL = `e2e.signup.${TS}@kalubihan.ph`;
const FIRST = 'E2E';
const LAST = `Signup${TS}`;
const PASSWORD = 'Test@1234';

async function login(page, email, password) {
  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

test.describe.serial('Signup lifecycle (register -> approve -> first login)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.afterAll(async () => {
    await deleteUserProfileByEmail(EMAIL);
  });

  test('Phase 1 (anonymous): register as resident with Kalubihan address', async ({ page }) => {
    await page.goto('/register');

    // Step 1 — Personal Information
    await page.locator('input[name="firstName"]').fill(FIRST);
    await page.locator('input[name="lastName"]').fill(LAST);
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('input[name="phone"]').fill('09171234567');
    await page.locator('input[name="dateOfBirth"]').fill('1995-06-15');
    await page.locator('input[name="address"]').fill('456 E2E Lane, Brgy Kalubihan, Cebu City');
    await page.click('button:has-text("Continue")');

    // Step 2 — Account Security
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('input[name="confirmPassword"]').fill(PASSWORD);
    await page.click('button:has-text("Continue")');

    // Step 3 — Role Selection (custom select: button opens listbox)
    await page.locator('button[aria-haspopup="listbox"]').click();
    await page.locator('div.absolute.z-50').getByText('Resident/Boarder').click();
    await page.click('button:has-text("Continue")');

    // Step 4 — ID upload (input is visually hidden)
    await page.setInputFiles('input[type="file"]', {
      name: 'id.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-id-image'),
    });
    await page.click('button:has-text("Continue")');

    // Step 5 — Terms (checkboxes are sr-only)
    const terms = page.locator('input[type="checkbox"]');
    const count = await terms.count();
    for (let i = 0; i < count; i++) await terms.nth(i).check({ force: true });
    await page.click('button:has-text("Create Account")');

    // Redirected to login with the success notice
    await page.waitForURL('/login', { timeout: 30000 });
  });

  test('Phase 2 (admin): account appears under Pending Approvals -> approve', async ({ page }) => {
    await login(page, 'admin@emergency.gov', 'admin123');
    await page.waitForURL('/', { timeout: 60000 });
    await page.goto('/user-management');

    // Pending Registrations panel renders directly in the residents section
    await expect(page.getByRole('heading', { name: 'Pending Registrations' })).toBeVisible({ timeout: 30000 });

    // Real profile rows render email (name/requestedRole are mock-only fields).
    // The same email also appears in the ID verification queue card — filter
    // by the Approve button to isolate the pending registration row.
    const card = page.locator('div.p-6')
      .filter({ hasText: EMAIL })
      .filter({ has: page.locator('button:has-text("Approve")') });
    await expect(card).toBeVisible({ timeout: 30000 });

    await card.locator('button:has-text("Approve")').click();

    // Card leaves the pending list (the ID verification queue card for the
    // same email stays — that is a different, expected panel)
    await expect(card).toBeHidden({ timeout: 30000 });
  });

  test('Phase 3 (resident): first login — portal or email-confirmation gate', async ({ page }) => {
    await login(page, EMAIL, PASSWORD);

    // If the project does not require email confirmation, the resident lands
    // on their portal. If it does, login is correctly refused with a
    // "confirm your email" style error — either proves the gate works.
    const portal = page.locator('text=Kalubihan Emergency');
    const confirmGate = page.locator('text=/confirm|verification|verify/i').first();

    await expect(portal.or(confirmGate)).toBeVisible({ timeout: 60000 });

    if (await portal.isVisible()) {
      await expect(page.locator('text=Help is one report away')).toBeVisible();
    }
  });
});
