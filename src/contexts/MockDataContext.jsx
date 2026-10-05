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
    return localStorage.getItem('useMockData') === 'true';
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
