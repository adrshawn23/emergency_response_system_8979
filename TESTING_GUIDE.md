# Emergency Response System - End-to-End Testing Guide

## ⚠️ IMPORTANT: Prerequisites

### Supabase Configuration Required
Before testing, you MUST configure Supabase credentials:

1. Create a `.env` file in the project root (copy from `.env.example`)
2. Add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-supabase-project-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
3. Get these values from: https://supabase.com/dashboard
4. Restart the development server after adding the `.env` file

### Database Setup
Ensure your Supabase project has the following tables:
- `user_profiles`
- `departments`
- `emergency_reports`
- `emergency_contacts`
- `broadcasts`

### Storage Setup
Ensure Supabase Storage has these buckets:
- `report-images` (for emergency report images)
- `id-documents` (for ID verification uploads)

## Testing Environment
- **URL:** http://localhost:4028
- **Status:** Development server running
- **Prerequisites:** ⚠️ Supabase configuration required

---

## Test 1: Registration Flow (Sign Up)

### Steps:
1. Navigate to http://localhost:4028
2. Click "Register" or go to `/register`
3. **Step 1 - Personal Information:**
   - Enter First Name: `Test`
   - Enter Last Name: `User`
   - Enter Email: `test@example.com`
   - Enter Phone: `(555) 123-4567`
   - Enter Date of Birth
   - Enter Address
   - Click "Continue"

4. **Step 2 - Account Security:**
   - Enter Password: `Test@1234`
   - Confirm Password: `Test@1234`
   - Click "Continue"

5. **Step 3 - Role Selection:**
   - Select a role (e.g., Resident)
   - Click "Continue"

6. **Step 4 - Identity Verification:**
   - Upload a valid ID document (image or PDF)
   - Click "Continue"

7. **Step 5 - Emergency Contacts & Terms:**
   - Add at least one emergency contact
   - Agree to all terms (Terms & Conditions, Privacy Policy, Emergency Contact Usage)
   - Click "Create Account"

### Expected Result:
- Registration successful message
- Redirected to login page
- Email verification instructions displayed

---

## Test 2: Login Flow (Sign In)

### Steps:
1. Navigate to `/login`
2. Enter Email: `test@example.com` (or use existing credentials)
3. Enter Password: `Test@1234`
4. Click "Sign In"

### Expected Result:
- Successfully authenticated
- Redirected to Dashboard
- User profile displayed in header
- Sidebar shows navigation items based on role

---

## Test 3: Admin Workflow

### Prerequisites:
- Log in as Admin user

### 3.1 Dashboard Test
1. Verify Dashboard loads
2. Check stats cards display (Total Reports, Pending, Active Responders, etc.)
3. Verify Recent Activity section
4. Test Quick Actions:
   - Click "New Emergency Report" → should navigate to `/emergency-report`
   - Click "Manage Users" → should navigate to `/user-management`
   - Click "Departments" → should navigate to `/department-management`
   - Click "View Reports" → should navigate to `/report-management`

### 3.2 User Management Test
1. Navigate to `/user-management`
2. Verify user list displays
3. Test filters:
   - Search by name/email
   - Filter by role
   - Filter by department
   - Filter by status
4. Test user actions:
   - Click "View" on a user → User Modal opens in view mode
   - Click "Edit" on a user → User Modal opens in edit mode
   - Click "Activate/Deactivate" → Status changes
5. Test "Add Responder" button
6. Check Pending Registrations section (if any pending users)
7. Test Approve/Reject on pending registrations

### 3.3 Department Management Test
1. Navigate to `/department-management`
2. Verify department list displays
3. Test "Add Department" button
4. Test Edit on existing department
5. Test Delete on department
6. Test department hierarchy view

---

## Test 4: Resident Workflow

### Prerequisites:
- Log in as Resident user

### 4.1 Emergency Report Test
1. Navigate to `/emergency-report`
2. Select Emergency Type (Fire, Medical, Police, etc.)
3. Enter Location (use "Verify Location" if available)
4. Select Priority (Critical, High, Medium, Low)
5. Enter Description
6. Enter Contact Name and Phone
7. Upload images (optional)
8. Click "Submit Report"

### Expected Result:
- Report submission success message
- Report number displayed
- Redirected after 5 seconds

### 4.2 Broadcasting Test
1. Navigate to `/broadcasting`
2. Verify broadcast history displays
3. Check broadcast details (message, type, timestamp)
4. For Admin/Dispatcher: Test creating new broadcast

