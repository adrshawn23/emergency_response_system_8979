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
      page.locator('text=/reset link has been sent|invalid|could not send|try again|timed out/i').first()
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

  test('resident home: report, pin, contacts dialog, updates redirect', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.accept();
    });

    await loginAs(page, 'resident');
    await expect(page.getByText('Kalubihan Emergency')).toBeVisible({ timeout: 30000 });

    await page.click('text=Report an emergency');
    await page.waitForURL('/emergency-report');
    await expect(page.getByRole('heading', { level: 2, name: 'New incident report' })).toBeVisible();

    await page.goto('/');
    await page.click('text=Submit with a manual pin');
    await page.waitForURL('/emergency-report');

    await page.goto('/');
    await page.click('text=View contacts');
    await expect
      .poll(() => dialogs.length, { timeout: 10000 })
      .toBeGreaterThan(0);
    expect(dialogs[0]).toContain('Emergency contacts');

    await page.goto('/');
    await page.click('text=View updates');
    // Residents have no /report-management access — RoleRoute bounces to '/'
    await page.waitForURL('/');
    await expect(page.getByText('Kalubihan Emergency')).toBeVisible();
  });

  test('admin: every sidebar section renders its heading', async ({ page }) => {
    await loginAs(page, 'admin');
    await expect(page.getByRole('heading', { name: /Command Center/ })).toBeVisible({ timeout: 30000 });

    const sections = [
      ['Incident queue', 'Incident queue'],
      ['New incident', 'New incident report'],
      ['Residents & review', 'Residents & ID review'],
      ['Departments', 'Departments & memberships'],
      ['System settings', 'System settings'],
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

    const bell = page.locator('div:has-text("All systems operational") + button').first();
    await bell.click();
    await expect(page.getByRole('heading', { level: 3, name: 'Notifications' })).toBeVisible();

    // Close via the X button next to the panel heading
    await page
      .getByRole('heading', { level: 3, name: 'Notifications' })
      .locator('xpath=following-sibling::button[1]')
      .click();
    await expect(page.getByRole('heading', { level: 3, name: 'Notifications' })).toBeHidden();
  });

  test('admin: report detail modal, assign team, broadcast request', async ({ page }) => {
    await loginAs(page, 'admin');
    await expect(page.getByRole('heading', { name: /Command Center/ })).toBeVisible({ timeout: 30000 });

    // The seeded report is newest, so it is visible in the live queue
    const item = page.locator('[class*="divide-y"] > button').filter({ hasText: UNIQUE });
    await expect(item.first()).toBeVisible({ timeout: 30000 });
    await item.first().click();

    // Detail panel opens with the assign + broadcast actions
    await page.getByRole('button', { name: 'Assign team' }).click();

    // 'Request assistance' also exists in the page header — scope to the
    // detail panel (the section that contains Assign team).
    const detail = page.locator('section', {
      has: page.getByRole('button', { name: 'Assign team' }),
    });
    await detail.getByRole('button', { name: 'Request assistance' }).click();

    // Broadcast modal: select the first department, send, confirm
    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.click();
    await page.getByRole('button', { name: 'Send request' }).click();

    const done = page.getByRole('button', { name: 'Done' });
    await expect(done).toBeVisible({ timeout: 15000 });
    await done.click();
    await expect(done).toBeHidden({ timeout: 15000 });
  });

  test('admin: profile emergency contacts add and delete', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/profile');

    // Wait for the async profile fetch — without profile.id the contact
    // insert has no user_id and RLS rejects it (the submit is disabled
    // until the profile loads, so this also unblocks the button).
    await expect(page.getByText('admin@emergency.gov').first()).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Add Contact' }).click();
    await expect(page.getByRole('heading', { name: 'Add Emergency Contact' })).toBeVisible();

    const modal = page.locator('.fixed.inset-0').last();
    // Labels are bound via htmlFor — getByLabel proves the association works.
    await modal.getByLabel('Name').fill(CONTACT_NAME);
    await modal.getByLabel('Relationship').fill('Friend');
    await modal.getByLabel('Phone Number').fill('09179998888');
    await modal.getByRole('button', { name: 'Add Contact' }).click();

    const row = page.locator('div').filter({ hasText: CONTACT_NAME }).filter({ hasText: '09179998888' });
    await expect(row.first()).toBeVisible({ timeout: 15000 });

    // Delete via the trash button on the contact row
    await row.first().locator('button:has(svg)').last().click();
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

  test('admin: service boundary editor — map clicks, save, clear', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');

    await page.getByRole('button', { name: 'Configure boundary' }).click();
    const map = page.locator('.leaflet-container').first();
    await expect(map).toBeVisible({ timeout: 15000 });

    // Three distinct map clicks add three boundary points
    await map.click({ position: { x: 80, y: 80 } });
    await map.click({ position: { x: 220, y: 120 } });
    await map.click({ position: { x: 130, y: 240 } });
    await expect(page.getByText('3 points added')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Save Boundary' }).click();

    // Persisted to localStorage for the geofence logic
    const saved = await page.evaluate(() => localStorage.getItem('service_boundary'));
    expect(JSON.parse(saved).points).toHaveLength(3);

    // Reopen, clear the points
    await page.getByRole('button', { name: 'Configure boundary' }).click();
    await expect(map).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByText('0 points added')).toBeVisible({ timeout: 10000 });
  });

  test('admin: settings buttons open functional modals', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 2, name: 'System settings' })).toBeVisible();

    // 'Configure boundary' opens the boundary editor modal — close it via its X.
    await page.getByRole('button', { name: 'Configure boundary' }).click();
    await expect(page.getByRole('heading', { name: 'Configure Service Boundary' })).toBeVisible();
    await page
      .getByRole('heading', { name: 'Configure Service Boundary' })
      .locator('xpath=following-sibling::button[1]')
      .click();
    await expect(page.getByRole('heading', { name: 'Configure Service Boundary' })).toBeHidden();

    // 'Provider settings' opens the delivery-providers modal with working toggles.
    await page.getByRole('button', { name: 'Provider settings' }).click();
    const providerModal = page.locator('.fixed.inset-0').filter({ hasText: 'Delivery providers' });
    await expect(providerModal.getByRole('heading', { name: 'Delivery providers' })).toBeVisible();
    const smsSwitch = providerModal.getByRole('switch', { name: 'Toggle SMS' });
    await expect(smsSwitch).toHaveAttribute('aria-checked', 'false');
    await smsSwitch.click();
    await expect(smsSwitch).toHaveAttribute('aria-checked', 'true');
    await smsSwitch.click();
    await expect(smsSwitch).toHaveAttribute('aria-checked', 'false');
    // Modal has two Close-named buttons: the X icon (aria-label) and the
    // footer text button — .last() picks the footer button.
    await providerModal.getByRole('button', { name: 'Close' }).last().click();
    await expect(providerModal).toBeHidden();
    await expect(page.getByRole('heading', { level: 2, name: 'System settings' })).toBeVisible();
  });

  test('responder: board renders, nav buttons work, sign out', async ({ page }) => {
    await loginAs(page, 'responder');
    await expect(page.getByRole('heading', { name: 'Response board' })).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Incident queue' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Incident queue' })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Your profile' })).toBeVisible({ timeout: 15000 });

    // Workspace sidebar now gives responders a 'Response board' link back.
    await page.getByRole('button', { name: 'Response board' }).click();
    await expect(page.getByRole('heading', { name: 'Response board' })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /sign out|log out/i }).click();
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

      await page.getByRole('button', { name: /sign out|log out/i }).click();
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
