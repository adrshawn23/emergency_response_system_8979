# Emergency Response System - Testing Guide

## Prerequisites

Before testing, ensure all database migrations have been run in Supabase SQL Editor:

1. ✅ 20261017040000_fix_departments_rls.sql
2. ✅ 20261019020000_admin_read_all_profiles.sql
3. ✅ 20261019030000_add_department_id_to_user_profiles.sql
4. ✅ 20261019040000_admin_update_all_profiles.sql
5. ✅ 20261019050000_add_assignment_columns_to_reports.sql
6. ✅ 20261019060000_dispatcher_assign_incidents.sql
7. ✅ 20261019070000_responder_update_assigned_incidents.sql
8. ✅ 20261019080000_audit_logs.sql
9. ✅ 20261019090000_id_verifications.sql

## Test Accounts

- **Admin:** `admin@emergency.gov` / `admin123`
- **Dispatcher:** `dispatcher@emergency.gov` / `dispatcher123`
- **Responder:** `responder@emergency.gov` / `responder123`

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
   - Callback: "09948270026"
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
4. Verify "No new notifications" message appears
5. Click the X to close panel
6. Sign out

**Expected Result:** Notification panel opens and closes correctly

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

---

## Reporting Issues

If you encounter any errors during testing:

1. Note the exact error message
2. Record which test step failed
3. Check browser console for additional errors
4. Verify all migrations were run in Supabase
5. Report the issue with reproduction steps
