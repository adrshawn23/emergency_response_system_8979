# Quickstart Validation: New Registrant Filtration

**Feature**: `003-registrant-filtration` | **Date**: 2026-11-10

Runnable scenarios that prove the four-view filtration end-to-end. Run the app with `npm run start -- --port 4190` and Supabase as configured.

## Scenario 1 — Tabs render with counts (FR-001, FR-002)

1. Log in as `admin@emergency.gov`.
2. Navigate to **Residents & review** (`/user-management`).
3. Expect four labeled tabs — **For Approval**, **Returned**, **Approved**, **Rejected** — each showing a count.
4. Expect every registrant appears under exactly one tab; counts sum to the total.

## Scenario 2 — Modal triage (FR-003, FR-004, FR-005)

1. Open a registrant under **For Approval** → review modal shows details + ID evidence.
2. Choose **Return for clarification** with a note → registrant moves to **Returned** immediately, no reload.
3. Open another registrant → **Approve** → appears under **Approved**; account activates (can sign in + report).
4. Reject a third → appears under **Rejected** (archived styling, no action buttons).

## Scenario 3 — Returned loop (FR-006, FR-011, FR-012)

1. With a returned registrant's account, open the resident home page → status banner names what to re-upload; bell shows a **verification_decision** notification with the note.
2. Re-upload an ID → admin's For Approval tab shows the registrant back with a **Resubmitted** badge; modal shows the prior clarification note.
3. Approve → terminal Approved; the returned registrant's banner clears.

## Scenario 4 — Archive + terminal immutability (FR-007, FR-013)

1. Rejected tab lists the rejected registrant with decision context; no approve/re-queue controls exist.
2. Approved tab likewise offers no reversal.

## Automated coverage

```powershell
npx playwright test e2e/registrant-filtration.spec.js --reporter=line
```

Expected: seeds a pending registrant, walks tab → modal → returned → resubmit → resubmitted-badge, asserts terminal tabs, cleans up seeded rows. Live-DB caveat: `publishable` key cannot delete `id_verifications`/`user_profiles` — cleanup via `supabase/cleanup_test_data.sql` or keep seeds identifiable by unique name marker.
