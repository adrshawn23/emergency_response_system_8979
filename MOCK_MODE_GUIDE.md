# Mock Mode Guide

This guide explains how to use the mock data mode for testing the Emergency Response System without requiring a live Supabase connection.

## What is Mock Mode?

Mock mode allows you to test all features of the application using pre-defined mock data instead of connecting to a real Supabase database. This is useful for:
- Development and testing without database setup
- Demonstrating the application functionality
- End-to-end testing of all modules

## How to Enable Mock Mode

1. **Using the UI Toggle**
   - Look for the "Mock/Live" button in the header (top right corner)
   - Click to toggle between Mock mode (blue) and Live mode (gray)
   - The setting is saved in localStorage and persists across page refreshes

2. **Programmatically**
   ```javascript
   import { useMockData } from './contexts/MockDataContext';
   
   const { useMock, toggleMockMode } = useMockData();
   console.log('Mock mode:', useMock); // Check current mode
   toggleMockMode(); // Toggle between modes
   ```

## Mock Data Available

### Users (Account Management)
- **Admin**: admin@emergency.gov / admin123
- **Dispatcher**: dispatcher1@emergency.gov
- **Responder**: responder1@emergency.gov
- **Resident**: resident1@example.com
- **Pending User**: pending@example.com (requires approval)

### Departments
- Administration
- Fire Department
- Medical Services
- Police Department

### Emergency Reports
- Fire emergency (pending)
- Medical emergency (assigned)
- Traffic accident (in-progress)
- Natural disaster (pending)
- Police incident (resolved)

### Notifications
- Emergency alerts
- Assignment notifications
- System updates
- Weather alerts

### Broadcasts
- Flash flood warning
- Road closure alerts
- System maintenance notices

### Emergency Contacts
- Pre-defined emergency contacts for testing

### Locations
- Central Hospital
- Fire Station 1
- Police Precinct
- Emergency Shelter A

## Testing Each Module

### 1. Account Management (Login, Register, Profile)
**Login with Mock Mode:**
- Email: `admin@emergency.gov`
- Password: `admin123`

**Features to Test:**
- ✅ Login with different user roles
- ✅ View profile information
- ✅ Update profile details
- ✅ Logout functionality

### 2. Emergency Report (Send Emergency Report)
**Features to Test:**
- ✅ Create new emergency report
- ✅ Select emergency type (fire, medical, police, accident, natural)
- ✅ Set priority level
- ✅ Enter location and description
- ✅ Submit report successfully
- ✅ View report confirmation

### 3. Notification (View Notifications)
**Features to Test:**
- ✅ View notification list
- ✅ Filter by notification type
- ✅ Mark notifications as read
- ✅ View notification details

### 4. Broadcasting (Confirm/Receive Broadcast Alert)
**Features to Test:**
- ✅ View active broadcasts
- ✅ Confirm receipt of broadcast
- ✅ View broadcast details
- ✅ Filter by severity level

### 5. Report Handling (Accept/Decline, Assign Responder)
**Features to Test:**
- ✅ View all reports
- ✅ Accept pending reports
- ✅ Decline reports with reason
- ✅ Assign responders to reports
- ✅ Submit turnover reports
- ✅ Filter reports by status/priority

### 6. Emergency Contact (View Emergency Contacts)
**Features to Test:**
- ✅ View emergency contacts list
- ✅ Add new emergency contacts
- ✅ Edit contact information
- ✅ Delete contacts
- ✅ Submit emergency report with location
- ✅ View GPS Location (always uses real-time GPS regardless of mode)

### 7. Location Map (View GPS Location)
**Features to Test:**
- ✅ View location on map
- ✅ Get current GPS location
- ✅ View nearby emergency services
- ✅ Navigate to locations

## Module Coverage Matrix

| Programmer | Module | Function | Mock Support |
|-----------|--------|----------|--------------|
| Las Piñas, Kryshan Aleizel | Account Management | Login | ✅ |
| | | View Profile | ✅ |
| | | Edit/Update Profile | ✅ |
| | | Change Password | ✅ |
| | | Logout | ✅ |
| Dagatan, Shawn Michael | Emergency Report | Send Emergency Report | ✅ |
| | | View Reports | ✅ |
| Frejoles, Cindy | Notification | View Notifications | ✅ |
| Frejoles, Cindy | Broadcasting | Confirm/Receive Broadcast Alert | ✅ |
| Las Piñas, Kryshan Aleizel | Report Handling | Accept/Decline Report | ✅ |
| | | Assign Responder | ✅ |
| | | Submit Turnover Report | ✅ |
| Frejoles, Cindy | Emergency Contact | View Emergency Contacts | ✅ |
| Las Piñas, Kryshan Aleizel | Location Map | View GPS Location | ✅ |

**Legend:**
- ✅ Fully functional with mock data

## Switching Between Mock and Live Mode

When switching from Mock to Live mode:
1. Click the toggle button in the header
2. The page will refresh with live Supabase data
3. Ensure your `.env` file has valid Supabase credentials

When switching from Live to Mock mode:
1. Click the toggle button in the header
2. The page will refresh with mock data
3. No database connection required

## Important Notes

- Mock data is stored in memory and resets on page refresh
- Changes made in mock mode are not persisted
- To test persistence, use Live mode with Supabase
- Mock mode is perfect for UI/UX testing and demonstrations
- For production testing, always use Live mode

## Troubleshooting

**Mock mode not working:**
- Check browser console for errors
- Ensure MockDataProvider is in Routes.jsx
- Clear localStorage and refresh

**Login failing in mock mode:**
- Use the provided mock credentials
- Check email format matches exactly
- Ensure password is correct

**Data not updating:**
- Mock data resets on refresh (expected behavior)
- For persistent data, use Live mode

## Adding More Mock Data

To add more mock data, edit `src/data/mockData.js`:

```javascript
export const mockUsers = [
  // Add new users here
  {
    id: 'new-id',
    email: 'new@example.com',
    first_name: 'New',
    last_name: 'User',
    // ... other fields
  }
];
```

## Support

For issues or questions about mock mode, please refer to the main README.md or contact the development team.
