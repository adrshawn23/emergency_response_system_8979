import { test, expect } from '@playwright/test';
import { client } from './helpers.js';

/**
 * Admin approval flow, verified without the signup email quota:
 * the seeded resident profile is flipped to pending (what the signup
 * trigger produces for real registrations), the admin approves it in the
 * routed residents section, and the profile must come back active.
 */
test.describe.serial('Admin approval flow', () => {
  const RESIDENT = 'resident@example.com';

  test.beforeAll(async () => {
    const sb = client();
    await sb.auth.signInWithPassword({ email: 'admin@emergency.gov', password: 'admin123' });
    await sb.from('user_profiles').update({ status: 'inactive', account_status: 'pending' }).eq('email', RESIDENT);
    await sb.auth.signOut();
  });

  test.afterAll(async () => {
    const sb = client();
    await sb.auth.signInWithPassword({ email: 'admin@emergency.gov', password: 'admin123' });
    await sb.from('user_profiles').update({ status: 'active', account_status: 'active' }).eq('email', RESIDENT);
    await sb.auth.signOut();
  });

  test('admin approves a pending account from the residents section', async ({ page }) => {
    // Several sequential live-DB waits below (30s each) legitimately exceed
    // the 120s default, so this test needs a larger budget.
    test.setTimeout(240000);
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@emergency.gov');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 30000 });

    await page.goto('/user-management');

    await expect(page.getByRole('heading', { name: 'Pending Registrations' })).toBeVisible({ timeout: 30000 });

    const card = page.locator('div.p-6').filter({ hasText: RESIDENT }).first();
    await expect(card).toBeVisible({ timeout: 30000 });

    await card.locator('button:has-text("Approve")').click();

    // Card leaves the pending list
    await expect(page.locator('div.p-6').filter({ hasText: RESIDENT })).toBeHidden({ timeout: 30000 });

    // Persisted: profile is active again
    const sb = client();
    await sb.auth.signInWithPassword({ email: 'admin@emergency.gov', password: 'admin123' });
    const { data } = await sb.from('user_profiles').select('status, account_status').eq('email', RESIDENT).single();
    expect(data.status).toBe('active');
    expect(data.account_status).toBe('active');
    await sb.auth.signOut();
  });
});
