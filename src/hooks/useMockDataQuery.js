import { useMockData } from '../contexts/MockDataContext';
import { supabase } from '../lib/supabase';
import { mockUsers, mockDepartments, mockEmergencyReports, mockEmergencyContacts } from '../data/mockData';

export const useMockDataQuery = () => {
  const { useMock, mockDb } = useMockData();

  const getSupabaseOrMock = (tableName) => {
    return useMock ? mockDb.from(tableName) : supabase.from(tableName);
  };

  return {
    useMock,
    getSupabaseOrMock,
    mockUsers,
    mockDepartments,
    mockEmergencyReports,
    mockEmergencyContacts
  };
};
