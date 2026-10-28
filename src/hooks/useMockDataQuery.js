import { supabase } from '../lib/supabase';

// Historical name kept so legacy imports don't break — this always queries
// Supabase; there is no mock data source.
export const useMockDataQuery = () => {
  const getSupabaseOrMock = (tableName) => supabase.from(tableName);

  return {
    useMock: false,
    getSupabaseOrMock,
    mockUsers: [],
    mockDepartments: [],
    mockEmergencyReports: [],
    mockEmergencyContacts: []
  };
};
