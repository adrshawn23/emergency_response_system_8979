import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockAuth, mockDb, mockEmergencyReports } from '../data/mockData';

const MockDataContext = createContext();

export const useMockData = () => {
  const context = useContext(MockDataContext);
  if (!context) {
    throw new Error('useMockData must be used within a MockDataProvider');
  }
  return context;
};

export const MockDataProvider = ({ children }) => {
  const [reports, setReports] = useState([]);
  const [useMock, setUseMock] = useState(false);

  const toggleMockMode = () => {
    setUseMock(prev => !prev);
  };

  const value = {
    useMock: false, // Always false - using Supabase only
    toggleMockMode,
    mockAuth,
    mockDb,
    reports,
    setReports
  };

  return (
    <MockDataContext.Provider value={value}>
      {children}
    </MockDataContext.Provider>
  );
};
