# Emergency Response System - Testing Guide

## Prerequisites

Before testing, run **all** files in `supabase/migrations/` in filename order in the Supabase SQL Editor. Key migrations include:

- `20250105014120_emergency_response_system.sql` — core schema
- `20261016090000_operational_workflows.sql`, `20261016120000_harden_incident_rbac.sql` — workflows + role policies
- `20261017040000_fix_departments_rls.sql` — department RLS
- `2026101902...` through `20261019090000_...` — admin profile access, assignment columns, dispatcher/responder permissions, audit logs, ID verifications
- `20261021*_fix_emergency_reports_schema_v*.sql` — report schema fixes (run the latest version in sequence)
- `20261022160000_restore_user_profile_columns.sql` — restores profile columns used by the app
- `20261022170000_name_uniqueness_check.sql` — `is_name_taken` RPC used by registration
- `20261023140000_signup_pending_profile_trigger.sql` — `handle_new_user` trigger that auto-creates profile, ID-verification record, and emergency contacts on signup

## Test Accounts

- **Admin:** `admin@emergency.gov` / `admin123`
- **Dispatcher:** `dispatcher@emergency.gov` / `dispatcher123`
- **Responder:** `responder@emergency.gov` / `responder123`
- **Resident:** `resident@example.com` / `resident123`

---

## Test 1: Department Management

**Role:** Admin

**Steps:**
1. Login as admin
2. Click "Departments" in sidebar
3. Click "Create Department"
4. Fill in department details (name: "Test Medical Department", description: "Test department")
5. Click "Create Department"
6. Verify department appears in list
7. Click "Assign members" on the new department
8. Click "Assign" next to the responder
9. Verify member count updates to 1
10. Sign out

**Expected Result:** Department created, responder assigned, member count shows 1

---

## Test 2: Incident Creation with Image Upload

**Role:** Dispatcher

**Steps:**
1. Login as dispatcher
2. Click "New incident" in sidebar
3. Fill in incident details:
   - Emergency type: Fire
   - Priority: High
   - Location: "123 Test Street"
   - Description: "Test incident with image upload"
4. Click "Choose files" under "Upload evidence"
5. Select 1-2 images
6. Verify image previews appear with remove buttons
7. Click "Submit report"
8. Verify success message with report ID appears
9. Sign out

**Expected Result:** Incident created with images, success message shown

---

## Test 3: Incident Assignment

**Role:** Dispatcher

**Steps:**
1. Login as dispatcher
2. Click "Incident queue" in sidebar
3. Find a pending incident
4. Click "Assign" button
5. In the modal:
   - Select "Test Medical Department" (or the department you created)
   - Select the responder from dropdown
6. Click "Assign"
7. Verify incident status changes to "assigned"
8. Sign out

**Expected Result:** Incident assigned to responder, status updated to "assigned"

---

## Test 4: Responder Workspace - View Assigned Incident

**Role:** Responder

**Steps:**
1. Login as responder
2. Verify the assigned incident appears in the response board
3. Verify incident details are correct (type, location, priority)
4. Sign out

**Expected Result:** Assigned incident visible to responder

---

## Test 5: Responder Workflow - Acknowledge and Resolve

**Role:** Responder

**Steps:**
1. Login as responder
2. Click "Acknowledge" on the assigned incident
3. Verify status changes to "in-progress"
4. Click "Resolve" on the incident
5. Verify status changes to "resolved"
6. Sign out

**Expected Result:** Status progresses: assigned → in-progress → resolved

---

## Test 6: Cross-Department Assistance

**Role:** Dispatcher

**Steps:**
1. Login as dispatcher
2. Click "Incident queue"
3. Find an incident (any status except resolved)
4. Click the users icon button (next to Assign/Resolve button)
5. In the modal:
   - Select one or more departments to assist
   - Click "Request"
6. Verify modal closes
7. Sign out

**Expected Result:** Assistance request modal works, departments can be selected

---

## Test 7: Emergency Contacts Management

**Role:** Any User

**Steps:**
1. Login as any user (admin, dispatcher, or responder)
2. Click "Profile" in sidebar
3. Click "Add Contact"
4. Fill in contact details:
   - Name: "John Doe"
   - Relationship: "Spouse"
   - Phone: "09948270026"
   - Check "Primary contact" if desired
5. Click "Add Contact"
6. Verify contact appears in list
7. Click "Delete" next to the contact
8. Verify contact is removed
9. Sign out

**Expected Result:** Contacts can be added and deleted

---

## Test 8: Notification Panel

**Role:** Any User

**Steps:**	
1. Login as any user
2. Click the bell icon in the top-right header
3. Verify notification panel slides out
4. Verify it lists real events (new incidents, assignments) or an empty-state message if there are none
5. Click the X to close panel
6. Sign out

