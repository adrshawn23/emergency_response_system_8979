# Feature Specification: Incident Status Tracking Timeline

**Feature Branch**: `[001-incident-status-tracking]`

**Created**: 2026-11-09

**Status**: Implemented

**Input**: User description: "Incident Status Updates – Add step-by-step incident status updates, such as Assigned and In Progress, similar to the parcel tracking feature of Shopee. Add the full tracking statuses so they can see where the incident now is depending on status. In the responder side it should have an Arrived button so the resident who reported knows that they have arrived — the Arrived button should only be usable when the responder is close to the incident pin, like within 5 meters or a similar close boundary."

## Clarifications

### Session 2026-11-09

- Q: Should residents see only the step timeline or also the responder's live position on a map, Shopee-style? → A: Both — timeline plus a live responder pin shown to the reporting resident while the response is active.
- Q: What proximity radius should unlock the Arrived button? → A: ~50 m configurable default — tight enough to prove at-scene, forgiving of typical phone GPS error; admin-adjustable.
- Q: When GPS prevents a responder pressing Arrived, who can record arrival manually? → A: Dispatcher/admin only, from the incident detail — an audited manual mark; responders cannot self-override the proximity gate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resident tracks their own report (Priority: P1)

A resident who filed an incident opens its details and sees a vertical, parcel-tracking-style timeline of the incident's journey: **Reported → Assigned → Responding → Arrived → Resolved** — plus, Shopee-courier-style, a map showing the assigned responder's live position moving toward the incident while the response is active. Completed steps show a timestamp and a short descriptor (e.g., who/what department it was assigned to); the current step is highlighted; future steps appear greyed-out and clearly labeled so the resident understands what still has to happen. Both the timeline and the live pin update without a page refresh.

**Why this priority**: This is the core ask — residents currently see only a bare status word with no sense of progression or history. Knowing "someone is on the way" vs "still waiting for dispatch" is the primary user value.

**Independent Test**: Can be fully tested by filing a report as a resident, opening it in "My reports", then having a dispatcher assign it and a responder acknowledge/resolve it — the resident's timeline advances through each step with timestamps, and while the response is active the responder's pin is visible on the resident's map — delivering full tracking value by itself.

**Acceptance Scenarios**:

1. **Given** a resident with a report in `pending`, **When** they open the report details, **Then** the timeline shows "Reported" as the only completed step (with filing timestamp) and all later steps greyed out.
2. **Given** a report was just assigned to a responder, **When** the resident views the report details, **Then** the timeline shows "Assigned" completed with the assignment time and responder/department name, "Responding" marked as current, and the update appears without manual refresh.
3. **Given** an incident that reached `in-progress`, **When** the responder marks it resolved, **Then** the resident's timeline shows all four steps completed with their respective timestamps.
4. **Given** a report that was `declined`, **When** any viewer opens its details, **Then** the timeline shows a distinct terminal "Declined" step (visually different from resolved — not green/success) instead of the normal progression.

---

### User Story 2 - Responder confirms arrival at the scene (Priority: P2)

A responder who has acknowledged an incident and is physically on-scene presses an "Arrived" action in their incident view. The action is only usable when the responder's live position is within a small proximity radius of the incident's pinned location (default ~50 meters, administrator-configurable since device GPS accuracy varies). When pressed, the arrival becomes a step on the tracking timeline so the reporting resident sees that help is physically on site — the strongest reassurance moment in the whole flow.

**Why this priority**: Arrival is the highest-anxiety moment for a resident ("are they actually here yet?"). It also depends on proximity gating, which is the most technically distinctive part of this feature — but it sits below P1 because the basic progression timeline already answers "where is it now".

**Independent Test**: Can be fully tested by assigning a responder, having them acknowledge, then physically/simulated-locating them first outside and then inside the proximity radius and confirming the Arrived action is unusable outside the radius and recording an arrival inside it — delivering a new timeline step visible to residents.

**Acceptance Scenarios**:

