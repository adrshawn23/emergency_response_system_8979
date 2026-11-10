# Feature Specification: Emergency Communications & Public Incident Hub

**Feature Branch**: `004-emergency-communications`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Store emergency hotlines and department contact information — admin-controlled and dynamic. View previous incidents reported by a particular resident. Response time monitoring — calculate how long each department takes to respond and arrive. Emergency announcement — let authorized administrators broadcast emergency advisories to residents; announcements should also be emailed with all information, especially the map. All residents can view the incident — add an announcements page where they can view the progress of the incident. Emails go out at the time an incident is reported and when it is resolved, and should have photos. (Map-pinning of incident location explicitly deferred.)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin-managed emergency contact directory (Priority: P1)

An administrator maintains a live directory of emergency hotlines and per-department contact information (department name, phone/radio number, optional email, optional notes). Directory changes take effect immediately for every user without a deploy. Residents and staff see the current directory on a dedicated contacts view and alongside the report form.

**Why this priority**: Numbers change as offices rotate — hard-coding them means the directory rots. It is also the smallest independent slice that delivers immediate value.

**Independent Test**: Admin creates/edits/reorders/deactivates an entry; an unauthenticated or resident view reflects the change on refresh. Delivers value alone even if no other story ships.

**Acceptance Scenarios**:

1. **Given** the admin is on the contacts management view, **When** they save a new "Police — Desk Line" entry, **Then** it appears for all users without redeploying.
2. **Given** an existing entry, **When** the admin edits the number, **Then** every subsequent view shows the updated number.
3. **Given** an entry marked inactive, **When** a resident opens the directory, **Then** the entry is hidden (not deleted — history preserved).

---

### User Story 2 - Broadcast announcements + public announcement page (Priority: P1)

An authorized administrator composes an emergency advisory (title, body, severity, optional linked incident) and broadcasts it. Every resident sees it on a new **Announcements** page that lists advisories and currently open incidents with their live progress (status timeline + per-department unit steps), including a map of each incident. The page updates in near-real-time as incidents progress.

**Why this priority**: This is the public-facing heart of the feature — it answers "what is happening and is it handled" for every resident at once.

**Independent Test**: Post an advisory → it renders on the announcements page for a resident session; progress through an incident's statuses → the page reflects each step without refresh. Works even without the email story.

**Acceptance Scenarios**:

1. **Given** an admin composes "Flooding on M.J. Cuenco Ave — avoid area", **When** they publish, **Then** all residents can open Announcements and see it immediately.
2. **Given** an open incident with assisting departments, **When** a unit marks Arrived, **Then** the announcements page shows that unit's Arrived step within seconds.
3. **Given** a resident without a session on the announcements page, **When** they view an incident entry, **Then** they see status, location map, and progress — but never reporter personal data beyond what is already public.

---

### User Story 3 - Incident lifecycle emails to residents (Priority: P2)

Residents are emailed at two lifecycle moments for every incident in the service area: (a) when the incident is **reported** — with full incident info including a map image of the location, incident type, location text, time, and any attached evidence photos; (b) when the incident is **resolved** — with the outcome, timeline summary, the main resolution photo, and **every assisting department's resolution proof photo** labeled by department. Broadcast advisories (US2) are also sent by email with the same "all information, especially the map" treatment when linked to an incident.

**Why this priority**: Email reaches residents who are not on the site; it extends, not enables, the announcement page.

**Independent Test**: Trigger a test incident → reported-email arrives in a mailbox containing a map and photos; resolve it → resolved-email arrives with resolution photos. Advisory email arrives for a published announcement.

**Acceptance Scenarios**:

1. **Given** a new incident with GPS + a photo, **When** it is stored, **Then** every resident's inbox receives an email containing the map image, incident details, and the photo.
2. **Given** the incident reaches resolved with one assisting department that attached its own resolution proof, **When** the resolution is saved, **Then** every resident receives a resolved email containing the main resolution photo AND the assisting department's proof photo labeled by department.
3. **Given** an advisory without a linked incident, **When** it is published, **Then** residents receive the advisory text by email (no map required).

---

### User Story 4 - Per-department response-time monitoring (Priority: P2)

Authorized staff (admin/dispatcher) open a metrics view showing how long each department takes to **respond** (assignment → responder acknowledges) and to **arrive** (acknowledge → on-scene arrival), aggregated per department over a selectable period, plus the per-incident breakdown for the main unit and each assisting unit.

**Why this priority**: Turns the timestamps already recorded by dispatch and unit-progress tracking into accountability data; read-only on top of US-independent data.

**Independent Test**: Seed incidents with known timestamps → metrics view shows correct averages and per-incident durations per department. Requires no other story to be useful.

**Acceptance Scenarios**:

1. **Given** three Fire-department arrivals in the last 30 days, **When** a dispatcher opens metrics filtered to Fire, **Then** average respond time and average arrive time for Fire are shown.
2. **Given** an incident with two assisting departments, **When** the dispatcher opens its detail, **Then** each unit's respond/arrive durations are listed separately.
3. **Given** a unit that never arrived, **When** metrics are computed, **Then** it is excluded from arrive averages but counted as "no arrival recorded".

