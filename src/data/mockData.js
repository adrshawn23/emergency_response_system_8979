// Mock Data for Emergency Response System
// Use this for testing without Supabase connection

export const mockUsers = [
  {
    id: '1',
    email: 'admin@emergency.gov',
    first_name: 'System',
    last_name: 'Administrator',
    full_name: 'System Administrator',
    role: 'admin',
    phone: '09948270026',
    address: '123 Admin Street, City',
    date_of_birth: '1990-01-01',
    department: { id: 'dept-1', name: 'Administration', type: 'admin' },
    department_id: 'dept-1',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    avatar: null
  },
  {
    id: '2',
    email: 'dispatcher1@emergency.gov',
    first_name: 'Sarah',
    last_name: 'Johnson',
    full_name: 'Sarah Johnson',
    role: 'dispatcher',
    phone: '09948270027',
    address: '456 Dispatcher Ave, City',
    date_of_birth: '1985-05-15',
    department: { id: 'dept-2', name: 'Fire Department', type: 'fire' },
    department_id: 'dept-2',
    is_active: true,
    created_at: '2024-01-15T00:00:00Z',
    avatar: null
  },
  {
    id: '3',
    email: 'responder1@emergency.gov',
    first_name: 'Michael',
    last_name: 'Chen',
    full_name: 'Michael Chen',
    role: 'responder',
    phone: '09948270028',
    address: '789 Responder Road, City',
    date_of_birth: '1992-08-20',
    department: { id: 'dept-2', name: 'Fire Department', type: 'fire' },
    department_id: 'dept-2',
    is_active: true,
    created_at: '2024-02-01T00:00:00Z',
    avatar: null
  },
  {
    id: '4',
    email: 'resident1@example.com',
    first_name: 'Jennifer',
    last_name: 'Martinez',
    full_name: 'Jennifer Martinez',
    role: 'resident',
    phone: '09948270029',
    address: '321 Resident Lane, City',
    date_of_birth: '1995-03-10',
    department: null,
    department_id: null,
    is_active: true,
    created_at: '2024-02-15T00:00:00Z',
    avatar: null
  },
  {
    id: '5',
    email: 'responder2@emergency.gov',
    first_name: 'Robert',
    last_name: 'Thompson',
    full_name: 'Robert Thompson',
    role: 'responder',
    phone: '09948270030',
    address: '654 Medical Blvd, City',
    date_of_birth: '1988-11-25',
    department: { id: 'dept-3', name: 'Medical Services', type: 'medical' },
    department_id: 'dept-3',
    is_active: true,
    created_at: '2024-03-01T00:00:00Z',
    avatar: null
  },
  {
    id: '6',
    email: 'pending@example.com',
    first_name: 'Alex',
    last_name: 'Williams',
    full_name: 'Alex Williams',
    role: 'responder',
    phone: '09948270031',
    address: '987 Pending Street, City',
    date_of_birth: '1997-07-30',
    department: { id: 'dept-2', name: 'Fire Department', type: 'fire' },
    department_id: 'dept-2',
    is_active: false,
    created_at: '2024-03-15T00:00:00Z',
    avatar: null
  }
];

export const mockDepartments = [
  {
    id: 'dept-1',
    name: 'Administration',
    type: 'admin',
    description: 'System administration and oversight',
    contact_email: 'admin@emergency.gov',
    contact_phone: '09948270026',
    address: '123 Admin Street, City',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'dept-2',
    name: 'Fire Department',
    type: 'fire',
    description: 'Emergency fire response and prevention services',
    contact_email: 'fire@emergency.gov',
    contact_phone: '09948270027',
    address: '456 Fire Station Rd, City',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'dept-3',
    name: 'Medical Services',
    type: 'medical',
    description: 'Emergency medical response and healthcare services',
    contact_email: 'medical@emergency.gov',
    contact_phone: '09948270028',
    address: '789 Medical Center, City',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'dept-4',
    name: 'Police Department',
    type: 'police',
    description: 'Law enforcement and public safety services',
    contact_email: 'police@emergency.gov',
    contact_phone: '09948270029',
    address: '321 Police Station, City',
    created_at: '2024-01-01T00:00:00Z'
  }
];

