# Phase 0 Research: New Registrant Filtration

**Date**: 2026-11-10 | **Feature**: `003-registrant-filtration`

## D1: Status mapping — where do the four views come from?

- **Decision**: Map the four views directly onto `id_verifications.verification_status` plus the registrant-level pending signal: `pending`/`under_review` → **For Approval**; `needs_clarity`/`correction_required` → **Returned**; `approved` → **Approved**; `rejected` → **Rejected**. Registrants whose `user_profiles.account_status = 'pending'` with **no** open verification row also appear in For Approval (edge case already handled by the synthesized pending modal object).
- **Rationale**: `verification_status` is already the single source of truth — `review_verification()` owns every transition atomically, the insert guard supersedes old revisions, and the auto-reject cron writes the same column. Deriving views adds zero state that can drift.
- **Alternatives considered**: A `review_state` column on `user_profiles` — rejected; duplicates state, needs dual writes, drifts from the verification row the reviewer actually inspects.

## D2: Resubmission signal — how does "back in For Approval" show Resubmitted?

- **Decision**: Read `id_verifications.submission_revision > 1` (or existence of any `superseded` row for the user) → render a **Resubmitted** badge; show `decision_reason`/`review_notes` of the prior returned row to the reviewer in the modal.
- **Rationale**: `guard_verification_insert` already increments `submission_revision` and supersedes older rows on every new client upload — the signal exists today, untouched.
- **Alternatives considered**: A `resubmitted` boolean set client-side — rejected; untrusted client writes are stripped by policy and it duplicates the revision counter.

## D3: Returned-registrant UX — banner + notification (Q1: A+C)

- **Decision**: (a) Banner — the existing `resident-home` verification card already renders `needs_clarity`/`correction_required` states with the reviewer note (`VERIFICATION_COPY` + decision_reason) and a resubmit file input; extend copy so the banner explicitly names what to re-upload when a note exists. (b) Notification — insert a `notifications` row (`type: 'verification_decision'`, carries the clarification note + link to resident home) server-side when `review_verification` returns a non-approved decision; the existing `useNotifications` bell surfaces it with zero new plumbing.
- **Rationale**: Both legs reuse shipped surfaces; only the in-app notification row is genuinely new. Email already exists via `notify-decision` (Q1-C's "email" leg).
- **Alternatives considered**: A dedicated "clarification" channel/table — rejected; `review_notes` + notifications table already model this.

## D4: Rejected as archive (Q3: C)

- **Decision**: Rejected stays a tab over `verification_status = 'rejected'` rows, rendered as an archived list (muted styling, decision context, no action buttons) — separate visual treatment from the active queue, retained indefinitely.
- **Rationale**: Data is already retained forever (nothing deletes rejected rows); "archive" is presentation, not storage.
- **Alternatives considered**: A `rejected_archive` table or `archived_at` column — rejected; storage churn for a pure presentation distinction.

## D5: Modal surface — new or reuse?

- **Decision**: Reuse the existing review modal (`isReviewModalOpen` / `selectedVerification` / `reviewRemark` flow in `dashboard/index.jsx` residents section). Add the Resubmitted badge and prior-note display; decisions stay inside it. Tabs become a filter bar above the existing registrant list.
- **Rationale**: FR-003 asks for "a modal, not just a table" — the modal already exists and works; the feature is filtration around it, not a new modal.
- **Alternatives considered**: A new dedicated `ReviewModal` component extraction — deferred; extraction adds refactor risk with no spec requirement (may still happen inside implementation if the file grows unwieldy).

## D6: Live updates for counts (FR-009)

- **Decision**: Subscribe the residents section to `id_verifications` changes (INSERT/UPDATE) and re-derive tab counts from the existing `idVerifications` + `pendingUsers` state — no extra fetches.
- **Rationale**: Realtime subscriptions are already used elsewhere on this page for reports; same disciplined pattern applies.
- **Alternatives considered**: Polling interval — rejected; constitution favors realtime over polling, and the data is already in state.

## D7: Who sees the filtration?

- **Decision**: Admin-only, unchanged. `residents` page key already resolves to `['admin']` in `DEFAULT_PAGE_ROLES` and the live `page_permissions` row; staff registrants flow through the same verification table (FR-010) with no second queue.
- **Rationale**: Matches spec assumption and existing role gate.
