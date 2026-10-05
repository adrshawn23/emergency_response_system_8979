import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { MockDataProvider } from "./contexts/MockDataContext";
import NotFound from "pages/NotFound";
import DepartmentManagement from './pages/department-management';
import Login from './pages/login';
import UserManagement from './pages/user-management';
import ReportManagement from './pages/report-management';
import EmergencyReport from './pages/emergency-report';
import Register from './pages/register';

const Routes = () => {
  return (
    <BrowserRouter>
      <MockDataProvider>
        <AuthProvider>
          <ErrorBoundary>
            <ScrollToTop />
            <RouterRoutes>
              {/* Define your route here */}
              <Route path="/" element={<DepartmentManagement />} />
              <Route path="/department-management" element={<DepartmentManagement />} />
              <Route path="/login" element={<Login />} />
              <Route path="/user-management" element={<UserManagement />} />
              <Route path="/report-management" element={<ReportManagement />} />
              <Route path="/emergency-report" element={<EmergencyReport />} />
              <Route path="/register" element={<Register />} />
              <Route path="*" element={<NotFound />} />
            </RouterRoutes>
          </ErrorBoundary>
        </AuthProvider>
      </MockDataProvider>
    </BrowserRouter>
  );
};

export default Routes;