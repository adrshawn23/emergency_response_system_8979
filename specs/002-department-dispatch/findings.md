# Department Dispatch — Post-Implementation Audit Findings

**Method**: `/speckit.converge`-style assessment of the department-dispatch
restructure (dispatcher assigns main dept -> auto-dispatch CDA ->
per-department admin assigns responders) against
`.specify/memory/constitution.md` v1.0.0. No spec/plan/tasks artifacts exist
for this work — it shipped ad-hoc, so this audit is the traceability doc.
**Date**: 2026-11-09. **Baseline**: commit `c587474` + migrations
`20261109050000`–`20261109080000` applied to live DB.
**Gap types**: `contradicts`, `partial`, `missing`, `unrequested`.

**Intent under test** (user requirement, verbatim):
> Dispatcher assigns the main department first; cross-department requests
> only go out after that; each department's admin assigns the responder who
> goes — including on cross-department requests.

---

## CRITICAL

### D-01 · Dept admin can self-assign unassigned incidents — `contradicts` (I)
**Where**: `dept_admin_update_reports` USING clause
(`20261109080000_dispatch_gate_and_cda_responder.sql`).
**Evidence**: `USING ( is_department_admin() AND (assigned_department_id IS
NULL OR assigned_department_id = my_department_id()) )` — the `IS NULL`
branch lets a dept admin write `assigned_department_id = own` onto any
pending incident. That UPDATE fires `trg_auto_dispatch_assistance`, which
fans out CDA rows — **the exact dispatcher-gate bypass the feature exists
to prevent**. The queue UI hides the button for unassigned reports, but
RLS is the boundary and it permits the claim.
**Fix shape**: drop the `IS NULL` branch from USING (rows must already be
owned by the admin's dept). Claiming unassigned incidents is dispatcher
work. Playwright: dept admin API-calls update on a pending report -> 0 rows.

### D-16 · Live `departments` table has NO `type` column — `contradicts` (III)
**Where**: live schema probe vs `auto_dispatch_assistance()`
(`20261109050000`/`20261109090000`) and `CreateDepartmentModal.jsx`.
**Evidence**: live columns are `id, name, description,
parent_department_id, status, permissions, created_at, updated_at` — the
original schema's `type public.department_type NOT NULL` was never applied.
The auto-dispatch function queries `d.type = ANY(v_types)`, so every
`assigned_department_id` write throws `column d.type does not exist` and
rolls back the dispatcher's whole update — **the dispatch gate is broken
in production**. Confirmed via REST probe: insert with `type` → PGRST204.
The create-department modal even has a dormant `typeOptions` array — dead
code proving the field was dropped mid-refactor.
**Fix shape**: migration `20261109100000` adds `type` (nullable — untyped
depts simply receive no auto-dispatch) + name-pattern backfill; modal
wires the select through to the insert. Responder assignment unaffected
(dept membership is `user_profiles.department_id`, not type-driven).

### D-02 · Incident queue reads full `emergency_reports` — `contradicts` (IV)
**Where**: `src/pages/dashboard/index.jsx:268-270` and `:1879-1882`
(both queue components), plus post-submit refresh `:1088`.
**Evidence**: `.from('emergency_reports').select('*')` in list contexts —
pulls every row's `attachments` base64 media. The slim view
`emergency_reports_list` exists for exactly this and already exposes
`assigned_department_id`/`assigned_to`, so the new dept_admin button and
assist gating work identically through it. The `:579` comment claims list
rows come from the slim view — they do not.
**Fix shape**: swap list fetches to `emergency_reports_list`; keep lazy
full-row fetch on open (pattern already in place). Carried over from
audit-000 F-04 scope — the queue was missed then.

---

## HIGH

### D-03 · Reassignment leaves stale CDA rows for the old main dept — `missing`
**Where**: `auto_dispatch_assistance()` (`20261109050000`) + retargeted
trigger (`20261109080000`).
**Evidence**: on `UPDATE OF assigned_department_id` the function inserts
for the NEW dept's mapping but never cancels pending auto-dispatch rows
pointing at the OLD `assigned_department_id`. Reassign fire -> police and
fire keeps a pending "assist" request for an incident it now owns.
**Fix shape**: inside the function on UPDATE, `UPDATE cda SET
status='cancelled' WHERE report_id=NEW.id AND notes='auto-dispatch' AND
status='pending' AND assisting_department_id = OLD.assigned_department_id`
(plus any row whose assisting dept = NEW main dept — main can't assist
itself).

### D-04 · `responder_id` dept boundary unenforced on the responder path — `partial` (I)
**Where**: `cda_staff_update` (`20261104120000`) vs
`dept_admin_cda_update` (`20261109080000`).
**Evidence**: policies OR together — a responder in the targeted dept passes
`cda_staff_update` and can write `responder_id` to **any** user (any dept,
any role); the dept-membership check on `responder_id` exists only in the
dept_admin policy. A dept responder can also overwrite the admin's choice.
**Fix shape**: `cda_staff_update` WITH CHECK must also require
`responder_id IS NULL OR responder_id IN (dept members)`; or gate
responder_id changes to the dept_admin/staff paths via a trigger.

### D-05 · Dept admin update policy is row-scoped, not column-scoped — `partial` (I)
**Where**: `dept_admin_update_reports` (both migrations).
**Evidence**: once row + CHECK pass, the dept admin may write **any**
column — `content`, `priority`, `reporter_id`, `status='resolved'` on an
incident they merely co-own. Nothing restricts the write to assignment
fields. Grant-by-column needs a trigger or a `SECURITY DEFINER` assign RPC.
**Fix shape**: `BEFORE UPDATE` trigger — when caller is dept_admin and not
staff, reject changes to non-assignment columns; or move dept-admin
assignment to an RPC and drop the broad update policy.

### D-06 · Assignee checks don't verify role or active status — `partial` (I)
**Where**: `dept_admin_update_reports` and `dept_admin_cda_update`
WITH CHECK subqueries on `user_profiles r`.
**Evidence**: only `r.department_id = my_department_id()` is tested — a dept
admin can assign another dept_admin, a resident, or an inactive member via
direct API. Client selects filter `role='responder' AND status='active'`,
but per I that is UX-only.
**Fix shape**: add `AND r.role = 'responder' AND r.status = 'active'` (or
role in `('responder','department_admin')` if admins may self-dispatch) to
both CHECKs.

### D-07 · Zero e2e coverage for the entire new flow — `missing` (VII)
**Where**: `e2e/` — no spec covers dispatch gate, dept-admin main-dept
responder assignment, or CDA responder assignment.
**Evidence**: shipped untested beyond build. Required specs: dispatcher
dept-only assign -> CDA rows appear (and NOT before); dept_admin assigns
responder on own-dept incident; dept_admin assigns responder on CDA row ->
status accepted; dept admin cannot act on other dept's incident (policy).

---

## MEDIUM

### D-08 · Dept members still see/can-answer CDA assigned to someone else — `partial`
**Where**: `src/pages/responder-view/index.jsx:111-116` fetch filters by
`assisting_department_id` only; `respondAssistance` accepts/declines any row.
**Evidence**: after the dept admin picks responder B, the request still
renders for every dept responder and any of them can accept/decline —
the admin's assignment carries no weight in responder-view.
**Fix shape**: decide policy — either filter to `responder_id IS NULL OR
responder_id = auth.uid()` (assignment becomes exclusive), or keep
broadcast but badge "assigned to {name}" so others stand down. DB: pair
with D-04's CHECK fix.

### D-09 · `responded_by` now stores the dept admin — `partial`
**Where**: `handleCdaResponderAssign` writes `responded_by = profile.id`.
**Evidence**: column semantics were "the responder who accepted/declined";
now it may hold an admin id. Responder-view "accepter" join and any
responded_by = me queries inherit the ambiguity.
**Fix shape**: either keep as deliberate "actor" column (document) or add
`assigned_by` and leave `responded_by` for genuine responder actions.

### D-10 · Incident shows `assigned` with no responder — `partial`
**Where**: dispatcher patch `{ assigned_department_id, status:'assigned' }`.
**Evidence**: queue reads "assigned" while unstaffed; residents tracking
the incident see assigned before anyone is en route.
**Fix shape**: dept-assigned status (e.g., `dispatched`) vs responder-
assigned, or accept as cosmetic — decide.

### D-11 · Manual assist modal can select the main dept — `partial`
**Where**: `handleAssistanceClick`/`selectedAssistanceDepts` — all
departments offered, no exclusion of `report.assigned_department_id`.
**Evidence**: dispatcher can "request assistance" from the dept that owns
the incident; unique constraint dedupes but the row is nonsense.
**Fix shape**: filter the dept list; same fix in auto-dispatch already
skips main dept.

### D-12 · `department_admin` with NULL `department_id` is silently dead — `missing`
**Where**: all `my_department_id()`-scoped policies; queue button compares
to NULL (never true).
**Evidence**: misconfigured account sees the queue but can act on nothing —
no error, no admin signal.
**Fix shape**: surface a banner in Dashboard when `role==='department_admin'
&& !department_id`; optionally validate department_id NOT NULL for the role.

---

## LOW

### D-13 · Static realtime channel names — `partial` (V)
**Where**: `index.jsx` `workspace_cda_changes`, `dashboard_cda_changes`.
**Evidence**: constitution wants unique names per subscriber instance
(responder-view already uses `Math.random()` suffixes). Collision only if
the same component instance double-mounts — low risk today.
**Fix shape**: suffix with `useId()`/random like responder-view.

### D-14 · No re-assign path for a CDA responder — `partial`
**Where**: CDA list — once `responder_id` set it renders a name, no select.
**Evidence**: main-dept incidents get a Reassign button; CDA rows don't.
**Fix shape**: keep the select visible for pending/accepted rows with
current value preselected.

### D-15 · Feature shipped without spec artifacts — `unrequested` (process)
**Where**: `specs/` — no `NNN-department-dispatch/` spec/plan/tasks.
**Evidence**: constitution's workflow chain wasn't run; this findings doc is
the only trace. Specs define the change — a retrospective spec would still
help converge verify remaining intent (e.g., reassignment semantics D-03).
**Fix shape**: `/speckit.specify` a spec capturing intended behavior incl.
edge cases, then converge against it.

---

## Verified OK

- Trigger retarget applied live (`AFTER INSERT OR UPDATE OF
  assigned_department_id ... WHEN NOT NULL`) — user confirmed apply.
- Dept boundary on dept_admin row scope (D-01 aside): `USING` gates rows to
  owned dept; CDA select/update scoped to `assisting_department_id = mine`.
- `is_department_admin()`/`my_department_id()` are `SECURITY DEFINER` with
  `SET search_path` — recursion fixed in `20261109070000`.
- Manual assist button gated on `assigned_department_id`; dispatcher modal
  hides responder select; dept_admin modal locks dept to own.
- `DEFAULT_PAGE_ROLES` + `page_permissions` grant dept_admin queue/profile.
- Build green (`npm run build`, c587474).

## Resolution status (2026-11-09)

**Fixed — migration `20261109090000_dispatch_audit_fixes.sql` (applied):**
- D-01 `IS NULL` dropped from `dept_admin_update_reports` — owned rows only
- D-03 function cancels stale pending CDA rows on main-dept reassignment
- D-04 `cda_staff_update` CHECK validates `responder_id` dept-membership
- D-05 `dept_admin_report_column_guard` trigger — assigned_to/status only
- D-06 both assignee CHECKs require `role='responder' AND status='active'`

**Fixed — migration `20261109100000_departments_type_column.sql`:**
- D-16 adds missing `departments.type` column + name-pattern backfill;
  `CreateDepartmentModal` type select wired through (was dormant UI code)

**Fixed — code:**
- D-02 queue lists read `emergency_reports_list` (3 fetches)
- D-08 responder-view: assigned CDA rows exclusive to assignee
  (`responder_id.is.null OR eq.me`), unassigned still broadcast
- D-13 unique realtime channel suffixes
- D-14 CDA responder select stays visible for reassignment
- D-11 (re-check) already handled — assist modal filters main dept
- D-12 NULL-department banner for dept_admin

**Tests added:** `e2e/department_dispatch.spec.js` (gate + auto-dispatch +
env-gated dept-admin flow via `E2E_DEPT_ADMIN_EMAIL/PASSWORD`);
`workflow.spec.js` Phase 2 updated for dept-only dispatcher modal +
Phase 2.5 API responder assignment (`assignResponderToReport` helper).

**Documented decisions (no change):**
- D-09 `responded_by` = the acting dept admin — kept deliberately; the
  column records *who acted*, admin or responder
- D-10 `assigned` with no responder — accepted as cosmetic for now
- D-15 process note only

**Remaining:** D-07 partially met (dept-admin UI path needs the env-gated
account to actually run); no other open findings.
