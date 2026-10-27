# Full Walkthrough — From Signup to Resolved Incident

A step-by-step story of the whole system, following an incident and the people who handle it. Plain English throughout.

---

## Before the story starts: what the system covers

The system serves **Barangay Kalubihan**. An admin has drawn the service area on a map in settings, and that boundary is used to flag every incoming report as inside or outside the covered area. The boundary never blocks anyone from using the app — it only labels reports.

---

## Part 1 — A resident registers

Maria wants to be able to report emergencies. She opens the app and clicks **Register**.

The registration form walks her through **five steps**:

1. **Personal Information** — first name, last name, email, an 11-digit phone number starting with 0, date of birth, and her address. The address **must mention Kalubihan** (e.g. "Brgy Kalubihan") — the system can't geocode addresses, so it checks the text, and an out-of-area address is rejected right here.
2. **Account Security** — a password and a confirmation.
3. **Role Selection** — she picks **Resident**.
4. **Identity Verification** — she uploads a photo of her ID. This is required; a human will check it later.
5. **Emergency Contacts & Terms** — she adds her contacts (each needs a name, phone number, and relationship) and ticks three consent boxes: terms & conditions, privacy policy, and emergency-contact usage.

She presses **Register**. Behind the scenes the system:

- checks nobody else already has her exact name,
- creates her login account,
- and **automatically** saves her profile, her ID for review, and her emergency contacts — she never has to enter them twice.

She's sent to the login page with a message: *"Registration received. An administrator will review your account and ID before activation."*

She **can log in**, but her account is **pending** — it exists, it just isn't active yet.

---

## Part 2 — An admin approves her

The admin opens the dashboard and goes to **Residents & review**. Two panels matter:

- **Pending registrations** — new signups waiting for a decision. The admin approves Maria → her account becomes **active**. (Rejecting removes the registration entirely.)
- **ID verification** — Maria's uploaded ID photo. The admin can **approve** it, **reject** it, or **request a clearer photo** — in which case Maria re-uploads.

Once approved, Maria's account is fully usable.

---

## Part 3 — Maria reports an emergency

A fire breaks out near her street. Maria clicks **New incident**.

The report form asks for:

- **Emergency type** — one of eight: Fire, Medical, Police, Natural Disaster, Utility (power/gas/water), Traffic Accident, Hazardous Materials, or Other.
- **Location** — the app tries to grab her GPS position automatically; she can also type it manually.
- **Priority** — critical, high, medium, or low.
- **Description** — what happened, when, immediate dangers.
- **Photos** — optional, but supported.

Two helpful details:

- If she's **halfway through and closes the page**, the draft is auto-saved and restores next time.
- Because Maria is a resident, the **boundary check** runs: if her location lands outside the service area she sees a warning — but the report **still submits**, flagged as out-of-area. (Staff see no warning at all; they can file from anywhere.)

She submits. The report lands in the system marked **NEW / pending**, and dispatchers see it appear in their queue immediately — no refresh needed.

---

## Part 4 — A dispatcher triages it

The dispatcher's job is to read incoming reports and send the right help.

Their view — the **Incident queue**:

- A red badge shows how many unresolved incidents are open.
- Filter chips narrow the list: **all / pending / assigned / in progress / resolved**.
- A search box finds reports by ID, location, description, or reporter.

For Maria's fire report the dispatcher has these options:

| Action | What happens |
|--------|--------------|
| **Assign** | Opens a picker — choose a responder and set the priority. Report becomes **assigned**. |
| **Accept** | Accepts the report directly — also becomes **assigned**. |
| **Decline** | Marks it **declined** and records a reason. Ends the report. |
| **Resolve** | Closes it immediately as **resolved**. |
| **Turnover** | Closes it **resolved** with a detailed handover note (see Part 6). |
| **Request assistance** | Asks for help from other departments. |
| **Bulk actions** | Tick several reports and accept, decline, or export them at once. |

The dispatcher picks the nearest fire responder, sets priority to **high**, and assigns.

---

## Part 5 — A responder handles it

Jose the responder is on the **Response board** — a page showing only incidents assigned to him. Maria's report pops up on his board automatically the moment it's assigned.

Each card shows the emergency type, location, and details, plus the action that fits its state:

- **Acknowledge** (shown while the incident is *assigned*) → Jose presses it on arrival; the incident is now **in progress** and dispatch sees the update.
- **Resolve** (shown while *in progress*) → pressed when the situation is under control; the incident is marked **resolved**.

The whole life of the incident: **new → assigned → in progress → resolved**.

---

## Part 6 — Closing out properly

At resolution, a **turnover report** can capture what actually happened:

- **Actions taken** — what the response team did.
- **Resources used** — personnel, equipment, vehicles.
- **Outcome** — Fully Resolved / Partially Resolved / Referred to Another Agency / Ongoing Investigation.
- **Recommendations** — notes for future similar incidents.
- **Follow-up?** — a checkbox; if ticked, follow-up notes are required.

The resolved incident stays in the queue history under the **resolved** filter.

---

## Supporting features along the way

- **Emergency contacts** — Maria can add/edit/delete contacts in her **Profile** anytime, including a "primary" contact. Signup contacts are already there.
- **Notifications** — the bell icon shows updates, like new incidents for dispatchers.
- **Departments** — admins create departments and put staff in them; cross-department assistance requests use these.
- **Staff can file reports too** — dispatchers and admins have a **New incident** button and bypass the boundary check entirely.
- **Password reset** — "Forgot password" emails a reset link that opens a page to set a new one.
- **Location isn't a gate** — residents can use everything from anywhere; the boundary only labels the report's service-area flag.

## Status cheat sheet

| Status | Meaning | Who moves it forward |
|--------|---------|---------------------|
| **pending** | New report, waiting in the queue | Submitted automatically |
| **assigned** | Dispatcher sent it to a responder | Dispatcher |
| **in-progress** | Responder acknowledged it | Responder |
| **resolved** | Closed, with optional turnover note | Responder or dispatcher |
| **declined** | Rejected with a recorded reason | Dispatcher |