1. **Given** an incident in `in-progress` assigned to me and my device location is outside the proximity radius of the incident pin, **When** I open the incident, **Then** the Arrived action is visibly present but cannot be activated, with an explanation that I must be at the scene.
2. **Given** the same incident and my location is now within the radius, **When** I press Arrived, **Then** the timeline records an "Arrived" step with the current time and the reporting resident's timeline shows it without a reload.
3. **Given** my device cannot provide a location (permission denied or GPS unavailable), **When** I open the incident, **Then** the Arrived action is disabled with a clear reason — it does not silently fail or record a false arrival.

---

### User Story 3 - Staff see the same timeline in every incident detail view (Priority: P2)

Dispatchers, admins, and responders see the identical step-by-step timeline wherever an incident's details are opened — the dashboard incident-detail modal, the responder's incident modal, the report-management detail view, and the resident's report view — so every role shares the same "where is this incident now" picture.

**Why this priority**: Consistent tracking across roles prevents "the dispatcher says X, the responder sees Y" confusion and is required by the user's "all roles that shows that modal" pattern from prior work.

**Independent Test**: Can be fully tested by opening the same incident's details in the dispatcher dashboard, responder view, and report-management page and confirming each renders the same steps, timestamps, and current-state highlight.

**Acceptance Scenarios**:

1. **Given** an incident in any status, **When** a dispatcher/admin opens its detail modal, **Then** the tracking timeline appears with the same steps and timestamps the resident sees.
2. **Given** an incident assigned to a responder, **When** that responder opens the incident in their view, **Then** the timeline appears with the same steps, timestamps, and current-state highlight.
3. **Given** an incident opened in report-management details, **When** its status is changed elsewhere, **Then** the timeline reflects the new status without requiring the page to be reloaded.

---

### User Story 4 - Transition history with timestamps and actors (Priority: P3)

Each completed timeline step records when the transition happened and, where applicable, who triggered it (e.g., "Assigned to Maria Santos · Fire Dept" or "Acknowledged — en route"), giving a durable audit-style history of the incident's lifecycle rather than only the latest status.

**Why this priority**: Shopee-style tracking implies per-step times; this adds the history layer. Lower priority only because the visual progression (P1/P2) already delivers most of the perceived value.

**Independent Test**: Can be tested by running a report through its lifecycle and verifying each step displays its own timestamp (and actor/context where available) that matches when the transition actually occurred.

**Acceptance Scenarios**:

1. **Given** an incident progressed through multiple statuses, **When** a viewer expands its timeline, **Then** each completed step shows the date/time it was reached, matching the actual transition times.
2. **Given** an incident whose assign step has actor data, **When** the timeline renders, **Then** the assign step names the responder and/or department.
3. **Given** a legacy incident whose historical transitions were never recorded, **When** the timeline renders, **Then** reached steps still appear completed — timestamped where data exists and shown without a time where it doesn't (never a broken/empty step).

---

### Edge Cases

