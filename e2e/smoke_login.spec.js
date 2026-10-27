import { test, expect } from '@playwright/test';

test('smoke: login page loads', async ({ page }) => {
  const response = await page.goto('/', {
    waitUntil: 'domcontentloaded'
  });

  console.log('Page URL:', page.url());
  console.log('HTTP Status:', response?.status());

  await expect(
    page.locator('input[type="email"]')
  ).toBeVisible({ timeout: 10000 });

  console.log('Login page is working!');
});
