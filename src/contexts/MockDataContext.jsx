import React, { createContext, useContext, useState } from 'react';

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

  return (
    <MockDataContext.Provider value={{ reports, setReports }}>
      {children}
    </MockDataContext.Provider>
  );
};
