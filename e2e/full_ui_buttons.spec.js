import { test, expect } from '@playwright/test';
import { createReport, deleteReportsByContent, client } from './helpers.js';

/**
 * Full button / function coverage, end to end, per role.
 * Complements the flow specs (lifecycle, workflow, approval) by walking
 * EVERY page and interactive element: nav links, modals, forms, panels,
 * map editor, dialogs, and validation states.
 */

const UNIQUE = `E2E buttons ${Date.now()}`;
const CONTACT_NAME = `E2E Contact ${Date.now()}`;

const ACCOUNTS = {
  admin: { email: 'admin@emergency.gov', password: 'admin123' },
  dispatcher: { email: 'dispatcher@emergency.gov', password: 'dispatcher123' },
  responder: { email: 'responder@emergency.gov', password: 'responder123' },
  resident: { email: 'resident@example.com', password: 'resident123' },
};

async function loginAs(page, role) {
  const { email, password } = ACCOUNTS[role];
  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Sign-in is async — wait for the login form to unmount so later
  // goto()/clicks don't race it and get bounced back to '/'.
  await page.waitForSelector('input[type="email"]', {
    state: 'detached',
    timeout: 30000,
  });
}

test.describe('Full UI button coverage', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    // Queue items render attachments.location (not content) — seed UNIQUE in
    // both so the row is identifiable by text.
    await createReport(UNIQUE, 'pending', UNIQUE);
  });

  test.afterAll(async () => {
    await deleteReportsByContent(UNIQUE);
    // Safety net: remove any leftover test emergency contact
    const sb = client();
    await sb.auth.signInWithPassword(ACCOUNTS.admin);
    await sb.from('emergency_contacts').delete().eq('name', CONTACT_NAME);
    await sb.auth.signOut();
  });

  test('login page: forgot password and create account links', async ({ page }) => {
    await page.goto('/');

    await page.click('text=Forgot password?');
    await page.waitForURL('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    // Submit an email — the page must respond with either the confirmation
    // or an error banner (email delivery depends on live Supabase reachability).
    await page.fill('#reset-email', 'resident@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(
      page.locator('text=/reset link has been sent|invalid|could not send|try again|timed out|rate limit|exceeded|security purposes|seconds/i').first()
    ).toBeVisible({ timeout: 30000 });
    if (await page.getByRole('button', { name: 'Back to sign in' }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Back to sign in' }).click();
      await page.waitForURL('/login');
    }
    await page.goto('/');

    await page.click('text=Create account');
    await page.waitForURL('/register');
    await expect(page.getByText(/Create your account|Sign up|Register/i).first()).toBeVisible();
  });

  test('resident home: report, pin, contacts notice, updates redirect', async ({ page }) => {
    await loginAs(page, 'resident');
    await expect(page.getByText('Kalubihan Emergency')).toBeVisible({ timeout: 30000 });

    await page.click('text=Report an emergency');
    await page.waitForURL('/emergency-report');
    await expect(page.getByRole('heading', { level: 2, name: 'New incident report' })).toBeVisible();

    await page.goto('/');
    await page.click('text=Submit with a manual pin');
    await page.waitForURL('/emergency-report');

    // 'View contacts' now toggles an inline notice (no browser dialog)
    await page.goto('/');
    await page.click('text=View contacts');
    await expect(
      page.locator('text=Emergency contacts are managed by')
    ).toBeVisible({ timeout: 10000 });

    await page.goto('/');
    await page.click('text=View updates');
    // Residents have no /report-management access — RoleRoute bounces to '/'
    await page.waitForURL('/');
    await expect(page.getByText('Kalubihan Emergency')).toBeVisible();
  });

  test('admin: every sidebar section renders its heading', async ({ page }) => {
    await loginAs(page, 'admin');
    await expect(page.getByRole('heading', { name: /Command Center/ })).toBeVisible({ timeout: 30000 });

    // Admins see no 'Incident queue'/'New incident' links — queue and report
    // filing belong to operational roles (SECTION_ROLES hard gate).
    const sections = [
      ['Residents & review', 'Residents & ID review'],
      ['Access control', 'Access control'],
      ['Departments', 'Departments & memberships'],
      ['Reports', 'Reports & system activity'],
      ['Profile', 'Your profile'],
      ['Command center', 'Command Center'],
    ];

    for (const [navTitle, heading] of sections) {
      await page.click(`button[title="${navTitle}"]`);
      await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible({ timeout: 15000 });
    }
  });

  test('admin: notifications panel opens and closes', async ({ page }) => {
    await loginAs(page, 'admin');
    await expect(page.getByRole('heading', { name: /Command Center/ })).toBeVisible({ timeout: 30000 });

    // NotificationBell: aria-label 'Notifications, N unread'; panel is a
    // role="menu" dropdown toggled by re-clicking the bell.
    const bell = page.getByRole('button', { name: /^Notifications/ });
    await bell.click();
    const menu = page.locator('div[role="menu"][aria-label="Notifications"]');
    await expect(menu).toBeVisible();

    await bell.click();
    await expect(menu).toBeHidden();
  });

  test('admin: report detail modal, assign team, broadcast request', async ({ page }) => {
    await loginAs(page, 'admin');
    await expect(page.getByRole('heading', { name: /Command Center/ })).toBeVisible({ timeout: 30000 });

    // The seeded report is newest, so it is visible in the live queue
    const item = page.locator('[class*="divide-y"] > button').filter({ hasText: UNIQUE });
    await expect(item.first()).toBeVisible({ timeout: 30000 });
    await item.first().click();

    // Detail panel opens with the incident summary + 'Assign team' action
    // (the old Request-assistance broadcast modal was removed).
    const detail = page.locator('section').filter({ has: page.getByRole('button', { name: 'Assign team' }) });
    await expect(detail.getByText('GPS location captured')).toBeVisible();
    await page.getByRole('button', { name: 'Assign team' }).click();

    // updateStatus flips the report to 'assigned' — reflected on the queue item
    await expect(item.first()).toContainText('assigned', { timeout: 15000 });
  });

  test('admin: profile emergency contacts add and delete', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/profile');

    // Wait for the async profile fetch — without profile.id the contact
    // insert has no user_id and RLS rejects it (the submit is disabled
    // until the profile loads, so this also unblocks the button).
    await expect(page.getByText('admin@emergency.gov').first()).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Add Contact' }).click({ force: true });
    await expect(page.getByRole('heading', { name: 'Add Emergency Contact' })).toBeVisible();

    const modal = page.locator('.fixed.inset-0').last();
    // The modal uses placeholders, not bound labels.
    await modal.locator('input[placeholder="Contact name"]').fill(CONTACT_NAME);
    await modal.locator('input[placeholder="e.g., Spouse, Parent, Friend"]').fill('Friend');
    await modal.locator('input[placeholder="Phone number"]').fill('09179998888');
    await modal.getByRole('button', { name: 'Add Contact' }).click();

    const row = page.locator('div.flex.items-center.justify-between.rounded-lg.border')
      .filter({ hasText: CONTACT_NAME });
    await expect(row.first()).toBeVisible({ timeout: 15000 });

    // Delete via the button on the contact row
    await row.first().locator('button').last().click();
    await expect(row.first()).toBeHidden({ timeout: 15000 });
  });

  test('admin: password change validation and cancel', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/profile');

    await page.getByRole('button', { name: 'Security' }).click();
    await expect(page.getByRole('heading', { name: 'Change Password' })).toBeVisible();

    // Empty submit -> required-field errors
    await page.getByRole('button', { name: 'Change Password' }).click();
    await expect(page.locator('text=/required|cannot be empty/i').first()).toBeVisible({ timeout: 10000 });

    // Mismatched confirmation -> error, and admin password is NOT changed
    await page.fill('input[type="password"]', 'admin123');
    await page.locator('input[type="password"]').nth(1).fill('NewPass@123');
    await page.locator('input[type="password"]').nth(2).fill('Different@123');
    await page.getByRole('button', { name: 'Change Password' }).click();
    await expect(page.locator('text=/match|do not match|must match/i').first()).toBeVisible({ timeout: 10000 });

    // Cancel resets the form
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('input[type="password"]').first()).toHaveValue('');
  });

  test('admin: service boundary editor — map clicks and clear', async ({ page }) => {
    // The boundary editor moved into the command center (admin-only
    // 'Configure' button). NOTE: do NOT click Save Boundary — it writes the
    // live geofence_boundaries row the geofence tests depend on.
    await loginAs(page, 'admin');
    await expect(page.getByRole('heading', { name: /Command Center/ })).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Configure' }).click();
    await expect(page.getByRole('heading', { name: 'Configure Service Boundary' })).toBeVisible();

    const map = page.locator('.leaflet-container').last();
    await expect(map).toBeVisible({ timeout: 15000 });

    // Clear whatever is loaded, then three map clicks add three points
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByText('0 points added')).toBeVisible({ timeout: 10000 });
    await map.click({ position: { x: 80, y: 80 } });
    await map.click({ position: { x: 220, y: 120 } });
    await map.click({ position: { x: 130, y: 240 } });
    await expect(page.getByText('3 points added')).toBeVisible({ timeout: 10000 });

    // Clear + close WITHOUT saving
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByText('0 points added')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('heading', { name: 'Configure Service Boundary' })).toBeHidden();
  });

  test('responder: board renders, nav buttons work, sign out', async ({ page }) => {
    await loginAs(page, 'responder');
    await expect(page.getByRole('heading', { name: 'Response board' })).toBeVisible({ timeout: 30000 });

    // title= scopes to the sidebar nav — 'Incident queue'/'Profile' text
    // also appears on board buttons and trips strict mode.
    await page.click('button[title="Incident queue"]');
    await expect(page.getByRole('heading', { level: 2, name: 'Incident queue' })).toBeVisible({ timeout: 15000 });

    await page.click('button[title="Profile"]');
    await expect(page.getByRole('heading', { level: 2, name: 'Your profile' })).toBeVisible({ timeout: 15000 });

    // Workspace sidebar now gives responders a 'Response board' link back.
    await page.click('button[title="Response board"]');
    await expect(page.getByRole('heading', { name: 'Response board' })).toBeVisible({ timeout: 15000 });

    // Desktop sign-out lives in the Account menu dropdown; the mobile-bar
    // 'Sign out' is sm:hidden at this viewport.
    await page.getByRole('button', { name: 'Account menu' }).first().click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await page.waitForURL('/login', { timeout: 15000 });
  });

  test('resident: change password, relogin, revert', async ({ page }) => {
    let passwordChanged = false;
    try {
      await loginAs(page, 'resident');
      await expect(page.getByText('Kalubihan Emergency')).toBeVisible({ timeout: 30000 });

      await page.goto('/profile');
      await page.getByRole('button', { name: 'Security' }).click({ timeout: 30000 });
      await page.fill('input[type="password"]', 'resident123');
      await page.locator('input[type="password"]').nth(1).fill('Resident@999');
      await page.locator('input[type="password"]').nth(2).fill('Resident@999');
      await page.getByRole('button', { name: 'Change Password' }).click();
      await expect(page.locator('text=/updated|changed|success/i').first()).toBeVisible({ timeout: 15000 });
      passwordChanged = true;

      await page.getByRole('button', { name: 'Account menu' }).first().click();
      await page.getByRole('menuitem', { name: 'Logout' }).click();
      await page.waitForURL('/login', { timeout: 15000 });

      // Login with the NEW password
      await page.fill('input[type="email"]', ACCOUNTS.resident.email);
      await page.fill('input[type="password"]', 'Resident@999');
      await page.click('button[type="submit"]');
      // 'Kalubihan Emergency' is branding shown on the login page too, so it
      // can't prove sign-in. The email input detaches only when the login
      // form unmounts after a successful auth (same check loginAs uses).
      await page.waitForSelector('input[type="email"]', {
        state: 'detached',
        timeout: 30000,
      });

      // Change it back
      await page.goto('/profile');
      await page.getByRole('button', { name: 'Security' }).click({ timeout: 30000 });
      await page.fill('input[type="password"]', 'Resident@999');
      await page.locator('input[type="password"]').nth(1).fill('resident123');
      await page.locator('input[type="password"]').nth(2).fill('resident123');
      await page.getByRole('button', { name: 'Change Password' }).click();
      await expect(page.locator('text=/updated|changed|success/i').first()).toBeVisible({ timeout: 15000 });
      passwordChanged = false;
    } finally {
      // A failure between the two updates leaves the live account on the
      // changed password, which then breaks every spec that signs in as the
      // resident. Restore it via the auth API so cleanup is unconditional.
      if (passwordChanged) {
        const sb = client();
        const { error } = await sb.auth.signInWithPassword({
          email: ACCOUNTS.resident.email,
          password: 'Resident@999',
        });
        if (!error) await sb.auth.updateUser({ password: 'resident123' });
        await sb.auth.signOut();
      }
    }
  });
});