export const mockEmergencyReports = [
  {
    report_id: 'REP-001',
    emergency_type: 'fire',
    priority: 'critical',
    status: 'pending',
    location: '123 Main Street, Downtown',
    latitude: 14.6091,
    longitude: 121.0225,
    description: 'Fire reported in commercial building. Multiple floors affected. Smoke visible from street.',
    contact_name: 'Jennifer Martinez',
    contact_phone: '09948270029',
    reporter_id: '4',
    assigned_to: null,
    images: [],
    created_at: '2024-03-20T08:30:00Z',
    updated_at: '2024-03-20T08:30:00Z'
  },
  {
    report_id: 'REP-002',
    emergency_type: 'medical',
    priority: 'high',
    status: 'assigned',
    location: '456 Oak Avenue, Residential Area',
    latitude: 14.6100,
    longitude: 121.0230,
    description: 'Person experiencing chest pain and difficulty breathing. Elderly individual.',
    contact_name: 'Robert Thompson',
    contact_phone: '09948270030',
    reporter_id: '5',
    assigned_to: '3',
    images: [],
    created_at: '2024-03-20T09:15:00Z',
    updated_at: '2024-03-20T09:20:00Z'
  },
  {
    report_id: 'REP-003',
    emergency_type: 'accident',
    priority: 'medium',
    status: 'in-progress',
    location: '789 Highway 1, Intersection',
    latitude: 14.6110,
    longitude: 121.0240,
    description: 'Two-vehicle collision at intersection. One person trapped. Minor injuries reported.',
    contact_name: 'Sarah Johnson',
    contact_phone: '09948270027',
    reporter_id: '2',
    assigned_to: '3',
    images: [],
    created_at: '2024-03-20T10:00:00Z',
    updated_at: '2024-03-20T10:30:00Z'
  },
  {
    report_id: 'REP-004',
    emergency_type: 'natural',
    priority: 'critical',
    status: 'pending',
    location: '321 Riverside Drive, Flood Zone',
    latitude: 14.6080,
    longitude: 121.0210,
    description: 'Flash flooding reported. Water levels rising rapidly. Multiple homes at risk.',
    contact_name: 'Michael Chen',
    contact_phone: '09948270028',
    reporter_id: '3',
    assigned_to: null,
    images: [],
    created_at: '2024-03-20T11:00:00Z',
    updated_at: '2024-03-20T11:00:00Z'
  },
  {
    report_id: 'REP-005',
    emergency_type: 'police',
    priority: 'high',
    status: 'resolved',
    location: '654 Commercial Street, Business District',
    latitude: 14.6095,
    longitude: 121.0228,
    description: 'Suspicious activity reported. Person attempting to break into vehicle.',
    contact_name: 'System Administrator',
    contact_phone: '09948270026',
    reporter_id: '1',
    assigned_to: null,
    images: [],
    created_at: '2024-03-20T07:00:00Z',
    updated_at: '2024-03-20T07:45:00Z'
  }
];

export const mockNotifications = [
  {
    id: 'notif-1',
    type: 'emergency',
    title: 'New Emergency Report',
    message: 'Critical fire emergency reported at 123 Main Street',
    timestamp: '2024-03-20T08:30:00Z',
    read: false,
    action_required: true,
    action_url: '/report-management'
  },
  {
    id: 'notif-2',
    type: 'assignment',
    title: 'Report Assigned',
    message: 'You have been assigned to medical emergency at 456 Oak Avenue',
    timestamp: '2024-03-20T09:20:00Z',
    read: false,
    action_required: true,
    action_url: '/report-management'
  },
  {
    id: 'notif-3',
    type: 'system',
    title: 'System Update',
    message: 'System maintenance scheduled for tonight at 11 PM',
    timestamp: '2024-03-20T07:00:00Z',
    read: true,
    action_required: false,
    action_url: null
  },
  {
    id: 'notif-4',
    type: 'alert',
    title: 'Weather Alert',
    message: 'Heavy rainfall expected in the next 24 hours',
    timestamp: '2024-03-20T06:00:00Z',
    read: true,
    action_required: false,
    action_url: null
  }
];

export const mockBroadcasts = [
  {
    id: 'broadcast-1',
    type: 'emergency',
    title: 'Flash Flood Warning',
    message: 'Flash flood warning in effect for downtown area. Seek higher ground immediately.',
    severity: 'critical',
    sender: 'System Administrator',
    timestamp: '2024-03-20T11:00:00Z',
    confirmed_by: ['2', '3'],
    expires_at: '2024-03-20T17:00:00Z'
  },
  {
    id: 'broadcast-2',
    type: 'alert',
    title: 'Road Closure',
    message: 'Main Street closed due to accident. Use alternate routes.',
    severity: 'high',
    sender: 'Sarah Johnson',
    timestamp: '2024-03-20T10:00:00Z',
    confirmed_by: ['3'],
    expires_at: '2024-03-20T14:00:00Z'
  },
  {
    id: 'broadcast-3',
    type: 'info',
    title: 'System Maintenance',
    message: 'Scheduled maintenance tonight from 11 PM to 1 AM',
    severity: 'low',
    sender: 'System Administrator',
    timestamp: '2024-03-20T07:00:00Z',
    confirmed_by: [],
    expires_at: '2024-03-21T01:00:00Z'
  }
];