**Expected Result:** Notification panel opens, shows live incident/assignment notifications, and closes correctly

---

## Test 9: Boundary Configuration with Leaflet Map

**Role:** Admin

**Steps:**
1. Login as admin
2. Click "Settings" in sidebar
3. Click "Configure boundary"
4. Verify modal opens with interactive Leaflet map
5. Click on the map at different locations to add boundary points
6. Verify markers appear at clicked locations
7. Click on a marker to remove it
8. Add at least 3 points to form a polygon
9. Verify the polygon is drawn on the map
10. Click "Save Boundary"
11. Verify modal closes
12. Go to "Command center" and verify the service boundary is displayed on the map
13. Sign out

**Expected Result:** Boundary points can be added/removed on the map, polygon is drawn, and boundary persists and displays on command center map

---

## Test 10: Community Verification Section

**Role:** Admin

**Steps:**
1. Login as admin
2. Click "Residents & review" in sidebar
3. Verify "Community verification" card is visible
4. Verify duplicate prevention description is shown
5. Click "View duplicates" (placeholder button)
6. Sign out

**Expected Result:** Community verification section displays correctly

---

## Test 11: Duplicate Name Prevention

**Steps:**
1. Go to registration page (/register)
2. Fill in registration details with an existing user's name (e.g., "Administrator")
3. Complete all steps
4. Click "Create Account"
5. Verify error message: "A user with this name already exists. Please contact support if this is an error."
6. Try again with a unique name
7. Complete registration successfully

**Expected Result:** Registration rejected for duplicate names, accepted for unique names

---

## Test 12: ID Verification - Registration

**Steps:**
1. Go to registration page
2. Complete steps 1-3 (Personal Info, Account Security, Role Selection)
3. In step 4 (Identity Verification):
   - Upload an ID document
4. Complete step 5 (Emergency Contacts & Terms)
5. Click "Create Account"
6. Verify success message
7. Note: Account will be pending activation

**Expected Result:** ID verification record created, account pending

---

## Test 13: ID Verification - Admin Review

**Role:** Admin

**Steps:**
1. Login as admin
2. Click "Residents & review" in sidebar
3. Verify "ID verification queue" shows pending count
4. Click on a pending verification
5. In the review modal:
   - Verify user name and email
   - Verify OCR confidence score
   - Verify extracted data
   - Click "Approve & Activate"
6. Verify status changes to "approved"
7. Sign out

**Expected Result:** Verification approved, user account activated

---

## Test 14: ID Verification - Reject

**Role:** Admin

**Steps:**
1. Login as admin
2. Click "Residents & review"
3. Click on a pending verification
4. Click "Reject"
5. Verify status changes to "rejected"
6. Sign out

**Expected Result:** Verification rejected

---

## Test 15: ID Verification - Request Clarity

**Role:** Admin

**Steps:**
1. Login as admin
2. Click "Residents & review"
3. Click on a pending verification
4. Click "Request Clarity"
5. Verify status changes to "needs_clarity"
6. Sign out

**Expected Result:** User prompted to upload clearer ID

---

## Test 16: Queue Badge Count

**Role:** Dispatcher

**Steps:**
1. Login as dispatcher
2. Click "Incident queue"
3. Filter by "pending"
4. Note the number of pending incidents
5. Look at the sidebar "Incident queue" link
6. Verify badge shows the same number
7. Sign out

**Expected Result:** Badge accurately reflects pending incident count

---

## Test 17: Incident Status Filtering

**Role:** Dispatcher

**Steps:**
1. Login as dispatcher
2. Click "Incident queue"
3. Click each filter button: all, pending, assigned, in-progress, resolved
4. Verify only incidents with matching status are shown
5. Sign out

**Expected Result:** Status filters work correctly

---

## Test 18: Resolve Incident from Queue

**Role:** Dispatcher

**Steps:**
1. Login as dispatcher
2. Click "Incident queue"
3. Find an assigned or in-progress incident
4. Click "Resolve" button
5. Verify status changes to "resolved"
6. Sign out

**Expected Result:** Incident resolved directly from queue

---

## Test 19: Resident Registration — 5-Step Flow & Validation

**Role:** New user (no login)

**Steps:**
1. Go to /register
2. Step 1 (Personal Information): enter first/last name, email, date of birth
3. Enter an invalid phone (not 11 digits or not starting with 0) — verify a validation error; fix to e.g. "09948270026"
4. Enter an address that does NOT mention Kalubihan — verify Continue is blocked with an out-of-area message
5. Change address to "Brgy Kalubihan, Zone 1" — Continue now works
6. Step 2 (Account Security): enter mismatched passwords — verify error; fix and continue
7. Step 3 (Role Selection): choose **Resident** — continue
8. Step 4 (Identity Verification): try to continue without an ID — blocked; upload an ID image — continue
9. Step 5 (Emergency Contacts & Terms): add a contact (name, relationship, 11-digit phone); tick all three consent checkboxes
10. Click "Create Account"
11. Verify redirect to login with a pending-review message

