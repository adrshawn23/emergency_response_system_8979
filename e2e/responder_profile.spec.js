import { test, expect } from '@playwright/test';

/**
 * Regression: the responder Profile nav changes the URL to /profile but the
 * Dashboard used to short-circuit every section to ResponderView, so the
 * Response board kept rendering. Now /profile must show the profile section.
 */
test('responder can open their profile page from the response board', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="email"]', 'responder@emergency.gov');
  await page.fill('input[type="password"]', 'responder123');
  await page.click('button[type="submit"]');

  await expect(page.getByRole('heading', { name: 'Response board' })).toBeVisible({ timeout: 30000 });

  await page.goto('/profile');

  await expect(page.getByRole('heading', { level: 2, name: 'Your profile' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Response board' })).not.toBeVisible();
});
