# Implementation Plan: Incident Status Tracking Timeline

**Branch**: `001-incident-status-tracking` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-incident-status-tracking/spec.md`

## Summary

Add a Shopee-parcel-style incident tracking experience: a shared step timeline (Reported -> Assigned -> Responding -> Arrived -> Resolved, with a Declined terminal branch) rendered in every incident-detail surface, backed by a new append-only `incident_status_history` table populated by a DB trigger so every transition — including the GPS-gated responder "Arrived" event and staff manual marks — is recorded with timestamp and actor.

Key reuse discovered during planning: **the live responder map already ships** (`responder_locations` + RLS + `useResponderLocation(s)` + OSRM routes in resident-home). The remaining work is the history table + timeline UI + the `mark_incident_arrived` RPC (server-side haversine gate, ~50 m configurable radius in a new `app_settings` row), plus small correctness fixes: `declined` must also stop GPS sharing, and the GPS write throttle (20 s) must tighten to satisfy SC-008 (<=15 s).

## Technical Context

**Language/Version**: JavaScript (JSX), React 18, Vite; PL/pgSQL for triggers/RPC (Supabase Postgres 15)

**Primary Dependencies**: @supabase/supabase-js v2, React-Leaflet/`BoundaryMap`, Tailwind CSS, existing utils `reportCoords`, `geofence`, `useDrivingRoutes`

**Storage**: Supabase Postgres — new `incident_status_history` + `app_settings` tables; existing `emergency_reports`, `responder_locations`

**Testing**: Playwright e2e (`e2e/`, `npm test`); `npm run build` gate

**Target Platform**: Web app (desktop + mobile browsers)

**Project Type**: Single Vite SPA + Supabase backend

**Performance Goals**: Timeline visible <1 s after modal open; status updates reflected <=5 s realtime; GPS pin <=15 s stale

**Constraints**: RLS is the only security boundary; no `SELECT *` on `emergency_reports` lists; realtime channels need unique names + `removeChannel` cleanup; migrations applied manually via SQL editor

**Scale/Scope**: 4 detail surfaces, 1 shared component + 1 hook, 1 table + 1 settings table + 1 RPC + 2 triggers, ~3 file-touch fixes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. RLS boundary** — PASS with design constraint: history reads via RLS (reporter-own + staff); inserts ONLY via trigger/definer RPC; `mark_incident_arrived` distance + role checks enforced server-side, client disablement is UX-only. Manual arrival gated to admin/dispatcher in the RPC.
- **II. Roles canonical** — PASS: `dispatcher`/`admin` for manual marks, `responder` for the button, `resident` read-scoped.
- **III. Live schema beats migrations** — ACTION: probe live DB for `responder_locations`, `emergency_reports` columns (`assigned_to`, `resolved_at`, `reporter_id`), and publication membership before/at migration apply; migration is idempotent (`IF NOT EXISTS`).
- **IV. No large payloads in lists** — PASS: history table is small rows; timeline fetches per-incident on modal open only.
- **V. Realtime discipline** — PASS: `useIncidentHistory` uses unique channel names + `removeChannel`; history table added to `supabase_realtime` publication.
- **VI. Change discipline** — PASS: new shared component + minimal edits in modals; dashboard file tail verified after edits (known corruption pattern).
- **VII. Test-verified** — PASS: e2e scenario added to `e2e/` for timeline + arrival; build gate before push.

Post-design re-check: no violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-incident-status-tracking/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (RPC + component contracts)
│   ├── rpc.md
│   └── ui.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20261109020000_incident_status_history.sql   # table + RLS + triggers + mark_incident_arrived + app_settings + publication + declined-policy fix

src/
├── components/
│   ├── IncidentTimeline.jsx          # NEW shared step timeline (all roles)
│   └── ServiceAreaBadge.jsx          # existing — unchanged
├── hooks/
│   └── useIncidentHistory.js         # NEW fetch + realtime upsert of history rows
├── pages/
│   ├── resident-home/index.jsx       # + <IncidentTimeline>, declined-aware map gating
│   ├── dashboard/index.jsx           # + <IncidentTimeline>, + "Mark arrived" (admin/dispatcher)
│   ├── responder-view/index.jsx      # + <IncidentTimeline>, + <ArrivedButton>, GPS throttle 20s->10s, declined-aware hasOpenAssignment
│   └── report-management/components/ReportDetailsModal.jsx  # + <IncidentTimeline>
└── utils/
    └── distance.js                   # NEW haversineMeters(a, b) — client-side gate preview

e2e/
└── incident-timeline.spec.js         # NEW timeline + arrived-gate scenarios
```

**Structure Decision**: Single-project layout per existing repo conventions — shared component in `components/`, hook in `hooks/`, migration in `supabase/migrations/`, e2e in `e2e/`.

## Complexity Tracking

> No constitution violations — section intentionally empty.
