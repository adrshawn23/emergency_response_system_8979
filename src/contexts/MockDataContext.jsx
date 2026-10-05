import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockAuth, mockDb } from '../data/mockData';

const MockDataContext = createContext();

export const useMockData = () => {
  const context = useContext(MockDataContext);
  if (!context) {
    throw new Error('useMockData must be used within a MockDataProvider');
  }
  return context;
};

export const MockDataProvider = ({ children }) => {
  const [useMock, setUseMock] = useState(() => {
    // Default to mock mode if Supabase env vars are missing
    const hasSupabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
    const hasSupabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
    const localStorageValue = localStorage.getItem('useMockData');
    
    if (localStorageValue !== null) {
      return localStorageValue === 'true';
    }
    
    // Auto-enable mock mode if Supabase credentials are missing
    return !hasSupabaseUrl || !hasSupabaseKey;
  });

  useEffect(() => {
    localStorage.setItem('useMockData', useMock);
  }, [useMock]);

  const toggleMockMode = () => {
    setUseMock(prev => !prev);
  };

  const value = {
    useMock,
    toggleMockMode,
    mockAuth,
    mockDb
  };

  return (
    <MockDataContext.Provider value={value}>
      {children}
    </MockDataContext.Provider>
  );
};
