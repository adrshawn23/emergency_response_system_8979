# ERS — Manual End-to-End Test Guide

Step-by-step verification of the full emergency-response workflow and its
sub-functions. Covers registration, incident reporting, dispatch, dept-admin
responder assignment, reassignment requests, responder lifecycle, realtime
tracking, and notifications.

## Test accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@emergency.gov` | `admin123` |
| Dispatcher | `dispatcher@emergency.gov` | `dispatcher123` |
| Dept admin (Fire) | `deptadmin.fire@emergency.gov` | `deptadmin123` |
| Responder | `responder@emergency.gov` | `responder123` |
| Resident | `resident@example.com` | `resident123` |

> `deptadmin.fire` only exists after running
> `supabase/create_deptadmin_fire.sql` in the SQL editor.

Tip: use a second browser or incognito window for the second actor in
realtime checks.

---

## Phase 0 — Registration + approval gate

1. Open `/register` — pick each role and check the form:
   - **Resident / boarder** — no department field shown.
   - **Responder** — department dropdown appears and is **required**
     (submit blocked without it).
   - **Department admin** — same department requirement.
   - **Dispatcher / Administrator** — no department field.
2. Submit a responder signup (any dept) → OTP/verification step appears →
   complete it → lands in a "pending approval" state.
3. Try logging in before approval → blocked / flagged pending.
4. Sign in as `admin` → pending registrations list → **approve** the
   account → log in as the new user → allowed.
5. Negative: register `deptadmin` without a department → form blocks it.

## Phase 1 — Resident files an incident

1. Login as `resident` → **New incident** (`/emergency-report`).
2. Fill: type (e.g. Fire), priority, location text, description →
   **Use my location** captures GPS and shows barangay/boundary status.
3. Negative: submit with empty location/description → blocked.
4. Submit → success → incident appears in the dispatcher view within
   seconds (realtime, no refresh needed).
5. **Duplicate warning** — needs the
   `20261110180000_duplicate_incident_check.sql` migration applied:
   a. File a **Fire** report with GPS (**Use my location**) → submitted.
   b. Immediately file a **second Fire** report at the same GPS → a
      **"This incident may already be reported"** modal lists the first
      report (~Xm away · reported N min ago).
   c. **Cancel** → nothing files; the dispatcher queue still shows only
      one incident.
   d. Repeat → **Submit anyway** → files (different incidents on the same
      street stay possible while the first is still pending).
   e. **Dispatcher assigns** the first incident → file a third same-type
      report at the same GPS → **"This incident is already being
      handled"** — hard block, no submit button; only **Got it** closes.
   f. Same GPS, **different type** (e.g. Medical) → **no** modal — fires
      and medicals at one spot aren't duplicates.
   g. Same GPS, **text-only location** (type the location, no **Use my
      location**) → check is skipped — no coords to compare.
   h. After the first incident is **resolved**, a new same-type report at
      the same spot warns **not** — resolved incidents don't count.

## Phase 2 — Dispatcher dispatches to a department

1. Login as `dispatcher` (second browser) → **Command center** (`/`).
2. Alarm: a new incoming incident triggers the audio alert — the browser
   needs one click first (gesture-unlock).
3. **Incident queue** (`/report-management`) → find the report →
   **Assign** → pick a department (e.g. E2E Fire Dept) → confirm.
4. Expected: report status → `assigned`; auto-dispatch creates
   cross-department-assistance (CDA) rows for assisting departments.
5. Notification: the dept admin gets an assignment notification (bell
   icon — details + deep-link).

## Phase 3 — Dept admin accepts + assigns responder

1. Login as `deptadmin.fire` → **Incident queue** → the incident is in
   their dept-scoped view.
2. The responder select shows ("Assign responder…") → choose the fire
   responder → **Assign**.
3. On the row: the dept select is **locked to their department**; the
   responder picker is enabled.
4. Negative: the dept admin has **no** direct reassign-to-other-department
   control — only `Request reassign` (feature intent: only dispatchers
   change the assigned department).
5. Notification: the responder gets an assignment notification with
   incident details.

## Phase 4 — Reassignment request

1. As `deptadmin.fire` → queue row → **Request reassign** → modal:
   - **Send request stays disabled** until a reason is typed (required).
   - Fill a reason → **Send request** → the blue **"Reassignment
     requests"** banner appears at the top with the reason + a `pending`
     chip (realtime).
2. Duplicate guard: the row's `Request reassign` button disappears while a
   pending request exists for that report.
3. Withdraw: the dept admin can retract their own pending request from the
   banner → status `cancelled`.
4. As `dispatcher` → the same banner shows **Reassign** + **Dismiss**:
   - **Dismiss** → status → `denied`; the row stays listed with the chip.
   - **Reassign** → assignment modal opens → pick a different department →
     confirm → the incident's `assigned_department_id` changes and the
     request → `approved`; the dept admin sees the outcome.
5. Command center: the dispatcher sees a pending-request banner with a
   **"Review in queue"** shortcut.

## Phase 5 — Responder lifecycle

1. Login as `responder` → sees the assigned incident → acknowledge /
   respond.
2. Directions — navigation / route to the incident coordinates shown.
3. Live pin: while the assignment is open, the GPS watch streams position
   → the dispatcher's map pin + driving route update in near-realtime
   (move >~20 m to see it). **An idle responder's pin freezes** — tracking
   is assignment-gated by design.
4. **Mark arrived** → geofence check:
   - Far from the incident → blocked with a distance message
     ("~Xm away — move within Rm").
   - Within the radius → arrival recorded → the reporter can see it.
5. **Resolve** the incident → status → `resolved` → every open view
   updates via realtime.

## Phase 6 — Notifications + misc checks

- **Bell menu:** click a notification → deep-links to the relevant view;
  unread styling clears.
- **Stale assignment:** an assigned report untouched >10 min gets the
  `no response` / stale badge on the queue row.
- **Reports page** (`/reports`) → the incident detail modal shows the
  timeline, location, and responder.
- **Direct-URL guard:** log in as resident and hit `/report-management` →
  redirected (route guard).
- **CDA flow:** assisting departments see the assistance request →
  Accept/Decline → status reflected on the dispatcher's CDA banner.

---

## Pass criteria (one line each)

- Duplicate submit: pending match warns (Cancel / Submit anyway);
  dispatched match hard-blocks "already being handled" — no submit path.
- Registration gates the department requirement + approval.
- Incident → dispatch → dept-admin responder assignment works end to end.
- Dept admin **requests** but never **directly reassigns**; the dispatcher
  acts on the request; the reason is mandatory and visible.
- Responder pin is live only during an active assignment; the geofence
  blocks far-away arrival.
- All views update without refresh (realtime).