### 4.3 Emergency Contacts Test
1. Navigate to `/emergency-contacts`
2. Verify emergency contacts list
3. Test "Add Contact" button
4. Add a new contact (name, phone, relationship)
5. Test "Call" button on contact
6. Test "Delete" on contact

---

## Test 5: Responder Workflow

### Prerequisites:
- Log in as Responder user

### 5.1 Report Management Test
1. Navigate to `/report-management`
2. Verify assigned reports display
3. Test filters (status, priority, type)
4. Click "View Details" on a report → Report Details Modal opens
5. Check different tabs (Details, Location, Media, History)
6. Test report status updates

### 5.2 Department Change Test
1. Navigate to `/account-management`
2. Click "Department" tab
3. Click "Request Department Change"
4. Select new department
5. Enter reason for change
6. Submit request

### Expected Result:
- Request submitted message
- Admin approval required

---

## Test 6: Dispatcher Workflow

### Prerequisites:
- Log in as Dispatcher user

### 6.1 Report Management Test
1. Navigate to `/report-management`
2. Verify all incoming reports display
3. Test filters and sorting
4. On a pending report:
   - Click "Accept" → Status changes to "assigned"
   - Click "Decline" → Rejection modal opens, enter reason
   - Click "Assign Responder" → Assignment modal opens
5. Test turnover functionality (assign to different responder)

### 6.2 Broadcasting Test
1. Navigate to `/broadcasting`
2. Test creating new emergency broadcast
3. Verify broadcast appears in history

---

## Test 7: Shared Features

### 7.1 Notifications Test
1. Navigate to `/notifications`
2. Verify notifications list displays
3. Check read/unread status
4. Click "Mark as Read" on notification
5. Click "Mark All as Read"
6. Test "Delete" on notification
7. Click notification → navigates to related page

### 7.2 Account Management Test
1. Navigate to `/account-management`
2. **Profile Tab:**
   - Verify profile information displays
   - Test editing name, phone
   - Click "Save Changes"
3. **Security Tab:**
   - Click "Change Password"
   - Enter current password
   - Enter new password
   - Confirm new password
   - Click "Update Password"
4. **Department Tab** (for Responder/Dispatcher):
   - Test department change request (see Test 5.2)
5. Click "Log Out" → should redirect to login

---

## Test 8: Role-Based Access Control

### Test unauthorized access:
1. Log in as Resident
2. Try to access `/user-management` → should redirect to Dashboard
3. Try to access `/department-management` → should redirect to Dashboard
4. Try to access `/geofence-settings` → should redirect to Dashboard

5. Log in as Responder
6. Try to access `/user-management` → should redirect to Dashboard
7. Try to access `/department-management` → should redirect to Dashboard

8. Log in as Admin
9. Verify access to all pages

---

## Test 9: Sidebar Navigation

1. Verify sidebar displays based on user role
2. Test each navigation item:
   - Dashboard
   - Emergency Report
   - Report Management
   - Broadcasting
   - Emergency Contacts
   - Notifications
   - Account Management
   - User Management (Admin only)
   - Department Management (Admin only)
   - Service Area (Admin only)
3. Test sidebar collapse/expand toggle
4. Verify active item highlighting

---

## Test 10: Responsive Design

1. Resize browser window to different sizes:
   - Desktop (1920x1080)
   - Laptop (1366x768)
   - Tablet (768x1024)
   - Mobile (375x667)
2. Verify layout adapts correctly
3. Test sidebar behavior on mobile
4. Test table scrolling on small screens

---

## Bug Reporting

If you encounter any issues during testing, document:
1. **Issue Description:** What went wrong
2. **Steps to Reproduce:** Exact steps that caused the issue
3. **Expected Behavior:** What should have happened
4. **Actual Behavior:** What actually happened
5. **Browser/OS:** Browser version and operating system
6. **Screenshots:** If applicable

---

## Test Results Checklist

- [ ] Registration flow successful
- [ ] Login flow successful
- [ ] Admin Dashboard functional
- [ ] User Management functional
- [ ] Department Management functional
- [ ] Emergency Report submission works
- [ ] Broadcasting system works
- [ ] Emergency Contacts management works
- [ ] Report Management works for all roles
- [ ] Dispatcher Accept/Decline/Turnover works
- [ ] Department change request works
- [ ] Notifications system works
- [ ] Account Management works
- [ ] Role-based access control enforced
- [ ] Sidebar navigation functional
- [ ] Responsive design verified

---

## Notes

- The system uses Supabase for backend - ensure Supabase credentials are configured
- Some features may require actual database records to function properly
- ID upload functionality requires Supabase storage bucket configuration
- Geofence features require location services permission