**Expected Result:** Every validation gate works; account is created in a pending state and a success message is shown

---

## Test 20: Pending Account — Login & Admin Approve/Reject

**Role:** New resident + Admin

**Steps:**
1. Log in with the newly registered account
2. Note what the resident can access while the account is pending
3. Sign out; log in as admin
4. Go to "Residents & review"
5. Verify the new account appears under pending registrations
6. Click "Approve" — verify the account becomes active
7. (Optional) register a second test account and click "Reject" — verify it is removed from the list
8. Sign out

**Expected Result:** Pending accounts are listed for review; approve activates, reject removes

---

## Test 21: Resident Report Submission

**Role:** Resident

**Steps:**
1. Login as resident
2. On the home page click "Report an emergency"
3. Verify the five emergency types are selectable: Fire, Medical, Accident, Public safety, Natural hazard
4. Fill in: type = Fire, priority = High, location = "789 Resident Road", description = "House fire on the corner"
5. Optionally attach an image and verify the preview
6. Click "Submit report"
7. Verify the "Report submitted" confirmation with a report ID
8. Sign out; log in as dispatcher and verify the report appears in the queue as "pending"

**Expected Result:** Resident can submit; report lands in the dispatcher queue as pending

---

## Test 22: Outside-Boundary Reporting (Residents) vs Staff Bypass

**Role:** Resident + Dispatcher

**Steps:**
1. Login as resident and start a new report
2. Allow GPS access while physically outside the configured boundary (or set a browser geolocation override outside the polygon)
3. Verify a warning is shown: "GPS location is outside the Barangay Kalubihan service area..."
4. Submit anyway — verify the report is accepted
5. As dispatcher, check the queue — verify the report is stored with an outside service-area flag
6. As dispatcher (staff), create a new incident — verify no boundary check runs at all

**Expected Result:** The boundary check applies to residents' GPS position only; manual text locations are always accepted; staff bypass the check entirely. Note: the check uses live GPS — a manually typed address cannot be geocoded, so it is never warned or flagged

---

## Test 23: Report Draft Autosave

**Role:** Any user

**Steps:**
1. Start a new incident report
2. Fill in type, location, and part of the description — do NOT submit
3. Navigate away (e.g., back to the command center) or reload the page
4. Return to the report form
5. Verify the entered fields are restored

**Expected Result:** Unsubmitted drafts survive navigation/reload

---

## Test 24: Queue Search & Report Details

**Role:** Dispatcher

**Steps:**
1. Login as dispatcher, open "Incident queue"
2. Type a report ID, location fragment, or reporter name in the search box
3. Verify the list narrows to matching reports
4. Clear the search and click a report row
5. Verify the details view opens showing full information: reporter, contact number, description, timestamps, and service-area status
6. Close the details view

**Expected Result:** Search filters correctly; row click shows full report details

---

## Test 25: Queue Action Buttons by Status

**Role:** Dispatcher

**Steps:**
1. In the queue, find a pending incident — verify the row offers **Assign** and the assistance (users) icon
2. Find an assigned or in-progress incident — verify the row offers **Resolve** and the assistance icon
3. Find a resolved incident — verify no action buttons are shown
4. Click **Resolve** on an assigned incident — verify its status becomes resolved immediately

**Expected Result:** Pending rows can be assigned, open rows can be resolved directly, resolved rows offer no actions. Note: there are no separate Accept/Decline controls in the current queue — declining is not a supported queue action

---

## Test 26: Queue Visibility by Role

**Role:** Responder + Resident

**Steps:**
1. Login as responder and open /report-management directly
2. Verify the incident list is visible but the Assign/Resolve/assistance action buttons are NOT shown (dispatcher/admin only)
3. Login as resident — verify no "Incident queue" link exists in the sidebar

**Expected Result:** Responders can view the queue read-only; residents have no queue access. If tighter responder isolation is required, flag it as a permission-policy review item

---

## Test 27: Direct Closure Path

**Role:** Dispatcher

**Steps:**
1. In the queue, find an assigned incident
2. Click "Resolve" — verify the status changes to resolved with no additional form
3. Confirm no outcome, reason, or second approval is required

**Expected Result:** Closure is immediate by design in the current build. If your process requires a closure outcome or turnover note, record it as a product requirement — it is not currently enforced

**Note on drafts:** Drafts are keyed per user and survive reload and in-app navigation, but signing out clears all localStorage (deliberate session cleanup), so a draft does NOT survive sign-out. This is intended — test draft persistence within a session, not across sign-out.

