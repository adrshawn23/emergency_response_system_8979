# Tasks: New Registrant Filtration

**Input**: Design documents from `/specs/003-registrant-filtration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/registrant-review.md

**Tests**: E2e tasks are included â€” the project constitution requires Playwright coverage for user-facing flows.

**Organization**: Tasks grouped by user story; each phase is independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1/US2/US3) â€” setup/foundational/polish carry none
- Exact file paths included in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify live state before touching code â€” the design assumes columns/RPCs that must exist remotely.

- [x] T001 Live-probe `id_verifications` (`submission_revision`, `decision_reason`, `document_storage_path`), `notifications` column shape + allowed `type` values, `review_verification` presence, `supabase_realtime` publication membership (expect `id_verifications` ABSENT â€” added by T003), and that a staff registrant produces an `id_verifications` row (FR-010) via Supabase node client (anon + admin sign-in). Write result to `specs/003-registrant-filtration/live-probe-notes.md`
- [x] T002 [P] Verify `/user-management` gate: `page_permissions.residents` live row == `['admin']` and `DEFAULT_PAGE_ROLES.residents` matches in `src/context/AuthContext.jsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared plumbing all three stories depend on.

- [x] T003 Create `supabase/migrations/20261110140000_verification_decision_notification.sql` â€” two parts: (a) AFTER UPDATE trigger on `id_verifications` that inserts a `notifications` row (`user_id` = NEW.user_id, `type` = `'verification_decision'`, title/body carrying `decision_reason`/`review_notes`, `link` = resident verification surface) when `verification_status` changes to `needs_clarity`, `correction_required`, or `rejected` â€” SECURITY DEFINER function so the insert bypasses the caller's notifications-write policy, mirroring `supabase/migrations/20261110130000_assignment_notification_details.sql`; (b) guarded `ALTER PUBLICATION supabase_realtime ADD TABLE public.id_verifications` (check `pg_publication_tables` first â€” the table is currently absent, analyze F1). Contract: `contracts/registrant-review.md` Â§3
- [x] T004 Add status-bucket derivation in `src/pages/dashboard/index.jsx` residents section: single `registrantViews` object computed from `idVerifications` + `pendingUsers` â€” `{ forApproval, returned, approved, rejected }` arrays + counts. Mapping per `contracts/registrant-review.md` Â§2: `pending`/`under_review`/no-row pending registrants â†’ forApproval; `needs_clarity`/`correction_required` â†’ returned; `approved` â†’ approved; `rejected` â†’ rejected; `superseded` rows excluded from all views
- [x] T005 Subscribe the residents section to `id_verifications` INSERT/UPDATE (Realtime channel) in `src/pages/dashboard/index.jsx` â€” re-run the existing `fetchVerifications` on change so counts re-derive live (FR-009); channel lives only while `section === 'residents'`; follow the reports-channel pattern already used on this page

**Checkpoint**: Foundation ready â€” buckets derive correctly, notifications fire on decision, realtime refetches

---

## Phase 3: User Story 1 â€” Admin triages the For Approval queue (Priority: P1) ðŸŽ¯ MVP

**Goal**: Four labeled status tabs with counts on Residents & review; every registrant in exactly one view; row click opens the existing review modal; approve/reject/return decisions re-file instantly.

**Independent Test**: Seed registrants in each state â†’ open `/user-management` â†’ each appears under the correct tab; decide via modal â†’ row moves tabs without reload.

- [x] T006 [US1] Build the status tab bar + count badges above the registrant list in `src/pages/dashboard/index.jsx` residents section â€” first locate the exact `section === 'residents'` render block, then render four tabs labeled exactly `For Approval` / `Returned` / `Approved` / `Rejected`, active-tab styling consistent with existing UI, each showing its derived count from T004. Sidebar `residents` nav badge semantics: change to For Approval count (registrants awaiting an admin decision) â€” Returned registrants are waiting on the user, not the admin
- [x] T007 [US1] Wire active tab to the registrant list in `src/pages/dashboard/index.jsx` â€” filter rendered rows by the selected bucket; add an explicit empty state per tab (`No registrations for approval.` etc.); default tab = For Approval; keep existing row fields (name, email, residency, submitted date)
- [x] T008 [US1] Ensure decisions happen only inside the existing review modal in `src/pages/dashboard/index.jsx` â€” row click opens `handleReviewPendingUser`/`selectedVerification` modal flow; remove/prevent any inline decision controls on the row itself; modal actions remain `Approve` / `Reject` / `Request clarification`
- [x] T009 [US1] Create `e2e/registrant-filtration.spec.js` â€” seed a pending `id_verifications` row via service/admin client in `e2e/helpers.js` style; assert four tabs + counts render; open For Approval tab â†’ row â†’ modal visible; approve via modal â†’ row lands under Approved. Reuse `login`, `signInWithRetry`, `client` from `e2e/helpers.js`

**Checkpoint**: US1 independently functional â€” tabs, counts, modal triage all work

---

## Phase 4: User Story 2 â€” Returned registrations cycle back (Priority: P2)

**Goal**: Returned tab holds clarification cases; registrant sees banner + in-app notification naming what to re-upload; resubmission lands back in For Approval with a Resubmitted badge + prior note visible.

**Independent Test**: Return a registrant â†’ Returned tab + bell notification; resubmit ID via resident home â†’ For Approval with Resubmitted badge; modal shows prior note.