- **Declined incidents**: render a terminal "Declined" step that branches off the normal path, visually distinct (e.g., red/neutral), with its timestamp if known — the canonical chain is not shown as "completed through resolved".
- **Skipped or out-of-order transitions** (e.g., resolved directly from `assigned`, resolved without pressing Arrived, or pending → resolved): steps the incident never reached are marked skipped/collapsed rather than shown as completed with fabricated times; the final reached state is still unambiguous. Arrival in particular is best-effort — resolution must not be blocked because Arrived was never pressed.
- **Proximity edge cases**: device GPS off, permission denied, accuracy radius larger than the arrival threshold, or the incident itself lacking coordinates — the Arrived action stays visibly disabled with a plain-language reason rather than disappearing or erroring.
- **Manual arrival marking**: when staff mark arrival manually (responder GPS unavailable), the timeline shows the Arrived step normally; the record retains who marked it and that it was manual — the proximity gate is never bypassed by responders themselves.
- **Responder position unavailable on the resident map**: if the responder's device stops reporting (GPS off, app closed, no signal), the resident map keeps the incident pin and shows a stale/offline cue rather than freezing a misleading dot — and position sharing ends permanently once the incident reaches a terminal state (resolved or declined).
- **Legacy reports** with no recorded transition history: reconstruct what can be known from existing fields (filing time, resolution time, current status) and render the rest without timestamps — never blank.
- **No status transitions yet** (just filed): timeline shows only "Reported" done; remaining canonical steps greyed.
- **Realtime lag/failure**: if live updates are unavailable, the timeline still renders from the last fetched state and corrects on the next successful load — no stuck spinner.
- **Reassignment**: if an incident is assigned to a different responder, the assign step reflects the latest assignment (no duplicated assign steps unless the system records each transition — in which case the latest is authoritative for display). Only the currently assigned responder sees an enabled Arrived action.
- **Double-tap / repeat arrival**: pressing Arrived twice, or after already resolving, records no duplicate step — the timeline shows one arrival.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST present every incident's lifecycle as an ordered, step-based tracking view covering the canonical stages: Reported (filed), Assigned, Responding (in-progress), Arrived (on-scene), Resolved — plus a distinct terminal Declined branch. Arrived is optional in the chain: an incident resolved without it still completes correctly.
- **FR-002**: The tracking view MUST visually distinguish three step states — completed (reached), current (in effect now), and upcoming (not yet reached) — in the style of e-commerce parcel tracking.
- **FR-003**: Each completed step MUST display its transition timestamp when that data exists, and MUST render without a timestamp when it doesn't (no fabricated or placeholder times).
- **FR-004**: Where transition metadata is available, the relevant step MUST show contextual detail such as the assigned responder's name and/or department; viewers MUST NOT be shown internal identifiers (raw UUIDs).
- **FR-005**: The system MUST record every incident status transition (from-status, to-status, timestamp, and actor where identifiable) — including the arrival event — so the timeline can be reconstructed for any incident, including for viewers who open it long after transitions occurred.
- **FR-006**: The tracking view MUST appear in every surface where incident details are shown: the resident's own report view, the dispatcher/admin incident detail, the responder's incident detail, and the report-management detail view — with identical content in each.
- **FR-007**: The tracking view MUST reflect status changes without requiring a page reload while it is open.
- **FR-008**: Steps that the incident skipped (e.g., resolved without an acknowledge step) MUST be handled explicitly — marked as skipped or collapsed — rather than rendered as falsely completed.
- **FR-009**: For declined incidents, the view MUST present "Declined" as the terminal state and MUST NOT imply the incident was resolved or still in progress.
- **FR-010**: The tracking view MUST be readable and touch-friendly on mobile, consistent with the app's existing modal accessibility conventions (44px targets, sufficient contrast, Escape-to-close unaffected).
- **FR-011**: The responder's incident view MUST present an "Arrived" action for incidents assigned to that responder while the incident is in-progress (i.e., acknowledged but not yet arrived/resolved).
- **FR-012**: The Arrived action MUST be activatable only when the responder's live device position is within a configurable proximity radius of the incident's coordinates (default ~50 meters, administrator-adjustable for real-world GPS accuracy). Outside the radius, the action MUST remain visible but clearly disabled with a reason — never hidden, never silently ignored.
- **FR-013**: If the responder's location is unavailable or untrusted (permission denied, GPS off, accuracy worse than the radius, or the incident lacks coordinates), the Arrived action MUST be disabled with a plain-language explanation of what to do next.
- **FR-014**: Recording an arrival MUST produce a timeline step (timestamp + responder identity) that appears on every role's tracking view and feeds the existing status-change notification path.
- **FR-015**: The reporting resident's incident view MUST show the assigned responder's live position on a map, updating without reload, while the incident is in an active response state (assigned or in-progress, including after arrival until resolved). The pin MUST stop updating and be removed when the incident reaches a terminal state or assignment is cleared.
- **FR-016**: The live responder pin MUST be shown only to users already authorized to view the incident — the reporting resident and staff who can see the incident — never publicly or to unrelated residents.
- **FR-017**: When a responder cannot press Arrived (GPS unavailable/broken), a dispatcher or administrator MUST be able to mark the incident arrived manually from the incident detail. A manually marked arrival MUST be stored with the acting staff member's identity and recorded as manual; it renders as a normal Arrived step on timelines. Responders MUST NOT be given any self-override of the proximity gate.

