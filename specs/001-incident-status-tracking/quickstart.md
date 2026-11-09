# Quickstart: Incident Status Tracking Timeline

**Date**: 2026-11-09 | **Feature**: `001-incident-status-tracking`

Runnable validation proving the feature end-to-end. Prereqs: dev server on `:4190` (`npm run start -- --port 4190`), seeded accounts (resident + dispatcher/admin + responder from `create_responder2.sql`), migration applied via Supabase SQL editor.

## 0. Apply DB migration

Run `supabase/migrations/20261109020000_incident_status_history.sql` in the SQL editor. Verify:

```sql
SELECT to_regclass('public.incident_status_history');  -- not null
SELECT to_regclass('public.app_settings');             -- not null
SELECT value FROM app_settings WHERE key='arrival_radius_m';  -- 50
SELECT proname FROM pg_proc WHERE proname LIKE 'mark_incident_arrived%';  -- 2 rows
```

## 1. Timeline advances live (US1/US3 — FR-001..007)

1. **Resident** files a report (photo required) → open "My reports" → open it.
   - Expect: timeline with **Reported** done (timestamp), Assigned/Responding/Arrived/Resolved greyed; live map empty.
2. **Dispatcher** opens the same incident → assign to a responder.
   - Expect on resident modal (no reload, ≤5 s): **Assigned** done with responder name/dept + time; **Responding** now current; responder pin appears on the map.
3. **Responder** opens the incident → press **Acknowledge**.
   - Expect: **Responding** step done (timestamp), map pin keeps updating ≤15 s stale.
4. Repeat the open-modal check on **dashboard** and **report-management** detail — same steps/timestamps (FR-006).

## 2. Proximity-gated Arrived (US2 — FR-011..013, SC-006)

1. In responder-view, while `in-progress` and >50 m from the pin (dev: spoof geolocation or set `arrival_radius_m=5` temporarily):
   - Expect: **Arrived** visible but disabled — "You're ~N m away — move within 50 m".
2. Move within radius (or temporarily widen `arrival_radius_m`) → press **Arrived**.
   - Expect: resident timeline gains **Arrived** (timestamp, "GPS-verified") ≤5 s; button gone; reporter gets a notification.
3. Re-press or replay → no second step (`already_arrived` idempotent).

## 3. Manual arrival fallback (FR-017)

1. Responder with GPS disabled → Arrived shows "Location unavailable — enable GPS".
2. **Dispatcher/admin** opens the incident in dashboard → press **Mark arrived** → timeline shows Arrived ("Marked by staff"), resident sees it live.
3. Confirm no such button exists in responder-view for the assignee.

## 4. Terminal + edge states (FR-008/009)

- Resolve → **Resolved** done (timestamp); responder pin disappears from resident map; if Arrived was skipped it renders "skipped".
- Decline a fresh report → timeline shows **Declined** terminal, no resolved/green state; pin sharing stops.
- Open a pre-migration legacy report → timeline still renders (Reported + current status), no blank/broken steps.

## 5. Gates

- `npm run build` clean.
- `npm test` (Playwright) — `e2e/incident-timeline.spec.js` green.
- Modal a11y spot-check: Esc closes, ≥44 px touch targets, AA contrast.
