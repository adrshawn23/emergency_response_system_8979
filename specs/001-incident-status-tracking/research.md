# Research: Incident Status Tracking Timeline

**Date**: 2026-11-09 | **Feature**: `001-incident-status-tracking`

Research tasks resolved against the live codebase (no external unknowns remained after codebase inspection — all "NEEDS CLARIFICATION" candidates in Technical Context were answered by reading `src/` + `supabase/migrations/`).

## R1 — Where does history live?

- **Decision**: New append-only table `public.incident_status_history` + AFTER UPDATE trigger on `emergency_reports` for status transitions; the `arrived` event is inserted by a SECURITY DEFINER RPC (it is not a `report_status` enum value).
- **Rationale**: Keeps the enum clean (`arrived` is not a lifecycle status — report stays `in-progress`); a trigger guarantees EVERY writer path (dispatcher assign, responder acknowledge/resolve, admin decline, RPC fallbacks, SQL edits) records history without touching each client call-site; append-only rows give true per-step timestamps instead of guessing from `updated_at`.
- **Alternatives considered**:
  - `attachments.status_history` JSONB — rejected: RLS on `emergency_reports` is whole-row; residents could read staff-internal metadata; realtime payload duplication; harder querying.
  - New `report_status` value `'arrived'` — rejected: status semantics (what the report IS) vs event (what HAPPENED); every status switch/UI filter would need migration for a transient state.
  - Reuse `notifications`/audit tables — rejected: different purpose, noisy join semantics, no per-incident contract.

## R2 — How is "Arrived" gated server-side?

- **Decision**: `mark_incident_arrived(p_report_id)` SECURITY DEFINER function. Checks, in order: caller is authenticated responder and `emergency_reports.assigned_to = auth.uid()`, status = `'in-progress'`, no existing arrived row for the report, incident has coordinates, and haversine distance between the caller's `responder_locations` row and the incident ≤ radius from `app_settings` (`arrival_radius_m`, default 50). Success inserts `incident_status_history(to_status='arrived', meta.method='gps')`.
- **Rationale**: Constitution I — client-side distance math is UX affordance only; the RPC re-verifies with the server's copy of the responder's position so a modified client cannot forge arrival. PostGIS is NOT confirmed live (no migration references it), so plain haversine math in PL/pgSQL instead of `ST_DWithin`.
- **Alternatives considered**:
  - Client passes its own coords to RPC — rejected: trivially spoofable; server already holds `responder_locations`.
  - PostGIS `ST_DWithin` — deferred: faster/cleaner but requires confirming `postgis` extension live; haversine over one row is identical in cost.
  - Manual-mark handled by the same RPC — split: `mark_incident_arrived_manual` requires admin/dispatcher role and records `meta.method='manual'`, `meta.marked_by`. Single RPC with role branching also worked but two entry points read cleaner and keep RLS-independent role checks explicit.

## R3 — How does every role see the timeline?

- **Decision**: Shared `src/components/IncidentTimeline.jsx` + `src/hooks/useIncidentHistory(reportId)`; rendered inside the four existing detail surfaces. Step state derived by folding history rows onto the canonical chain `pending → assigned → in-progress → arrived → resolved` (+ declined terminal).
- **Rationale**: One component guarantees the FR-006 "identical content" requirement; hook encapsulates fetch + realtime (unique channel name, `removeChannel` — constitution V). Legacy reports with no history rows fall back to synthesizing steps from `created_at`/`resolved_at`/current status (spec FR edge case) — timeline never renders empty.
- **Alternatives considered**:
  - Timeline as a column on `emergency_reports_list` — rejected: list view is slim-by-design (constitution IV); timeline is a detail-modal concern.
  - Four copy-pasted timelines — rejected: drift guarantee, triple maintenance.

## R4 — Live responder map for residents: build or reuse?

- **Decision**: REUSE — already implemented and live: `responder_locations` table + `responder_locations_reporter_read` RLS policy + `useResponderLocation(s)` + `BoundaryMap` markers + `useDrivingRoutes` in `resident-home` (lines ~58-85, ~204-221). FR-015/016 are satisfied by existing code.
- **Rationale**: Verified in codebase on 2026-11-09. Two gaps remain vs spec: (a) RLS policy + client gating use `status <> 'resolved'` — `declined` reports keep the pin alive (spec edge case says terminal state ends sharing); (b) responder GPS writes throttle at ≥20 m/≥20 s — SC-008 demands ≤15 s stale.
- **Alternatives considered**:
  - Separate resident-facing location view — rejected: the policy already scopes correctly; duplicating storage doubles write load.
  - Leave `declined` behavior — rejected: spec FR-015 says sharing stops on terminal states; fix = broaden predicates to `status NOT IN ('resolved','declined')` in policy + both client gates (`hasOpenAssignment`, modal map condition).

## R5 — Where does the ~50 m radius live?

- **Decision**: New `public.app_settings` table `(key TEXT PK, value JSONB, updated_at, updated_by)` seeded with `arrival_radius_m = 50`; SELECT for `authenticated`, write for admin/dispatcher only. RPC reads it fresh each call.
- **Rationale**: "Administrator-configurable" per FR-012/clarification Q2; a settings row avoids redeploys and is extensible for future thresholds. No existing generic settings table was found (`settings` page key exists in `page_permissions`, but it manages route visibility, not kv config).
- **Alternatives considered**:
  - Column on `geofence_boundaries` — rejected: radius is unrelated to the polygon; keeps migration coupling weird.
  - Hardcoded constant in RPC — rejected: defeats FR-012's configurability.

## R6 — Timeline vs realtime staleness

- **Decision**: `useIncidentHistory` subscribes to `postgres_changes` on `incident_status_history` filtered `report_id=eq.<id>`; table added to `supabase_realtime` publication in the migration (same `pg_publication_tables` guard as `responder_locations` migration).
- **Rationale**: Matches FR-007/SC-002 (≤5 s without reload) and existing codebase realtime pattern.
- **Alternatives considered**: polling — rejected: wasted requests, worse latency, inconsistent with house style.

## Open items for implementation

- ~~Probe live DB before applying migration~~ **DONE 2026-11-09 (T001)**: `emergency_reports.status/assigned_to/assigned_department_id/reporter_id/resolved_at/attachments/report_id/updated_at` all exist; **no `latitude`/`longitude`/`location` columns** — coords live in `attachments.latitude|longitude` (verified on live rows, e.g. `10.297085, 123.907249`) with `"GPS: lat, lng"` in `attachments.location` as fallback (RPC mirrors `reportCoords`). `responder_locations`, `cross_department_assistance`, `notifications` live; `incident_status_history` and `app_settings` do not exist (PGRST205) — migration creates them; `mark_incident_arrived` absent (PGRST202). Publication membership handled by guarded `ALTER PUBLICATION` in the migration itself.
- `arrived` rows need a partial unique index (`WHERE to_status='arrived'`) — one arrival per incident (spec: no duplicate arrival steps).
- Actor attribution: trigger uses `auth.uid()` — fine for client-driven updates; SQL-editor edits record NULL actor (acceptable, meta notes it).