- [x] T010 [US2] Render `Resubmitted` badge on For Approval rows where `submission_revision > 1` (or a prior `superseded` row exists for the user) in `src/pages/dashboard/index.jsx`; badge styling = amber pill, consistent with queue badges
- [x] T011 [US2] Surface the prior clarification note in the review modal in `src/pages/dashboard/index.jsx` â€” when the open row is a resubmission, fetch/display the latest superseded-or-returned row's `decision_reason`/`review_notes` for that `user_id`
- [x] T012 [US2] Extend `VERIFICATION_COPY` in `src/pages/resident-home/index.jsx` so `needs_clarity`/`correction_required` banner explicitly says what to re-upload using `decision_reason`/`review_notes` when present (fallback to current generic copy); banner must render for residents and staff registrants alike
- [x] T013 [US2] Add returned-loop test to `e2e/registrant-filtration.spec.js` â€” admin returns registrant with note â†’ registrant appears under Returned; assert `verification_decision` notification row exists for that user; seed a resubmission (new `id_verifications` row, revision 2, `pending`) â†’ assert row back in For Approval with Resubmitted badge

**Checkpoint**: US1 + US2 both pass â€” clarify-resubmit loop complete

---

## Phase 5: User Story 3 â€” Approved & Rejected terminal audit views (Priority: P3)

**Goal**: Approved/Rejected tabs are read-only audit surfaces; Rejected uses archived styling; no actions exist on terminal rows.

**Independent Test**: Approve one registrant, reject another â†’ each lands in the right terminal tab, shows decision context, offers no action buttons.

- [x] T014 [US3] Render Approved and Rejected tab rows read-only in `src/pages/dashboard/index.jsx` â€” show registrant name, decision date (`decision_at`), reviewer context, and decision reason; Rejected rows get muted/archived styling; clicking still opens the modal for evidence viewing but with no decision buttons on terminal statuses
- [x] T015 [US3] Add terminal-tabs test to `e2e/registrant-filtration.spec.js` â€” assert approved registrant under Approved, rejected under Rejected with archived styling; assert no approve/reject controls render on terminal rows. NOTE: seeded `id_verifications`/`user_profiles` rows cannot be deleted with the publishable key (RLS) â€” mark seeds with a unique `E2E FILT` name prefix and list them for cleanup via `supabase/cleanup_test_data.sql`

**Checkpoint**: All three stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ship verification + documentation.

- [x] (USER PENDING) Apply `20261110140000_verification_decision_notification.sql` live via the Supabase SQL editor (project has no linked `db push` workflow); record outcome in findings.md and verify a `needs_clarity` decision produces a `notifications` row via probe script
- [x] T017 [P] Run full e2e suite â€” `npx playwright test e2e/registrant-filtration.spec.js e2e/reports-and-notifications.spec.js --reporter=line` â€” all pass; run `npm run build` green
- [x] T018 [P] Update `specs/003-registrant-filtration/findings.md` (create) with implementation notes + spec status â†’ Implemented; commit and push feature + main
- [x] T019 Quickstart validation: walk `specs/003-registrant-filtration/quickstart.md` scenarios 1â€“4 manually and tick each box; clean e2e-seeded registrant rows with `supabase/cleanup_test_data.sql`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies â€” start immediately
- **Foundational (Phase 2)**: Depends on T001/T002 probes â€” **BLOCKS all user stories**
- **User Stories (Phase 3â€“5)**: All depend on Phase 2; can proceed sequentially P1 â†’ P2 â†’ P3 or in parallel across different files
- **Polish (Phase 6)**: Depends on all stories

### User Story Dependencies

- **US1 (P1)**: No story dependencies â€” standalone MVP (tabs + modal reuse)
- **US2 (P2)**: Builds on US1's tab bar for badge placement; resident-home banner is independent
- **US3 (P3)**: Builds on US1's tab bar; terminal-row rendering is additive

### Within Each Story

- T004 bucket derivation â†’ T006 tab bar â†’ T007 list filter â†’ T008 modal gating
- T003 notification migration â†’ T013 e2e assertion
- Migration T003 is parallel-safe with all dashboard work ([P] candidate vs T004/T005 â€” different file)

### Parallel Opportunities

- T002 + T001 (both probes, different targets)
- T003 (migration file) || T004/T005 (dashboard) â€” different files
- T012 (resident-home) || T010/T011 (dashboard) â€” different files
- T016/T017 || T018 (verification vs docs)

---

## Parallel Example: Foundational

```bash
# Run in parallel (different files):
Task: "Create migration supabase/migrations/20261110110000_verification_decision_notification.sql"
Task: "Add status-bucket derivation in src/pages/dashboard/index.jsx"
Task: "Add realtime subscription in src/pages/dashboard/index.jsx"  # sequence after T004 â€” same file
```

## Parallel Example: User Story 2

```bash
# Dashboard badge + note, and resident banner, are separate files:
Task: "Resubmitted badge + prior note in dashboard/index.jsx"
Task: "Extend VERIFICATION_COPY in resident-home/index.jsx"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1 probes â†’ Phase 2 foundational (T003â€“T005)
2. US1 (T006â€“T009) â†’ **STOP** â€” tabs + modal triage demoable
3. Continue US2 â†’ US3 â†’ Polish

### Incremental Delivery

Each story is independently shippable; US1 alone satisfies the core "4 views + modal" ask.