---

## Test 28: Real-Time Updates (Two Sessions)

**Role:** Resident + Dispatcher + Responder (two browser windows)

**Steps:**
1. Open the dispatcher's Incident queue in one window
2. In another window (or incognito), submit a new report as resident
3. Verify the new incident appears in the queue without refreshing
4. Assign it to the responder
5. In a responder session, verify the incident appears on the response board without refreshing

**Expected Result:** New reports and assignments appear live — no manual refresh needed

---

## Test 29: Profile & Password Change

**Role:** Any user

**Steps:**
1. Login as any user, open "Profile"
2. Verify account details are shown (name, email, phone, role)
3. Open the password change form
4. Enter mismatched new passwords — verify a validation error
5. Enter a correct new password and submit — verify success
6. Sign out and log back in with the new password
7. Restore the original password if this is a test account

**Expected Result:** Password validation works; new password takes effect on next login

---

## Test 30: Role-Based Route Guards

**Role:** Resident + Responder + logged out

**Steps:**
1. Login as resident
2. Try opening /user-management, /department-management, and /settings directly via the address bar
3. Verify you are redirected to the home page each time
4. Open /emergency-report directly — verify it loads (allowed for residents)
5. Login as responder — verify /settings is blocked but the response board works
6. Sign out and try any protected URL — verify redirect to /login

**Expected Result:** Staff-only routes are blocked by role; protected routes require login

---

## Test 31: Resident Access From Outside the Boundary

**Role:** Resident

**Steps:**
1. While physically outside Barangay Kalubihan (or with browser location set outside the polygon), open the app
2. Log in and navigate every page — verify nothing is blocked
3. Submit a report — verify it is accepted and flagged out-of-area
4. Verify emergency contacts and profile still work normally

**Expected Result:** The boundary never restricts app access — it only labels reports

---

## Cleanup (Optional)

After testing, you may want to clean up test data:

**Role:** Admin

**Steps:**
1. Login as admin
2. Go to "Departments"
3. Delete test departments
4. Go to "Residents & review"
5. Delete test users if needed
6. Sign out

---

## Known Limitations

- **OCR/AI:** ID verification uses mock OCR data; actual OCR requires an AI service (Google Vision, AWS Textract, etc.)
- **Image Storage:** Images are previewed client-side; actual storage requires Supabase Storage or similar service
- **Notifications:** Notification panel is a UI placeholder; actual push notifications require a notification service
- **Service Boundary:** Currently saved to localStorage; for production, should be stored in a database table with proper persistence
- **Cross-Department Assistance:** The request is shown in the UI and logged, but is not yet persisted to the database
- **Unrouted legacy pages:** Feature-rich standalone pages exist in `src/pages/emergency-report` and `src/pages/report-management` (8-type selector, bulk actions, turnover modal, decline flow) but are NOT wired into `Routes.jsx` — the dashboard's simpler built-in form and queue are what actually run. The legacy queue's schema fields (`location`, `description`, `contact_name` as columns) also predate the current `attachments` JSON layout, so it cannot simply be re-routed without reconciliation work
- **Report form scope:** The live report form offers 5 emergency types (Fire, Medical, Accident, Public safety, Natural hazard); there is no callback-phone field — the reporter's profile phone is attached automatically
- **Closure control:** Dispatcher and responder can resolve incidents immediately with no required outcome or turnover record

---

## Automated Coverage

Most of these tests are automated with Playwright (`npx playwright test`). The specs live in `e2e/`:

| Spec file | Covers |
|-----------|--------|
| `smoke_login.spec.js`, `auth.spec.js` | Login page, auth flows |
| `approval_flow.spec.js` | Admin approves pending accounts (Tests 13, 20) |
| `registration_area.spec.js` | Address must be in Kalubihan (Test 19) |
| `signup_lifecycle.spec.js` | Registration → pending → approval |
| `boundary.spec.js`, `geofence.spec.js` | Boundary editor, outside-area warnings, staff bypass (Tests 9, 22, 31) |
| `dashboard.spec.js` | Command center, notifications, contacts (Tests 7, 8) |
| `responder_profile.spec.js` | Responder profile |
| `full_ui_buttons.spec.js` | Button-level coverage incl. password change (Test 29) |
| `test_guide_automation.spec.js`, `test_guide_extra.spec.js` | Automated versions of Tests 1-18 |
| `full_lifecycle.spec.js`, `workflow.spec.js` | End-to-end resident → dispatch → responder lifecycle (Tests 3-5, 21, 28) |

---

## Reporting Issues

If you encounter any errors during testing:

1. Note the exact error message
2. Record which test step failed
3. Check browser console for additional errors
4. Verify all migrations were run in Supabase
5. Report the issue with reproduction steps
