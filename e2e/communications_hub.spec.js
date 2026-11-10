import { test, expect } from '@playwright/test';
import { client, signInWithRetry } from './helpers.js';

/**
 * Communications hub smoke (specs/004-emergency-communications).
 * Requires 20261110230000_communications_hub.sql applied — the beforeAll
 * probe fails fast when the tables are missing.
 */

const ADMIN = { email: 'admin@emergency.gov', password: 'admin123' };
// Real verified resident — Announcements/Contacts are resident-facing only
// (staff are excluded; they get incident/advisory emails instead).
const RESIDENT = { email: 'resident@example.com', password: 'resident123' };

async function login(page, email, password) {
  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 60000 });
}

// Mirrors AuthContext.signOut — wipe session keys then land on the login form.
async function signOutUI(page) {
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-') || k.startsWith('supabase') || k.startsWith('ers.'))
      .forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
  });
}

async function cleanup(title, label) {
  const sb = client();
  await signInWithRetry(sb, ADMIN.email, ADMIN.password);
  await sb.from('announcements').delete().eq('title', title);
  await sb.from('department_contacts').delete().eq('label', label);
  await sb.auth.signOut();
}

test.describe('Communications hub', () => {
  test.beforeAll(async () => {
    const sb = client();
    await signInWithRetry(sb, ADMIN.email, ADMIN.password);
    const { error } = await sb.from('announcements').select('id').limit(1);
    await sb.auth.signOut();
    if (error) throw new Error(
      `Communications tables missing — apply supabase/migrations/20261110230000_communications_hub.sql in the SQL editor. (${error.message})`);
  });

  test('admin publishes advisory → resident sees it on Announcements', async ({ page }) => {
    const title = `E2E advisory ${Date.now()}`;
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto('/announcements');

    await page.getByPlaceholder('Advisory title').fill(title);
    await page.getByPlaceholder(/Advisory details/).fill('E2E smoke body — road closed for drill.');
    await page.getByRole('button', { name: 'Publish + email residents' }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });

    // Resident view — same page, no compose form.
    await cleanup(title, 'none-such');
    await signOutUI(page);
    await login(page, RESIDENT.email, RESIDENT.password);
    await page.goto('/announcements');
    await expect(page.getByRole('heading', { name: 'Advisories' })).toBeVisible();
    await expect(page.getByPlaceholder('Advisory title')).toHaveCount(0);
  });

  test('admin adds contact → resident sees it in the directory', async ({ page }) => {
    const label = `E2E hotline ${Date.now()}`;
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto('/contacts');

    await page.getByPlaceholder(/Label/).fill(label);
    await page.getByPlaceholder(/Number \//).fill('555-0199');
    await page.getByRole('button', { name: 'Add contact' }).click();
    await expect(page.getByText(label)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('555-0199')).toBeVisible();

    // Resident view — sees the same entry, read-only (no admin form).
    await signOutUI(page);
    await login(page, RESIDENT.email, RESIDENT.password);
    await page.goto('/contacts');
    await expect(page.getByText(label)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('555-0199')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add contact' })).toHaveCount(0);
    await cleanup('none-such', label);
  });
});
