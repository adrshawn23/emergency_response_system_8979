# Contract: UI Components

**Date**: 2026-11-09 | **Feature**: `001-incident-status-tracking`

## `<IncidentTimeline report={report} />`

Shared step timeline used by **all four** detail surfaces (FR-006). Vertical, Shopee-parcel-style: icon-node + connector per step, right side label/timestamp/subtext.

**Props**: `report` — a row shape containing `id`, `status`, `created_at`, `resolved_at`, `assigned_to`, `attachments` (used for legacy synthesis + assign-step context).

**Step map** (canonical order):

| Step | Label | Done when | Subtext source |
|------|-------|-----------|----------------|
| 1 | Reported | always | `report.created_at` |
| 2 | Assigned | history row `to_status='assigned'` or status ≥ assigned | `meta.responder_name`/`dept` or live `assigned_to` join |
| 3 | Responding | `to_status='in-progress'` or status ≥ in-progress | timestamp |
| 4 | Arrived | `to_status='arrived'` row exists | `meta.method` → "GPS-verified" or "Marked by staff" |
| 5 | Resolved | `to_status='resolved'` or `status='resolved'` | `resolved_at`/row time |
| ✕ | Declined | `status='declined'` | row time — renders as terminal branch, replaces steps 4-5 visually |

**Step states**: `done` (filled node + timestamp), `current` (pulsing/highlighted), `upcoming` (grey), `skipped` (collapsed label "skipped", only Arrived can be skipped — shown when resolved without arrival), `declined` (red terminal).

**Data**: `useIncidentHistory(report.id)` → ordered rows + realtime upserts. **Legacy fallback**: zero rows → synthesize done states from `report.status`/`created_at`/`resolved_at` with timestamps only where data exists (FR-003).

**Where mounted**:
- `resident-home` modal — after `ServiceAreaBadge`, before Map block
- `dashboard` incident detail modal — beside existing details grid
- `responder-view` modal — details grid
- `report-management` `ReportDetailsModal` — details section

**A11y**: pure presentation (no interactive elements); all copy ≥12px slate-600+ (WCAG AA); updates announce via `aria-live="polite"` on the step list.

## `<ArrivedButton report={report} />` (responder-view only)

Full-width action in the responder incident modal + optional card-level for the active assignment. States:

| State | Rendering |
|-------|-----------|
| Enabled (in radius) | Solid primary "I've arrived" |
| Disabled — too far | Muted + "You're ~{d} m away — move within {r} m" |
| Disabled — GPS off/denied | Muted + "Location unavailable — enable GPS" |
| Disabled — no incident coords | Muted + "Incident has no coordinates" |
| Already arrived / resolved | Not rendered (step shows on timeline) |

Calls `mark_incident_arrived`; on `too_far` shows the server-returned `{distance_m, radius_m}`; on `already_arrived` treats as success and hides.

## "Mark arrived" staff action (dashboard)

Small secondary button in the dashboard incident modal for `status='in-progress'` reports lacking an arrived row, visible only to `admin`/`dispatcher`. Confirm-free but toasts success; calls `mark_incident_arrived_manual`. Omitted from responder-view (FR-017: no self-override).
