import { useState, useEffect } from 'react';
import { 
  emergencyReportsService, 
  userProfilesService, 
  departmentsService,
  subscriptions 
} from '../services/supabaseService';

// Hook for emergency reports
export const useEmergencyReports = (filters = {}) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const { data, error } = await emergencyReportsService?.getReports(filters);
        
        if (error) throw error;
        
        setReports(data || []);
      } catch (err) {
        setError(err?.message);
        console.error('Error fetching reports:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();

    // Subscribe to real-time updates
    const subscription = subscriptions?.subscribeToReports((payload) => {
      console.log('Real-time update:', payload);
      // Refetch data when changes occur
      fetchReports();
    });

    return () => {
      subscriptions?.unsubscribe(subscription);
    };
  }, [JSON.stringify(filters)]);

  const createReport = async (reportData) => {
    try {
      const { data, error } = await emergencyReportsService?.createReport(reportData);
      if (error) throw error;
      
      // Optimistically update local state
      setReports(prev => [data, ...prev]);
      return { data, error: null };
    } catch (err) {
      console.error('Error creating report:', err);
      return { data: null, error: err?.message };
    }
  };

  const updateReport = async (reportId, updateData) => {
    try {
      const { data, error } = await emergencyReportsService?.updateReportStatus(reportId, updateData?.status, updateData);
      if (error) throw error;
      
      // Update local state
      setReports(prev => prev?.map(report => 
        report?.id === reportId ? { ...report, ...data } : report
      ));
      
      return { data, error: null };
    } catch (err) {
      console.error('Error updating report:', err);
      return { data: null, error: err?.message };
    }
  };

  return {
    reports,
    loading,
    error,
    createReport,
    updateReport,
    refetch: () => {
      setLoading(true);
      // Will trigger useEffect
    }
  };
};

// Hook for user profiles
export const useUserProfiles = (filters = {}) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        setLoading(true);
        const { data, error } = await userProfilesService?.getProfiles(filters);
        
        if (error) throw error;
        
        setProfiles(data || []);
      } catch (err) {
        setError(err?.message);
        console.error('Error fetching profiles:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [JSON.stringify(filters)]);

  const updateProfile = async (userId, profileData) => {
    try {
      const { data, error } = await userProfilesService?.updateProfile(userId, profileData);
      if (error) throw error;
      
      // Update local state
      setProfiles(prev => prev?.map(profile => 
        profile?.id === userId ? { ...profile, ...data } : profile
      ));
      
      return { data, error: null };
    } catch (err) {
      console.error('Error updating profile:', err);
      return { data: null, error: err?.message };
    }
  };

  return {
    profiles,
    loading,
    error,
    updateProfile
  };
};

// Hook for departments
export const useDepartments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoading(true);
        const { data, error } = await departmentsService?.getDepartments();
        
        if (error) throw error;
        
        setDepartments(data || []);
      } catch (err) {
        setError(err?.message);
        console.error('Error fetching departments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDepartments();
  }, []);

  return {
    departments,
    loading,
    error
  };
};

// Hook for responders
export const useResponders = (departmentType = null) => {
  const [responders, setResponders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResponders = async () => {
      try {
        setLoading(true);
        const { data, error } = await userProfilesService?.getRespondersByDepartment(departmentType);
        
        if (error) throw error;
        
        setResponders(data || []);
      } catch (err) {
        setError(err?.message);
        console.error('Error fetching responders:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchResponders();
  }, [departmentType]);

  return {
    responders,
    loading,
    error
  };
};

// Hook for current user data
export const useCurrentUser = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        setLoading(true);
        const { data, error } = await userProfilesService?.getCurrentUserProfile?.();
        
        if (error) throw error;
        
        setUserProfile(data);
      } catch (err) {
        setError(err?.message);
        console.error('Error fetching current user:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  return {
    userProfile,
    loading,
    error
  };
};