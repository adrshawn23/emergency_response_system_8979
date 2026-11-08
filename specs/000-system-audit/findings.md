# System Audit — End-to-End Workflow Findings

**Method**: `/speckit.converge`-style assessment of the live codebase against
`.specify/memory/constitution.md` v1.0.0, walking every role's flow
(resident register -> verify -> report -> track; dispatcher queue -> assign;
responder acknowledge -> resolve; admin review -> approve/notify).
**Date**: 2026-11-08. **Baseline**: commit `f1dbc0c`.
**Gap types**: `contradicts` (violates a constitution MUST), `partial`,
`missing`, `unrequested` (dead/unreachable code).

Each finding becomes its own bounded `/speckit.specify` feature — do not
batch unrelated fixes into one change.

---

## CRITICAL

### F-01 · Responder never sees a new assignment live — `contradicts` (V)
**Where**: `src/pages/responder-view/index.jsx:75-80`
**Evidence**: realtime handler is
`setAssignedReports(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))`.
A fresh assignment arrives as an UPDATE (dispatcher sets `assigned_to`), but
`prev.map` only replaces rows already in state — a report not yet in the list
is dropped. The responder must refresh to see the dispatch.
**Fix shape**: on UPDATE, upsert (append if absent, replace if present);
remove when `assigned_to` no longer matches. Playwright: dispatcher assigns ->
responder board shows card without reload.

### F-02 · Server-side gates may not be applied — `missing` (I, III)
**Where**: `supabase/migrations/20261030101000_verification_enforcement.sql`
**Evidence**: `review_verification()` writes `approved_at`/`approved_by`;
the live `user_profiles` schema (column probe) has neither. Either the
migration is unapplied — meaning `caller_can_report()` (the DB gate stopping
pending residents from inserting reports) and the atomic review RPC are NOT
live and the admin UI is silently using its direct-update fallback — or it
was applied with columns added. Must be verified in the SQL editor:
`select proname from pg_proc where proname in ('review_verification','caller_can_report');`
`select column_name from information_schema.columns where table_name='user_profiles' and column_name like 'approved%';`
**Fix shape**: reconcile migration vs live schema; apply the gate. Until
then, Principle I is violated for incident reporting (client-only check).

### F-03 · Photo evidence is client-only — `partial` (I)
**Where**: `src/pages/dashboard/index.jsx` `submitIncident`;
`emergency_reports` RLS/INSERT policy.
**Evidence**: resident ≥1-photo rule exists only in React (shipped fa846c9).
No policy/trigger rejects a direct insert with empty `attachments.images`.
**Fix shape**: INSERT check (trigger or policy) — resident role AND
`jsonb_array_length(coalesce(attachments->'images','[]')) = 0` -> reject.
Staff exempt. Playwright via direct REST call.

---

## HIGH

### F-04 · `select('*')` on `emergency_reports` in list contexts — `contradicts` (IV)
**Where**:
- `src/pages/responder-view/index.jsx:60-64` (assigned reports list)
- `src/pages/responder-view/index.jsx:93` (`report:emergency_reports(*)` join)
- `src/services/supabaseService.js:6-32, 67-83` (`getReports`,
  `getUserReports`, `searchReports`)
**Evidence**: each pulls full `attachments` JSONB (base64 media) per row —
the exact payload problem the slim view was created to fix. The responder
board loads every assigned incident's photos up-front.
**Fix shape**: switch to `emergency_reports_list`; lazy-fetch full row on
modal open (pattern already in `handleReportClick`).

### F-05 · Dead pages still imported — `unrequested`
**Where**: `src/Routes.jsx:8-17`
**Evidence**: `DepartmentManagement`, `UserManagement`, `ReportManagement`,
`EmergencyReport`, `Profile` are imported but no `<Route>` renders them —
every route maps to `Dashboard section=...`. They ship in the 1.6 MB bundle
and contain stale logic (`.eq('report_id', ...)` updates, `decline_reason`
column, standalone report form that validates images then never writes
them). Edits made to `src/pages/emergency-report/index.jsx` earlier this
session were therefore no-ops.
**Fix shape**: remove the imports + delete or archive the unrouted pages
after confirming no other importer. `supabaseService.emergencyReportsService`
is only consumed by `useSupabaseData.js` — verify that hook is live or dead
too.

### F-06 · Approval email delivery unverified — `partial`
**Where**: `notify-decision` Edge Function; `_shared/email.ts`
**Evidence**: user reports no email on approval; invocation errors were
silently swallowed until fa846c9 added `console.warn`. Secret confirmed
present. Resend's `onboarding@resend.dev` fallback sender only delivers to
the account owner's email — likely the cause for other recipients.
**Fix shape**: set `EMAIL_FROM` to a verified domain sender; capture the
warn output from one approval to confirm. Not a code change until verified.

---

## MEDIUM

### F-07 · Responder channels use `unsubscribe()` not `removeChannel` — `contradicts` (V)
**Where**: `src/pages/responder-view/index.jsx:83, 107`
**Evidence**: `subscription.unsubscribe()` leaves the channel object in the
client's channel list; constitution requires `removeChannel`. Third effect
(line 137) does it correctly — inconsistent.

### F-08 · `signOut` nukes all localStorage — `partial`
**Where**: `src/contexts/AuthContext.jsx:142`
**Evidence**: `localStorage.clear()` deletes unrelated keys
(`emergency-report-draft`, any future prefs) — a resident mid-report who
signs out loses the draft. Scope to `supabase.*`/`ers.*` keys.

### F-09 · Report-management fallback paths write non-existent columns — `partial` (III)
**Where**: `src/pages/report-management/index.jsx:186, 210, 245`
**Evidence**: `.eq('report_id', …)` and `decline_reason` — not in live
schema per constitution III. Dead page (see F-05) but if revived would fail
silently. Resolve via F-05.

### F-10 · Pending-registration count semantics — `partial` (II)
**Where**: `src/hooks/usePendingRegistrations.js`
**Evidence**: badge counts every `status='inactive'` profile — includes
rejected-but-not-reactivated users and auto-rejected no-document rows,
not only *actionable* pending ones. Admin may see a count with nothing to
approve.
**Fix shape**: join on open `id_verifications` (`pending|needs_clarity|
correction_required`) or add `account_status='pending'` filter — decide in
clarify.

---

## LOW

### F-11 · `useNotifications` fallback writes may fail silently — `partial`
**Where**: `src/hooks/useNotifications.js:84-90, 97-102`
**Evidence**: on RPC error it falls back to direct UPDATE and ignores the
result; read-state can desync from optimistic UI with no signal.

### F-12 · No Playwright coverage for the badge or assistance flows — `missing` (VII)
**Where**: `e2e/` (16 specs)
**Evidence**: no spec covers pending-registration badge, cross-department
assistance accept/decline, responder live location, or resolution-proof
requirement. Features shipped this week have zero regression protection.

---

## Suggested order

1. F-02 (verify in SQL editor — 2 queries, decides F-03's shape)
2. F-01 (small, user-visible, high value)
3. F-04 responder-view portion
4. F-05 (bundle + stale-logic removal; unlocks deleting F-09)
5. F-03, F-06, F-10, F-07, F-08, F-11, F-12
