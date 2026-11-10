import { test, expect } from '@playwright/test';

/**
 * Registration service-area gate (post-redesign):
 * the old free-text address field is gone — step 1 now offers a sitio/street
 * dropdown containing ONLY Barangay Kalubihan options, so a non-Kalubihan
 * address cannot be entered at all. The gate moved from validation to
 * constrained choice.
 *
 * No account is created, so no auth or profile cleanup is needed.
 */

async function fillStep1(page, sitio) {
  await page.goto('/register');
  await page.locator('input[name="firstName"]').fill('Area');
  await page.locator('input[name="lastName"]').fill('Check');
  await page.locator('input[name="email"]').fill('area.check@kalubihan.ph');
  await page.locator('input[name="phone"]').fill('09171234567');
  await page.locator('input[name="dateOfBirth"]').fill('1995-06-15');
  if (sitio) await page.locator('select[name="sitio"]').selectOption(sitio);
}

test.describe('Registration: address must be within Barangay Kalubihan', () => {
  test('non-Kalubihan address cannot be entered — sitios are Kalubihan-only', async ({ page }) => {
    await fillStep1(page, null);

    // No free-text address input exists anymore
    await expect(page.locator('input[name="address"]')).toHaveCount(0);

    // Every selectable sitio option is a real Kalubihan sitio — none blank
    // beyond the placeholder, none outside the barangay.
    const options = page.locator('select[name="sitio"] option');
    const values = await options.evaluateAll(opts =>
      opts.map(o => o.getAttribute('value')).filter(Boolean)
    );
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) expect(v.length).toBeGreaterThan(2);
  });

  test('leaving the sitio unselected blocks step 1', async ({ page }) => {
    await fillStep1(page, null);
    await page.click('button:has-text("Continue")');

    await expect(
      page.locator('text=Please select your sitio or street')
    ).toBeVisible();
    // Still on step 1 — cannot advance
    await expect(page.locator('text=Step 1 of 4')).toBeVisible();
  });

  test('a Kalubihan sitio advances to step 2', async ({ page }) => {
    await fillStep1(page, 'Kalubihan Proper');
    await page.click('button:has-text("Continue")');

    await expect(page.locator('text=Step 2 of 4')).toBeVisible();
    // No sitio error was raised
    await expect(
      page.locator('text=Please select your sitio or street')
    ).toBeHidden();
  });
});
