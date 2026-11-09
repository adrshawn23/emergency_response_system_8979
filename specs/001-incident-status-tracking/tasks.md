# Tasks: Incident Status Tracking Timeline

**Input**: Design documents from `/specs/001-incident-status-tracking/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Constitution VII requires Playwright e2e for user-flow features â€” test tasks included.

## Phase 1: Setup

- [x] T001 Probe live Supabase schema per constitution III before writing migration SQL: confirm `emergency_reports` columns `status`, `assigned_to`, `assigned_department_id`, `reporter_id`, `resolved_at`, `attachments`; confirm `responder_locations` table + RLS policies exist; note which columns hold incident coordinates (attachments vs dedicated) for the RPC's haversine input. Record findings in `specs/001-incident-status-tracking/research.md` open-items section.

## Phase 2: Foundational (BLOCKS all user stories)

- [x] T002 Write migration `supabase/migrations/20261109020000_incident_status_history.sql`: create `public.incident_status_history` (id uuid PK, report_id uuid FKâ†’emergency_reports CASCADE, from_status text NULL, to_status text NOT NULL, actor_id uuid FKâ†’user_profiles SET NULL, meta jsonb, created_at timestamptz default now()) per data-model.md; `idx_incident_history_report (report_id, created_at)`; partial unique `uq_incident_arrived ON (report_id) WHERE to_status='arrived'`; RLS â€” SELECT for reporter-of-report + staff roles, NO direct INSERT/UPDATE/DELETE grants; AFTER UPDATE OF status trigger inserting one row per status change with `auth.uid()`; SECURITY DEFINER `mark_incident_arrived(uuid)` (assignee+in-progress+coords+haversineâ‰¤radius checks, `meta.method='gps'`) and `mark_incident_arrived_manual(uuid)` (admin/dispatcher only, `meta.method='manual'`), both idempotent on `already_arrived` and both inserting a reporter-facing `notifications` row; `app_settings` table (key text PK, value jsonb, updated_at, updated_by) seeded `arrival_radius_m=50` with authenticated-SELECT / staff-write policies; add `incident_status_history` to `supabase_realtime` publication (guarded `pg_publication_tables` check); fix `responder_locations_reporter_read` policy `er.status <> 'resolved'` â†’ `er.status NOT IN ('resolved','declined')` in both EXISTS branches.
- [ ] T003 USER ACTION: apply `supabase/migrations/20261109020000_incident_status_history.sql` in the Supabase SQL editor, then run the verification queries in `quickstart.md` Â§0 (table exists, settings row=50, 2 RPCs, publication membership).
- [x] T004 [P] Create `src/utils/distance.js` exporting `haversineMeters({latitude,longitude},{latitude,longitude})` returning meters as a finite number or `null` for invalid input.
- [x] T005 Create `src/hooks/useIncidentHistory.js`: fetch `incident_status_history` rows for `report_id` ordered `created_at.asc` with actor `full_name` join; realtime `postgres_changes` subscription filtered `report_id=eq.<id>` with unique channel name (useId/random suffix) and `removeChannel` cleanup per constitution V; expose `{rows, loaded}`.

**Checkpoint**: Foundation ready â€” migration live, hook + util available.

## Phase 3: User Story 1 â€” Resident tracks their own report (P1) ðŸŽ¯ MVP

**Goal**: Resident sees the full step timeline (Reportedâ†’Assignedâ†’Respondingâ†’Arrivedâ†’Resolved, Declined terminal) with timestamps and live updates in their report detail view.

**Independent Test**: File a report â†’ assign â†’ acknowledge â†’ resolve; resident modal shows each step complete with timestamp as it happens, no reload (quickstart Â§1).

- [x] T006 [US1] Create `src/components/IncidentTimeline.jsx` per contracts/ui.md: vertical stepper mapping history rows + `report.status`/`created_at`/`resolved_at`/`assigned_to` onto the canonical chain; step states done/current/upcoming/skipped/declined; timestamps only where data exists (no placeholders); assign-step subtext with responder name/dept; `aria-live="polite"`; Tailwind styling consistent with ServiceAreaBadge (ring pills, slate/emerald/amber palette); zero history rows â†’ legacy synthesis from report fields.
- [x] T007 [US1] Mount `<IncidentTimeline report={selectedReport}/>` in `src/pages/resident-home/index.jsx` report-detail modal after `<ServiceAreaBadge>` and before the Map block; change the live-map conditions (`useResponderLocation`/`useResponderLocations` active flags) from `status !== 'resolved'` to `!['resolved','declined'].includes(status)` so declined also ends pin sharing (FR-015).

**Checkpoint**: US1 independently demoable.

## Phase 4: User Story 2 â€” Responder confirms arrival at the scene (P2)

**Goal**: Assigned responder gets a proximity-gated Arrived action (~50 m) that records the arrival step for all viewers.

**Independent Test**: Outside radius â†’ disabled with distance reason; inside â†’ press â†’ Arrived step appears on resident timeline â‰¤5 s; GPS denied â†’ disabled with reason (quickstart Â§2).

- [x] T008 [US2] Add Arrived action to `src/pages/responder-view/index.jsx` incident modal per contracts/ui.md: visible for `status='in-progress'` reports assigned to the viewer without an existing arrived row (use `useIncidentHistory`); compute client-side distance via `haversineMeters(reportCoords(report), selfLoc)` where `selfLoc = useResponderLocation(profile.id)` (responders can read their own row â€” the watchPosition `lastPos` is a local var, not reactive state) + cached `arrival_radius_m` from `app_settings`; render per contracts/ui.md states (enabled / "You're ~{d} m away â€” move within {r} m" / GPS-unavailable / no-coords); call `supabase.rpc('mark_incident_arrived', {p_report_id})` and surface `{ok:false,error,distance_m,radius_m}` responses.
- [x] T009 [US2] In `src/pages/responder-view/index.jsx`: broaden `hasOpenAssignment` to treat `declined` as terminal (`.some(r => !['resolved','declined'].includes(r.status))` for `assignedReports`; same for the assistance-request predicate using `a.report?.status`), and tighten the `watchPosition` write throttle from `20000` ms to `10000` ms (SC-008 â‰¤15 s staleness), keeping the â‰¥20 m movement condition.

**Checkpoint**: Arrived step records GPS-verified arrivals; GPS freshness â‰¤10 s writes.

## Phase 5: User Story 3 â€” Staff see the same timeline in every detail view (P2)

**Goal**: Identical `IncidentTimeline` in dashboard, responder-view, and report-management detail surfaces + staff manual-arrival action.

**Independent Test**: Open the same incident in all three staff surfaces â†’ same steps/timestamps/current highlight (quickstart Â§1 step 4, Â§3).

- [x] T010 [US3] Mount `<IncidentTimeline report={selectedReport}/>` in `src/pages/dashboard/index.jsx` incident detail modal next to `<ServiceAreaBadge>`; add "Mark arrived" secondary button for `status='in-progress'` incidents lacking an arrived row, rendered only for `profile.role` admin/dispatcher, calling `supabase.rpc('mark_incident_arrived_manual', {p_report_id})` with success toast; verify the dashboard file tail parses after edits (constitution VI corruption pattern).
- [x] T011 [US3] Mount `<IncidentTimeline report={selectedReport}/>` in `src/pages/responder-view/index.jsx` modal details grid (same file as T008/T009 â€” sequence after them).
- [x] T012 [P] [US3] Mount `<IncidentTimeline report={report}/>` in `src/pages/report-management/components/ReportDetailsModal.jsx` details section.

**Checkpoint**: All four surfaces render identical timelines.

## Phase 6: User Story 4 â€” Transition history depth (P3)

**Goal**: Per-step timestamps + actor context everywhere, incl. legacy reports and skipped steps.

**Independent Test**: Legacy report renders without timestamps where data absent; assign step names responder; arrived shows "GPS-verified" vs "Marked by staff" (quickstart Â§4).

- [x] T013 [US4] Enrich `src/components/IncidentTimeline.jsx` subtexts per contracts/ui.md: assign step `meta.responder_name`/`dept` (fallback live `assigned_to` profile join), arrived step `meta.method` â†’ "GPS-verified"/"Marked by staff", skipped-state label when resolved without arrival, declined terminal styling + timestamp.

## Phase 7: Polish & Cross-Cutting

- [x] T014 Create `e2e/incident-timeline.spec.js`: resident files report â†’ dispatcher assigns â†’ responder acknowledges â†’ timeline steps assert on resident modal; arrived-button disabled-outside-radius assertion (geolocation-mocked), declined-report terminal rendering.
- [x] T015 Run `npm run build` (must pass), then `npm test` e2e suite; fix failures before any push (constitution VII).
- [x] T016 Walk `quickstart.md` Â§0-Â§5 against the running app on `:4190`; record deviations back into spec/plan if found.

## Dependencies & Execution Order

- Phase 1 â†’ Phase 2 (T003 is a manual gate) â†’ Phases 3-6 â†’ Phase 7.
- US1/US2/US3 all depend on Foundational; US2's T008 also needs T006's component conventions (not a hard dep â€” different files).
- US4 (T013) is additive to `IncidentTimeline.jsx` â€” run after T006.

## Parallel Opportunities

- T004 âˆ¥ T005 (different files).
- T010 âˆ¥ T012 (different files). T011 is same-file as T008/T009 â†’ sequential.
- Phases 3/4/5 could overlap once T006 exists, but single-developer flow = sequential in priority order.

## Implementation Strategy

- **MVP**: Phases 1-3 â†’ resident timeline demoable alone.
- **Increment 2**: Phase 4 â†’ arrival gate live.
- **Increment 3**: Phase 5 â†’ all-role parity.
- **Increment 4**: Phase 6-7 â†’ depth + gates before push.


