// Service boundary configuration for geofence checking
// This should be moved to a database table in production

export const mockServiceBoundary = {
  id: 'kalubihan-demo-v1',
  name: 'Barangay Kalubihan service area (demo)',
  buffer_meters: 150,
  points: [
    { lat: 14.6075, lng: 121.0205 }, { lat: 14.6120, lng: 121.0212 },
    { lat: 14.6124, lng: 121.0251 }, { lat: 14.6080, lng: 121.0258 }
  ]
};

// All mock data removed - using Supabase database only
export const mockUsers = [];
export const mockDepartments = [];
export const mockEmergencyReports = [];
export const mockNotifications = [];
export const mockBroadcasts = [];
export const mockEmergencyContacts = [];
export const mockLocations = [];
export const mockAuth = {
  signIn: async () => ({ data: null, error: { message: 'Mock mode disabled' } }),
  signUp: async () => ({ data: null, error: { message: 'Mock mode disabled' } }),
  signOut: async () => ({ error: null }),
  getSession: async () => ({ data: { session: null }, error: null })
};
export const mockDb = {
  from: () => ({
    select: () => ({ eq: () => ({ order: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
    insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
    update: () => ({ eq: () => ({ then: async () => ({ error: null }) }) }),
    delete: () => ({ eq: () => ({ then: async () => ({ error: null }) }) })
  })
};