---

### User Story 5 - Resident incident history lookup for staff (Priority: P3)

A dispatcher/administrator searches a resident (by name, email, or address) and sees all incidents that resident previously reported — newest first, with type, date, status, and location — to inform triage of a new report.

**Why this priority**: Valuable for triage (repeat alarms, frequent reporters) but secondary to public communication.

**Independent Test**: Search a resident with past reports → their history lists correctly; a resident with none shows an empty state. Access control prevents residents from looking up each other.

**Acceptance Scenarios**:

1. **Given** a dispatcher viewing a new report, **When** they search the reporter's identity, **Then** all previous reports by that resident appear ordered newest-first.
2. **Given** a resident attempts the same lookup, **When** they query, **Then** only their own reports are visible (no other resident's).

---

### Edge Cases

- Contact entry saved with an empty number — rejected with a validation message.
- No active boundary configured — emails still send; map image falls back to a static pin or "location text only" if coordinates are absent.
- Resident has no verified email — skipped silently for email sends, logged.
- Incident resolved with no resolution photo — resolved email still sends, photo section omitted rather than failing.
- Email provider unavailable — send is retried/queued; the announcement itself must still publish.
- Metrics view with zero incidents in range — shows an empty-state, not errors.
- A resident's past incident was withdrawn/invalid — still listed with its final status, not hidden.

## Requirements *(mandatory)*

### Functional Requirements

**Contacts directory**
- **FR-001**: Administrators MUST be able to create, edit, deactivate/reactivate, and reorder contact entries without code changes.
- **FR-002**: The directory MUST be visible to all signed-in users and MUST group or tag entries by department.
- **FR-003**: Deactivated entries MUST be hidden from non-admin viewers but retained.

**Announcements**
- **FR-004**: Administrators MUST be able to publish advisories with title, body, severity, and an optional incident link.
- **FR-005**: A public announcements page MUST list published advisories and open incidents with live progress (main status + per-department unit steps) and a map per incident.
- **FR-006**: The announcements page MUST update without a manual refresh when incident progress changes.

**Lifecycle emails**
- **FR-007**: On incident report, an email MUST be sent to every resident containing incident type, location text, a map image of the location, timestamp, and attached evidence photos.
- **FR-008**: On incident resolution, an email MUST be sent to every resident containing the outcomeaand nd tsolution photo(s(s)) when pre
- **FR-009**: Publishing an advisory MUST also deliver it by email to all residents.
- **FR-010**: Email delivery failures MUST NOT roll back the underlying incident or announcement transaction.

**Response-time metrics**
- **FR-011**: The metrics view MUST compute, per department, average assignment→respond and respond→arrive durations over a selectable date range.
- **FR-012**: The metrics view MUST show a per-incident breakdown covering the main unit and each assisting unit, including units with missing steps.

**Resident history lookup**
- **FR-013**: Staff MUST be able to search a resident and list all their prior incidents newest-first.
- **FR-014**: Non-staff users MUST NOT be able to view another resident's incident history.

### Key Entities

- **ContactEntry**: label, department link, channel type (phone/radio/email), value, sort order, active flag.
- **Announcement**: title, body, severity, optional linked incident, author, published timestamp.
- **Incident**: existing — feeds announcements, emails, metrics, and history (status timeline, per-unit progress timestamps, location, photos).
- **Resident**: recipient identity for directory, emails, and history lookup.
- **EmailDelivery** (optional): per-send record for retry/audit of lifecycle and advisory emails.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can add or change a hotline entry and have it visible to users in under 60 seconds with zero deploys.
- **SC-002**: A published advisory is visible on the announcements page to all residents within 10 seconds.
- **SC-003**: Incident progress changes reflect on the announcements page within 10 seconds of being recorded.
- **SC-004**: Reported-incident emails arrive for 95%+ of resident mailboxes within 2 minutes of the incident being saved; resolved emails likewise within 2 minutes of resolution.
- **SC-005**: 100% of lifecycle emails for incidents with coordinates include a map image; 100% of resolved emails include all available resolution photos (main + each assisting department's proof).
- **SC-006**: A dispatcher can answer "how fast does department X respond/arrive on average this month" from the metrics view in under 30 seconds.
- **SC-007**: A dispatcher can retrieve a given resident's full prior-incident list in under 30 seconds.

## Assumptions

- An existing email-sending capability (already used for registration/security emails) is reused; residents' email addresses are the sign-in addresses.
- "All residents" for email + page visibility means verified resident accounts; advisories reach staff too.
- Incident visibility on the public page excludes reporter PII beyond what current tracking already exposes; photos shown are evidence/resolution photos only.
- Map rendering for emails uses the existing boundary/map infrastructure; if coordinates are missing, emails still send without a map section.
- Map-pinning for the reporter (choosing location by tapping a map) is **explicitly deferred** and out of scope here.
- Response-time source data is the existing status history and per-unit progress timestamps; no new clock sources are introduced.
- Access: contacts/announcements management and metrics = admin (+ dispatcher for metrics/history); directory, announcements page, and emails = everyone.
