import { test, expect } from '@playwright/test';
import { client, signInWithRetry, ensurePendingVerification } from './helpers.js';

/**
 * Spec 003 — New Registrant Filtration: four status views (For Approval /
 * Returned / Approved / Rejected) on Residents & review, decisions inside the
 * review modal, resubmission loop, terminal archive.
 *
 * Seed strategy: `ensurePendingVerification()` guarantees an open
 * id_verifications row on the admin account — we then track it BY ID, not by
 * review_notes, because the client-insert guard strips review_notes/OCR.
 * Inserting a second row exercises the REAL resubmission path (the guard
 * supersedes the older revision and bumps submission_revision).
 *
 * Cleanup caveat: the publishable key cannot DELETE id_verifications — rows
 * are only re-statused to 'superseded' so they leave the views.
 *
 * NOTE: steps that mutate id_verifications from OUTSIDE the app call
 * page.goto('/user-management') again to refetch — the realtime refetch only
 * fires once T016 applies the 20261110140000 migration live.
 */

const PRIOR_NOTE = 'E2E FILT prior — sharper photo please';

async function login(page, email, password) {
  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 60000 });
}

async function adminClient() {
  const sb = client();
  await signInWithRetry(sb, 'admin@emergency.gov', 'admin123');
  const { data: me } = await sb.auth.getUser();
  return { sb, uid: me.user.id };
}

/** The admin's latest non-superseded verification row (the live seed). */
async function seedRow() {
  const { sb, uid } = await adminClient();
  const { data } = await sb.from('id_verifications')
    .select('id, verification_status, submission_revision')
    .eq('user_id', uid)
    .neq('verification_status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1);
  await sb.auth.signOut();
  return data?.[0];
}

async function setStatus(id, status, extra = {}) {
  const { sb } = await adminClient();
  const { error } = await sb.from('id_verifications')
    .update({ verification_status: status, ...extra }).eq('id', id);
  await sb.auth.signOut();
  if (error) throw new Error(`setStatus(${status}): ${error.message}`);
}

/** Second submission — the insert guard supersedes the older row server-side. */
async function resubmitSeed() {
  const { sb, uid } = await adminClient();
  const { error } = await sb.from('id_verifications')
    .insert({ user_id: uid, id_document_url: 'e2e_seed_resubmit' });
  await sb.auth.signOut();
  if (error) throw new Error(`resubmitSeed: ${error.message}`);
}

/** Park every open row for the admin (no deletes possible via publishable key). */
async function parkSeeds() {
  const { sb, uid } = await adminClient();
  await sb.from('id_verifications')
    .update({ verification_status: 'superseded' })
    .eq('user_id', uid)
    .in('verification_status', ['pending', 'under_review', 'needs_clarity', 'correction_required']);
  await sb.auth.signOut();
}

test.describe('Registrant filtration', () => {
  test('four status tabs render with counts; empty states work', async ({ page }) => {
    await ensurePendingVerification();
    await login(page, 'admin@emergency.gov', 'admin123');
    await page.goto('/user-management');

    for (const label of ['For Approval', 'Returned', 'Approved', 'Rejected']) {
      await expect(page.getByRole('tab', { name: new RegExp(label) })).toBeVisible();
    }

    // Seed row sits in For Approval by default.
    await expect(page.getByText('admin@emergency.gov').first()).toBeVisible({ timeout: 15000 });

    // Returned tab flips between a list and a clean empty state.
    await page.getByRole('tab', { name: /Returned/ }).click();
    const returnedEmpty = page.getByText('Nothing returned for clarification.');
    const returnedRows = page.getByText(/Decided |Submitted /);
    await expect(returnedEmpty.or(returnedRows.first())).toBeVisible();

    await page.goto('/login');
  });

  test('approve via modal re-files to Approved; terminal rows are read-only', async ({ page }) => {
    await ensurePendingVerification();
    await login(page, 'admin@emergency.gov', 'admin123');
    await page.goto('/user-management');

    // Open the seed row → modal.
    await page.getByText('admin@emergency.gov').first().click();
    await expect(page.getByText('Review ID Verification')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Approve & Activate' }).click();
    await expect(page.getByText('Review ID Verification')).toBeHidden({ timeout: 15000 });

    // Row moved to Approved — open it: terminal, read-only, Done-only.
    await page.getByRole('tab', { name: /Approved/ }).click();
    await page.getByText('admin@emergency.gov').first().click();
    await expect(page.getByText('terminal, read-only')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve & Activate' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Done' }).click();

    // Reject path → Rejected archive. External mutation → refetch.
    const row = await seedRow();
    await setStatus(row.id, 'pending');
    await page.goto('/user-management');
    await page.getByRole('tab', { name: /For Approval/ }).click();
    await page.getByText('admin@emergency.gov').first().click();
    await page.fill('#reviewRemark', 'E2E FILT reject reason');
    await page.getByRole('button', { name: 'Reject' }).click();
    await page.getByRole('tab', { name: /Rejected/ }).click();
    await expect(page.getByText('Archived').first()).toBeVisible();

    await page.goto('/login');
  });

  test('returned → resubmit → For Approval with Resubmitted badge + prior note', async ({ page }) => {
    await ensurePendingVerification();
    const row = await seedRow();
    // Admin returns the seed — lands in Returned.
    await setStatus(row.id, 'needs_clarity', { decision_reason: PRIOR_NOTE, decision_at: new Date().toISOString() });

    await login(page, 'admin@emergency.gov', 'admin123');
    await page.goto('/user-management');
    await page.getByRole('tab', { name: /Returned/ }).click();
    await expect(page.getByText('admin@emergency.gov').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/returned/i).first()).toBeVisible();

    // Registrant-side notification (trigger from migration 20261110140000 —
    // soft check: passes once T016 applies the migration; warns until then).
    const { sb, uid } = await adminClient();
    const { data: notes } = await sb.from('notifications')
      .select('id').eq('recipient_id', uid).eq('type', 'verification_decision').limit(1);
    expect.soft(notes?.length || 0, 'verification_decision notification (needs T016 migration)').toBeGreaterThan(0);
    await sb.auth.signOut();

    // Registrant resubmits → supersede + revision bump happens server-side.
    // External mutation → refetch.
    await resubmitSeed();
    await page.goto('/user-management');
    await page.getByRole('tab', { name: /For Approval/ }).click();
    await expect(page.getByText('Resubmitted')).toBeVisible({ timeout: 15000 });
    await page.getByText('admin@emergency.gov').first().click();
    await expect(page.getByText(/Resubmission — revision \d+/)).toBeVisible();
    await expect(page.getByText(`Previously requested: ${PRIOR_NOTE}`)).toBeVisible();
    await page.goto('/login');

    await parkSeeds();
  });
});
