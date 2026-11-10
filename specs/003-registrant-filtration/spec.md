# Feature Specification: New Registrant Filtration

**Feature Branch**: `[003-registrant-filtration]`

**Created**: 2026-11-10

**Status**: Implemented

**Input**: User description: "New Registrant Filtration – Add a filtering system for new registrants with the following statuses: For Approval, Returned, and Approved. On the Residents & review admin side there are 4 views: new registrants sit in For Approval; approved ones move to Approved; registrations needing clarification move to Returned; when that user re-uploads the ID or whatever was needed for the clarification it goes back to For Approval. The endpoints of registration are just reject and approved — rejected goes to Rejected. Make it a modal, not just a table."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin triages the For Approval queue (Priority: P1)

An administrator opens the Residents & review area and sees registrations grouped by review state — **For Approval**, **Returned**, **Approved**, **Rejected** — so the queue is instantly scannable instead of one undifferentiated list. Opening any registrant in For Approval launches a **review modal** (not an inline table row) showing the registrant's details and ID evidence, with the available decisions: approve, reject, or return for clarification. Every decision immediately re-files the registrant under the correct status view.

**Why this priority**: The status filtration + modal review IS the core ask — without it admins must mentally sort a flat list, which is exactly what the user wants gone. The three non-terminal views depend on it too.

**Independent Test**: Fully testable by seeding registrants in each state, opening each tab, and confirming every registrant appears under exactly the right status and every decision re-files them correctly — delivering the complete triage experience by itself.

**Acceptance Scenarios**:

1. **Given** an admin on Residents & review, **When** they open the registrations view, **Then** registrants are grouped under clearly labeled For Approval / Returned / Approved / Rejected states, each with a count.
2. **Given** a new registrant who just signed up, **When** an admin views the queue, **Then** that registrant appears under For Approval — never anywhere else.
3. **Given** a registrant in For Approval, **When** the admin opens them, **Then** a modal presents their details and ID evidence with approve / reject / return-for-clarification actions — not an editable table row.
4. **Given** an admin approves or rejects, **When** the modal closes, **Then** the registrant immediately shows under Approved or Rejected respectively and no longer under For Approval.

---

### User Story 2 - Returned registrations cycle back after resubmission (Priority: P2)

An admin reviewing a registrant whose ID evidence is unreadable or mismatched returns it for clarification. The registrant moves to **Returned**. When that user re-uploads their ID (or whatever the admin asked for), the registration automatically moves back to **For Approval** — the admin sees it re-queued for a fresh decision without tracking it manually.

**Why this priority**: The clarify-then-resubmit loop is the feature's most distinctive flow — it prevents returned registrants from being forgotten in a dead-end state.

**Independent Test**: Fully testable by returning a registration, having the registrant re-upload evidence, and confirming the registration moves back to For Approval automatically.

**Acceptance Scenarios**:

1. **Given** a registrant in For Approval with unclear ID evidence, **When** the admin returns it for clarification, **Then** the registrant moves to Returned — and the registrant sees a status banner naming what to re-upload **and** receives a notification containing the admin's clarification note.
2. **Given** a registrant in Returned, **When** the user re-submits evidence, **Then** the registration moves back to For Approval automatically — visually distinguished with a **Resubmitted** badge, and the prior clarification note is visible to the reviewer.
3. **Given** a registrant in Returned, **When** an admin views the Returned view, **Then** they can still open the modal to see what was asked for and the registrant's latest submission state.

---

### User Story 3 - Approved and Rejected act as terminal audit views (Priority: P3)

Approved and Rejected are the only terminal states. The admin can browse each view to audit outcomes — who was approved, who was rejected, when, and on what evidence — with counts matching reality.

**Why this priority**: Audit visibility completes the lifecycle, but the queue could technically function without dedicated terminal tabs (decisions are still recorded) — hence P3.

**Independent Test**: Fully testable by approving one registrant and rejecting another, then confirming each appears under the correct terminal view with their details.

**Acceptance Scenarios**:

1. **Given** a registrant just approved, **When** the admin opens the Approved view, **Then** that registrant is listed there — and can never move back to For Approval or Returned.
2. **Given** a registrant just rejected, **When** the admin opens the Rejected view, **Then** that registrant is listed there with the decision context — kept indefinitely for audit, presented as an archived list separate from the active queue.

---

### Edge Cases

