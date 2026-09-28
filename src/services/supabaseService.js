import { supabase } from '../lib/supabase';

// Emergency Reports Service
export const emergencyReportsService = {
  // Get all reports with optional filters
  async getReports(filters = {}) {
    let query = supabase?.from('emergency_reports')?.select(`
        *,
        reporter:user_profiles!reporter_id(*),
        assigned_responder:user_profiles!assigned_to(*),
        assigned_department:departments(*)
      `)?.order('created_at', { ascending: false });

    // Apply filters
    if (filters?.status && filters?.status !== 'all') {
      query = query?.eq('status', filters?.status);
    }
    if (filters?.priority && filters?.priority !== 'all') {
      query = query?.eq('priority', filters?.priority);
    }
    if (filters?.incidentType && filters?.incidentType !== 'all') {
      query = query?.eq('incident_type', filters?.incidentType);
    }
    if (filters?.dateFrom) {
      query = query?.gte('created_at', filters?.dateFrom);
    }
    if (filters?.dateTo) {
      query = query?.lte('created_at', filters?.dateTo);
    }

    return await query;
  },

  // Create new emergency report
  async createReport(reportData) {
    const { data, error } = await supabase?.from('emergency_reports')?.insert([reportData])?.select(`
        *,
        reporter:user_profiles!reporter_id(*),
        assigned_department:departments(*)
      `)?.single();

    return { data, error };
  },

  // Update report status
  async updateReportStatus(reportId, status, additionalData = {}) {
    const updateData = {
      status,
      updated_at: new Date()?.toISOString(),
      ...additionalData
    };

    return await supabase?.from('emergency_reports')?.update(updateData)?.eq('id', reportId)?.select()?.single();
  },

  // Assign responder to report
  async assignResponder(reportId, responderId, departmentId = null) {
    return await supabase?.from('emergency_reports')?.update({
        assigned_to: responderId,
        assigned_department_id: departmentId,
        status: 'assigned',
        updated_at: new Date()?.toISOString()
      })?.eq('id', reportId)?.select()?.single();
  },

  // Get user's reports
  async getUserReports(userId) {
    return await supabase?.from('emergency_reports')?.select(`
        *,
        assigned_responder:user_profiles!assigned_to(*),
        assigned_department:departments(*)
      `)?.eq('reporter_id', userId)?.order('created_at', { ascending: false });
  },

  // Search reports
  async searchReports(searchTerm) {
    return await supabase?.from('emergency_reports')?.select(`
        *,
        reporter:user_profiles!reporter_id(*),
        assigned_responder:user_profiles!assigned_to(*),
        assigned_department:departments(*)
      `)?.or(`report_id.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,reporter_name.ilike.%${searchTerm}%`)?.order('created_at', { ascending: false });
  }
};

export const mapReportForUi = report => ({
  id: report.report_id,
  databaseId: report.id,
  incidentType: report.incident_type,
  location: report.location,
  priority: report.priority,
  status: report.status,
  reporter: { name: report.reporter_name, phone: report.reporter_phone },
  assignedTo: report.assigned_responder ? {
    id: report.assigned_responder.id,
    name: report.assigned_responder.full_name,
    department: report.assigned_department?.name || report.assigned_responder.department?.name
  } : null,
  description: report.description,
  timestamp: new Date(report.created_at),
  coordinates: report.coordinates,
  images: report.images || [],
  declineReason: report.decline_reason
});

// User Profiles Service
export const userProfilesService = {
  // Get all user profiles
  async getProfiles(filters = {}) {
    let query = supabase?.from('user_profiles')?.select(`
        *,
        department:departments(*)
      `)?.order('created_at', { ascending: false });

    if (filters?.role && filters?.role !== 'all') {
      query = query?.eq('role', filters?.role);
    }
    if (filters?.department_id) {
      query = query?.eq('department_id', filters?.department_id);
    }

    return await query;
  },

  // Update user profile
  async updateProfile(userId, profileData) {
    return await supabase?.from('user_profiles')?.update({
        ...profileData,
        updated_at: new Date()?.toISOString()
      })?.eq('id', userId)?.select()?.single();
  },

  // Get responders by department
  async getRespondersByDepartment(departmentType = null) {
    let query = supabase?.from('user_profiles')?.select(`
        *,
        department:departments(*)
      `)?.eq('role', 'responder')?.eq('is_active', true);

    if (departmentType) {
      query = query?.eq('departments.type', departmentType);
    }

    return await query;
  }
};

// Departments Service
export const departmentsService = {
  // Get all departments
  async getDepartments() {
    return await supabase?.from('departments')?.select('*')?.eq('is_active', true)?.order('name');
  },

  // Create department
  async createDepartment(departmentData) {
    return await supabase?.from('departments')?.insert([departmentData])?.select()?.single();
  },

  // Update department
  async updateDepartment(departmentId, departmentData) {
    return await supabase?.from('departments')?.update({
        ...departmentData,
        updated_at: new Date()?.toISOString()
      })?.eq('id', departmentId)?.select()?.single();
  }
};

// Report Updates Service
export const reportUpdatesService = {
  // Get updates for a report
  async getReportUpdates(reportId) {
    return await supabase?.from('report_updates')?.select(`
        *,
        user:user_profiles(*)
      `)?.eq('report_id', reportId)?.order('created_at', { ascending: false });
  },

  // Add update to report
  async addReportUpdate(updateData) {
    return await supabase?.from('report_updates')?.insert([updateData])?.select(`
        *,
        user:user_profiles(*)
      `)?.single();
  }
};

// Emergency Contacts Service
export const emergencyContactsService = {
  // Get user's emergency contacts
  async getUserContacts(userId) {
    return await supabase?.from('emergency_contacts')?.select('*')?.eq('user_id', userId)?.order('is_primary', { ascending: false });
  },

  // Add emergency contact
  async addContact(contactData) {
    return await supabase?.from('emergency_contacts')?.insert([contactData])?.select()?.single();
  },

  // Update emergency contact
  async updateContact(contactId, contactData) {
    return await supabase?.from('emergency_contacts')?.update(contactData)?.eq('id', contactId)?.select()?.single();
  },

  // Delete emergency contact
  async deleteContact(contactId) {
    return await supabase?.from('emergency_contacts')?.delete()?.eq('id', contactId);
  }
};

// Real-time subscriptions
export const subscriptions = {
  // Subscribe to emergency reports changes
  subscribeToReports(callback) {
    return supabase?.channel('emergency_reports')?.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_reports'
        },
        callback
      )?.subscribe();
  },

  // Subscribe to report updates
  subscribeToReportUpdates(reportId, callback) {
    return supabase?.channel(`report_updates_${reportId}`)?.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'report_updates',
          filter: `report_id=eq.${reportId}`
        },
        callback
      )?.subscribe();
  },

  // Unsubscribe from channel
  unsubscribe(subscription) {
    return supabase?.removeChannel(subscription);
  }
};
