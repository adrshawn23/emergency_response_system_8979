import { test, expect } from '@playwright/test';

/**
 * Registration service-area gate:
 * a resident's address must be inside Barangay Kalubihan before the
 * account can proceed to (and through) approval.
 *
 * Both tests stop at step 1/2 — no account is created, so no auth or
 * profile cleanup is needed.
 */

async function fillStep1(page, address) {
  await page.goto('/register');
  await page.getByLabel('First Name').fill('Area');
  await page.getByLabel('Last Name').fill('Check');
  await page.getByLabel('Email Address').fill('area.check@example.com');
  await page.getByLabel('Phone Number').fill('09171234567');
  await page.getByLabel('Date of Birth').fill('1995-06-15');
  await page.locator('input[name="address"]').fill(address);
  await page.click('button:has-text("Continue")');
}

test.describe('Registration: address must be within Barangay Kalubihan', () => {
  test('non-Kalubihan address is blocked at step 1', async ({ page }) => {
    await fillStep1(page, '123 Mango Street, Labangon, Cebu City');

    await expect(
      page.locator('text=Address must be within Barangay Kalubihan')
    ).toBeVisible();
    // Still on step 1 — cannot advance
    await expect(page.locator('text=Step 1 of 5')).toBeVisible();
  });

  test('Kalubihan address advances to step 2', async ({ page }) => {
    await fillStep1(page, 'Sitio Riverside, Brgy Kalubihan, Cebu City');

    await expect(page.getByRole('heading', { name: /Step 2 of 5/ })).toBeVisible();
    // No address error was raised
    await expect(
      page.locator('text=Address must be within Barangay Kalubihan')
    ).toBeHidden();
  });
});
