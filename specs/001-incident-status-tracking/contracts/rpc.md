# Contract: Arrival RPCs + Read Access

**Date**: 2026-11-09 | **Feature**: `001-incident-status-tracking`

## `mark_incident_arrived(p_report_id uuid) → jsonb`

SECURITY DEFINER. Called by the assigned responder's **Arrived** button (FR-011..013).

**Preconditions (all enforced server-side, in order)**:

| # | Check | Error on failure |
|---|-------|------------------|
| 1 | `auth.uid()` present and caller's profile `role = 'responder'` | `unauthorized` |
| 2 | Report exists, `assigned_to = auth.uid()`, `status = 'in-progress'` | `invalid_state` |
| 3 | No `incident_status_history` row with `to_status='arrived'` for this report | `already_arrived` (idempotent-safe: return existing row instead of error — client treats as success) |
| 4 | Incident coordinates resolvable (columns/attachments) AND caller has a `responder_locations` row | `location_unavailable` |
| 5 | haversine(responder_loc, incident_coords) ≤ `app_settings.arrival_radius_m` (default 50) | `too_far` + `{distance_m, radius_m}` |

**On success** inserts:

```json
{ "to_status": "arrived", "actor_id": "<uid>", "meta": {"method":"gps","distance_m": 12.4} }
```

**Returns**: `{ok: true, arrived_at, distance_m}` — or `{ok:false, error, distance_m?, radius_m?}` consumed by the button's disabled-with-reason UI.

**Client-side preview (UX only)**: responder-view computes the same haversine with `useResponderLocation`-self + `reportCoords` + the cached settings row to disable the button with live reason ("Move within 50 m — you're 312 m away"). RPC re-verifies.

## `mark_incident_arrived_manual(p_report_id uuid) → jsonb`

SECURITY DEFINER. Called by **dispatchers/admins** when responder GPS fails (FR-017).

**Preconditions**: caller `role IN ('admin','dispatcher')`; report exists, `status = 'in-progress'`; no arrived row (same idempotent return).

**Inserts**: `{to_status:'arrived', actor_id:<staff uid>, meta:{method:'manual', marked_by_name}}` — rendered on the timeline like a normal Arrived step.

## Read contract: `incident_status_history`

Client selects via PostgREST (no dedicated RPC needed):

```text
GET /incident_status_history?report_id=eq.<uuid>&order=created_at.asc
select=id,to_status,from_status,created_at,meta,actor:user_profiles!actor_id(full_name)
```

RLS guarantees scoping — reporter sees own incidents' rows; staff see all. Realtime: `postgres_changes` filtered `report_id=eq.<uuid>` (publication added in migration).

## Read contract: `app_settings`

```text
GET /app_settings?key=eq.arrival_radius_m → {value: 50}
```

Client caches for the button's disabled-reason text; RPC reads it fresh each call (never trusts client-supplied radius).

## Notification path

Arrival rows do NOT touch `emergency_reports.status`, so `notify_incident_status` does not fire automatically — FR-014's "feeds the existing notification path" is satisfied by inserting a `notifications` row for `reporter_id` inside the arrival RPCs (same shape as existing incident notifications; verified pattern in `20261030100000_notifications_reconcile.sql`).