- **Registrant with no ID verification row yet** (signed up but never uploaded): the registration still belongs to For Approval — a missing evidence row must not orphan the registrant out of the queue.
- **Re-upload while review modal is open**: if a returned registrant resubmits while an admin has them open, the modal reflects current state on close/reopen — no stale approve-of-old-evidence actions.
- **Concurrent reviews**: two admins acting on the same registrant — second decision must not silently overwrite the first (the registrant is already re-filed; the later action should no-op or be surfaced as already-decided).
- **Empty views**: each status view handles zero registrants cleanly (clear empty state, not a broken list).
- **Rejected account signs in**: a rejected registrant attempting to sign in sees an appropriate denied/pending outcome — not a working account.
- **Counts always consistent**: the badge/counts per status always sum to the total registrant count — a registrant exists in exactly one view at all times.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Residents & review surface MUST present registrants grouped into exactly four labeled status views: **For Approval**, **Returned**, **Approved**, and **Rejected**, each showing a count.
- **FR-002**: Every newly signed-up registrant MUST be filed under **For Approval** automatically.
- **FR-003**: Opening a registrant from any status view MUST present a **modal** containing the registrant's details and ID evidence — decisions must happen inside the modal, not inline in a table.
- **FR-004**: From the modal, the reviewer MUST be able to **approve**, **reject**, or **return for clarification** a registrant currently in For Approval (and a registrant in Returned whose resubmission has moved them back to For Approval).
- **FR-005**: Approving MUST move the registrant to **Approved**; rejecting MUST move them to **Rejected**; returning MUST move them to **Returned** — immediately and in exactly one view at a time.
- **FR-006**: When a registrant in **Returned** re-submits evidence, the registration MUST automatically move back to **For Approval** — no manual re-queueing.
- **FR-007**: **Approved** and **Rejected** MUST be terminal — no registrant may move out of either state once decided (per the user's "the end point is just reject and approved").
- **FR-008**: The Returned view MUST retain the context of what was requested (the clarification note / last decision) so the reviewer knows what they asked for.
- **FR-009**: Status counts MUST update live — a decision made elsewhere (auto-approval, another admin) must re-file the registrant without a page reload, consistent with the app's realtime behavior.
- **FR-010**: The filtration MUST apply to registrations across roles — staff registrations (responder/dispatcher/department_admin) follow the same status views as residents; no second queue.
- **FR-011**: While in Returned, the registrant MUST see a status banner naming what to re-upload, and MUST receive a notification carrying the admin's clarification note.
- **FR-012**: A resubmission landing back in For Approval MUST be visually distinguished (Resubmitted badge) and the reviewer MUST be able to see the prior clarification note alongside the new evidence.
- **FR-013**: Rejected registrants MUST be retained indefinitely as an archived audit list, presented separately from the active queue.

### Key Entities *(include if feature involves data)*

- **Registrant**: a signed-up user awaiting or having received a review decision; carries their profile details and current review state.
- **Review state**: the registrant's position in the filtration — For Approval / Returned / Approved / Rejected — derived from their verification record (pending, needs_clarity, approved, rejected) rather than a separate status field, so state stays the single source of truth.
- **ID evidence**: the identity document(s) a registrant uploads for review — versioned, so a Returned registrant's re-upload replaces/is latest without losing the prior submission for audit.
- **Review decision**: an admin action — approve, reject, or return-for-clarification — carrying reviewer identity, timestamp, and (for returns) the clarification note shown back to the registrant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of registrants appear under exactly one of the four status views at all times — none missing, none double-listed.
- **SC-002**: An admin can identify and open the registrants awaiting a decision (For Approval) within 3 seconds of landing on the page.
- **SC-003**: A decision (approve / reject / return) re-files the registrant to the correct view in under 3 seconds, no reload.
- **SC-004**: 100% of resubmitted evidence lands the registrant back in For Approval automatically within 5 seconds.
- **SC-005**: Zero registrants in Approved or Rejected can ever re-appear in For Approval or Returned.
- **SC-006**: In verification, a new admin can explain what each status view means after one look — no training required (labels + counts communicate the queue).

## Assumptions

- The four statuses map onto the existing verification lifecycle — new/pending = For Approval, needs_clarity = Returned, approved = Approved, rejected = Rejected — no new terminal states are introduced.
- "Make it a modal" refers to the review surface (open registrant → modal with decisions), matching the existing review-modal pattern; the status views themselves remain tabbed/filtered lists.
- Auto-approval via OCR-verification still applies: a registrant auto-approved at upload never enters For Approval — they land directly in Approved.
- Rejected accounts remain blocked at sign-in (existing suspended/denied behavior); no new deletion of rejected accounts.
- Admins are the only users who see the filtration surface — residents/responders see only their own registration status.
- The clarification request shown to a returned registrant uses the existing review-notes mechanism; a dedicated "tell me exactly what to re-upload" message format is the same mechanism, not a new channel.
