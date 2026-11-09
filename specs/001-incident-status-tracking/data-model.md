# Data Model: Incident Status Tracking Timeline

**Date**: 2026-11-09 | **Feature**: `001-incident-status-tracking`

## New: `public.incident_status_history`

Append-only transition log — the timeline's source of truth (FR-005).

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, `gen_random_uuid()` |
| `report_id` | `uuid` | NO | FK → `emergency_reports(id)` ON DELETE CASCADE |
| `from_status` | `text` | YES | Previous status; NULL for the seed row ('reported') |
| `to_status` | `text` | NO | `pending`/`assigned`/`in-progress`/`resolved`/`declined`/`arrived` — `arrived` is event-only, never written to `emergency_reports.status` |
| `actor_id` | `uuid` | YES | `auth.uid()` at transition time; FK → `user_profiles(id)` ON DELETE SET NULL |
| `meta` | `jsonb` | YES | Context: `{method:'gps'|'manual', marked_by, responder_name, dept, distance_m}` — display-only, never security-relevant |
| `created_at` | `timestamptz` | NO | `default now()` — the step timestamp |

**Constraints / indexes**
- `idx_incident_history_report (report_id, created_at)` — timeline lookup.
- Partial unique `uq_incident_arrived` on `(report_id) WHERE to_status='arrived'` — one arrival per incident (edge case: double-tap).
- Seed row per report on INSERT (`to_status='pending'`, `from_status=NULL`, `meta.source='report_filed'`)? — **decision: no backfill trigger on INSERT**; `created_at` on `emergency_reports` already is the "Reported" timestamp, so the timeline synthesizes step 1 client-side and history rows begin at first transition. Keeps triggers single-purpose.

## New: `public.app_settings`

| Column | Type | Notes |
|--------|------|-------|
| `key` | `text` | PK |
| `value` | `jsonb` | e.g. `50` |
| `updated_at` | `timestamptz` | `default now()` |
| `updated_by` | `uuid` | FK → `user_profiles(id)` SET NULL |

Seed: `('arrival_radius_m', '50')` — FR-012.

## Existing tables (read/touched, no new columns)

- **`emergency_reports`**: `status` (enum, canonical chain minus arrived), `assigned_to`, `assigned_department_id`, `reporter_id`, `created_at`, `resolved_at`, `attachments`.
- **`responder_locations`**: source of responder position for the RPC distance check and the resident map pin.
- **`cross_department_assistance`**: unaffected; assisting responders appear on the map but cannot press Arrived (FR-011: assignee only).

## State transitions

```text
emergency_reports.status (trigger records each hop):
  pending → assigned → in-progress → resolved
     └──────────────────────────────→ declined (from any non-terminal state)

incident_status_history.to_status (events):
  mirrors status hops, PLUS 'arrived' — inserted only by the arrival RPCs,
  report's top-level status stays 'in-progress' until resolved/declined.
```

## Validation rules (enforced server-side)

- History SELECT: reporter sees own reports' rows; staff (admin/dispatcher/responder) see all — mirrors `responder_locations` policy shape. INSERT/UPDATE/DELETE: no direct grants — trigger (definer) and RPCs only.
- `mark_incident_arrived`: reject unless caller is the assignee, status=`in-progress`, no arrived row yet, coords present on both sides, distance ≤ `arrival_radius_m` (haversine, meters).
- `mark_incident_arrived_manual`: reject unless caller role ∈ {admin, dispatcher}; same no-duplicate guard; `meta.method='manual'`.
- `app_settings`: SELECT for `authenticated`; INSERT/UPDATE/DELETE for admin/dispatcher only.

## Client-side entity: Tracking Step

Pure presentation map (in `IncidentTimeline.jsx`): status → {label, description, icon, tone}. States: `done` (history row exists), `current` (latest relevant event / live status), `upcoming` (not reached), `skipped` (chain passed it without a row — e.g. resolved with no `arrived`), `declined` (terminal). Legacy fallback: if zero history rows, synthesize `done` steps from `created_at`, `resolved_at`, current status.