### Key Entities *(include if feature involves data)*

- **Incident Status Transition**: one record per status change on an incident — incident reference, previous status, new status, timestamp, and the actor (user) who caused it when identifiable, plus optional context (e.g., assignment target). Append-only; the source of truth for timeline history. The arrival event is recorded as a transition-type entry even though it is not a top-level incident status.
- **Incident**: the tracked object; its current status determines which timeline step is "current". Canonical statuses: `pending`, `assigned`, `in-progress`, `resolved`, `declined`.
- **Tracking Step**: presentation-level mapping from a canonical status to a user-facing label, description, and visual state (done/current/upcoming/skipped/declined).
- **Responder Live Position**: the responder's periodically reported device location already shared during active responses; used to gate the Arrived action by distance to the incident coordinates AND surfaced as a live pin on the reporting resident's map during active response (access-scoped per FR-016).
- **Arrival Proximity Setting**: administrator-configurable distance threshold (default ~50 m, per Clarifications Session 2026-11-09) that defines "at the scene" for the Arrived action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of incidents display the tracking view in every role's detail surface — no surface shows incident details without it.
- **SC-002**: A status change made by a dispatcher or responder is visible on any open tracking view within 5 seconds, without page reload.
- **SC-003**: In usability verification, a resident can answer "what is happening with my incident right now, and what's the next step?" within 10 seconds of opening the details, for incidents in every status including declined.
- **SC-004**: Every completed step on a non-legacy incident shows a timestamp accurate to the minute of the actual transition; zero steps display fabricated times.
- **SC-005**: Incident detail modals continue to pass existing accessibility checks (Escape closes, no interactive element under 44px, WCAG AA contrast) with the timeline added.
- **SC-006**: In verification, 0% of arrival attempts outside the proximity radius succeed, and 100% of legitimate on-scene attempts (location within radius and accuracy sufficient) succeed on the first try.
- **SC-007**: A resident viewing an open incident sees the Arrived step appear within 5 seconds of the responder pressing it on scene.
- **SC-008**: While a response is active, the resident's map shows responder positions no older than 15 seconds at the time each update is displayed.

## Assumptions

- The existing in-app notification on status change (already triggered in the system) remains unchanged; this feature adds the *visual tracking surface*, not new notification channels (no SMS/email fan-out unless separately requested).
- "Full tracking statuses" means the canonical lifecycle above; internal sub-events (e.g., assistance requests, chat messages) are out of scope for the step chain.
- Actor/context detail is shown where captured (assignment records it); steps without actor data still display cleanly.
- All four detail surfaces reuse one shared tracking presentation so behavior and copy stay identical across roles.
- Declined is a terminal, non-success state distinct from Resolved; an incident cannot be both.
- Legacy incidents (created before transition recording) render from current status + known timestamps without backfilling invented history.
- No permission changes: anyone who can already view an incident's details can view its timeline (reporter sees own; staff see assigned/all per existing rules).
- The user's original ~5 m figure meant "very close"; after weighing typical phone GPS error (±5–20 m), the chosen default is ~50 m — still proves at-scene while avoiding false lockouts. It stays a configurable setting rather than a hardcoded constant (Clarifications, Session 2026-11-09).
- Arrived is an optional step, not a gate on resolution — a responder can resolve without it (legacy behavior preserved), and the timeline then shows Arrived as skipped.
- Responder live location is already shared during active incidents for staff map display; this feature reuses that stream — no new device permissions are introduced — but extends visibility of that stream to the reporting resident for the duration of the active response (scope decision confirmed in Clarifications, Session 2026-11-09).
- Manual arrival marking is dispatcher/admin-only (Clarifications, Session 2026-11-09) — expected to be rare; the normal path is the proximity-gated responder button.
- The Arrived action lives inside the responder's incident-detail modal in v1 (a card-level shortcut is a possible later increment — intentionally out of scope).
