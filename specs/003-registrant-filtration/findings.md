# Implementation Notes — 003 Registrant Filtration

**Status**: Implemented (2026-11-10) | **E2e**: `e2e/registrant-filtration.spec.js` 3/3 pass; `reports-and-notifications` 4/4 regression pass; `npm run build` green.

## What shipped

- **Four status tabs** on `/user-management`: For Approval / Returned / Approved / Rejected, each with a live count badge derived in `registrantViews` (`dashboard/index.jsx`) from the latest non-superseded `id_verifications` row per user + `pendingUsers` with no verification row (new signups). `superseded` rows are excluded everywhere.
- **Decisions are modal-only**: the old `PendingRegistrations` inline Approve/Reject buttons and the "ID verification queue" card (which listed superseded rows) were replaced by one unified, tab-filtered list; rows open the existing review modal. `PendingRegistrations.jsx` is now unimported (kept on disk with the other dormant page components).
- **Returned loop**: `needs_clarity`/`correction_required` → Returned tab. Registrant resubmission → the existing insert guard supersedes the old row and bumps `submission_revision` → lands back in For Approval with a **Resubmitted** badge; the modal shows "Resubmission — revision N" + the prior `decision_reason`/`review_notes`.
- **Terminal archive**: Approved/Rejected rows are read-only — the modal shows "Decision recorded — terminal, read-only" + a Done button instead of action buttons; Rejected rows get muted styling + an Archived badge.
- **Sidebar badge** on Residents & review now shows the **For Approval** count (awaiting admin decision), not all inactive profiles — returned registrants are waiting on the applicant, not the admin.
- **Registrant banner** (`resident-home`): `needs_clarity` copy tells the applicant to re-upload exactly what the note asks; the note label reads "What to re-upload:" when resubmission is required.
- **Migration `20261110140000_verification_decision_notification.sql`** (USER applies via SQL editor): `notify_verification_decision()` AFTER UPDATE trigger → `notifications` row (`type='verification_decision'`, carries the reason) on needs_clarity/correction_required/rejected; plus `id_verifications` added to `supabase_realtime` so tab counts re-derive live.
- **Live refetch**: `id_verifications` fetched on mount for admins (badge accurate on any section) + realtime channel refetch — the channel is inert until the publication add is applied (falls back to fetch-on-navigate).

## Schema facts verified (T001/T002 probe)

- `notifications` real columns: `recipient_id`, `message`, `action_url`, `metadata` — the contract was updated to match; `create_notification()` helper used for inserts.
- No `type` CHECK constraint → `'verification_decision'` is safe.
- `page_permissions.residents` + `DEFAULT_PAGE_ROLES.residents` = `['admin']` — gate unchanged.
- Staff registrants (responder/dispatcher) have no verification rows yet — buckets cover them structurally (role-agnostic derivation).

## Incidents during implementation

- A PowerShell `Set-Content` line-replacement initially injected the JSX into the wrong location (matched `if (section === 'residents')` inside `load()`), then mojibake'd non-ASCII chars — repaired via cp1252→UTF-8 byte round-trip + six literal `U+FFFD`→`—` fixes. File verified clean; build + all e2e pass.

## E2e coverage

- Tabs + counts + empty states; modal approve → Approved read-only; reject → Rejected archived; returned → resubmit → Resubmitted badge + prior note in modal.
- Soft assertion: `verification_decision` notification row — passes once T016's migration is applied.
- **Cleanup note**: seeded `id_verifications` rows can't be deleted with the publishable key; the spec only ever re-statuses admin's own rows (`superseded` at the end). `supabase/cleanup_test_data.sql` covers manual cleanup.

## Follow-ups

- **T016 done (2026-11-10)**: migration applied via SQL editor; e2e re-run 3/3 including the `verification_decision` notification assert — the trigger fires and writes the row live.