export const mockEmergencyContacts = [
  {
    id: 'contact-1',
    user_id: '4',
    name: 'Maria Martinez',
    phone: '09948270032',
    relationship: 'spouse',
    is_primary: true
  },
  {
    id: 'contact-2',
    user_id: '4',
    name: 'Carlos Martinez',
    phone: '09948270033',
    relationship: 'parent',
    is_primary: false
  },
  {
    id: 'contact-3',
    user_id: '4',
    name: 'Ana Rodriguez',
    phone: '09948270034',
    relationship: 'sibling',
    is_primary: false
  }
];

export const mockLocations = [
  {
    id: 'loc-1',
    name: 'Central Hospital',
    type: 'medical',
    address: '123 Medical Center Dr',
    latitude: 14.6091,
    longitude: 121.0225,
    capacity: 500,
    current_occupancy: 320
  },
  {
    id: 'loc-2',
    name: 'Fire Station 1',
    type: 'fire',
    address: '456 Fire Station Rd',
    latitude: 14.6100,
    longitude: 121.0230,
    capacity: 50,
    current_occupancy: 25
  },
  {
    id: 'loc-3',
    name: 'Police Precinct',
    type: 'police',
    address: '789 Police Station Ave',
    latitude: 14.6110,
    longitude: 121.0240,
    capacity: 100,
    current_occupancy: 65
  },
  {
    id: 'loc-4',
    name: 'Emergency Shelter A',
    type: 'shelter',
    address: '321 Shelter Lane',
    latitude: 14.6080,
    longitude: 121.0210,
    capacity: 200,
    current_occupancy: 45
  }
];

// Mock auth functions
export const mockAuth = {
  signIn: async (email, password) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const user = mockUsers.find(u => u.email === email);
    if (user && user.is_active) {
      return { data: { user }, error: null };
    }
    return { data: null, error: { message: 'Invalid credentials' } };
  },
  signUp: async (email, password, metadata) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newUser = {
      id: Date.now().toString(),
      email,
      first_name: metadata.first_name,
      last_name: metadata.last_name,
      full_name: `${metadata.first_name} ${metadata.last_name}`,
      role: metadata.role,
      phone: metadata.phone,
      address: metadata.address,
      date_of_birth: metadata.date_of_birth,
      department: null,
      department_id: null,
      is_active: false,
      created_at: new Date().toISOString(),
      avatar: null
    };
    mockUsers.push(newUser);
    return { data: { user: newUser }, error: null };
  },
  signOut: async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return { error: null };
  },
  getSession: async () => {
    const stored = localStorage.getItem('mock_session');
    if (stored) {
      return { data: { session: JSON.parse(stored) }, error: null };
    }
    return { data: { session: null }, error: null };
  }
};

// Mock database functions
export const mockDb = {
  from: (table) => {
    let data = [];
    switch (table) {
      case 'user_profiles':
        data = mockUsers;
        break;
      case 'departments':
        data = mockDepartments;
        break;
      case 'emergency_reports':
        data = mockEmergencyReports;
        break;
      case 'emergency_contacts':
        data = mockEmergencyContacts;
        break;
      default:
        data = [];
    }
    
    return {
      select: (columns = '*') => ({
        eq: (column, value) => ({
          order: (column2, options) => ({
            single: async () => ({ data: data.find(item => item[column] === value) || null, error: null }),
            then: async (resolve) => resolve({ data: data.filter(item => item[column] === value), error: null })
          }),
          then: async (resolve) => resolve({ data: data.filter(item => item[column] === value), error: null })
        }),
        in: (column, values) => ({
          then: async (resolve) => resolve({ data: data.filter(item => values.includes(item[column])), error: null })
        }),
        order: (column, options) => ({
          then: async (resolve) => resolve({ data: [...data].sort((a, b) => options.ascending ? 1 : -1), error: null })
        }),
        then: async (resolve) => resolve({ data, error: null })
      }),
      insert: (item) => ({
        select: () => ({
          single: async () => {
            const newItem = { ...item, id: Date.now().toString(), created_at: new Date().toISOString() };
            data.push(newItem);
            return { data: newItem, error: null };
          }
        })
      }),
      update: (updates) => ({
        eq: (column, value) => ({
          then: async (resolve) => {
            const index = data.findIndex(item => item[column] === value);
            if (index !== -1) {
              data[index] = { ...data[index], ...updates };
            }
            return { error: null };
          }
        })
      }),
      delete: () => ({
        eq: (column, value) => ({
          then: async (resolve) => {
            const index = data.findIndex(item => item[column] === value);
            if (index !== -1) {
              data.splice(index, 1);
            }
            return { error: null };
          }
        })
      })
    };
  }
};
