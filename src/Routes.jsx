import React, { useEffect } from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, useNavigate } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { MockDataProvider } from "./contexts/MockDataContext";
import NotFound from "pages/NotFound";
import DepartmentManagement from './pages/department-management';
import Login from './pages/login';
import UserManagement from './pages/user-management';
import ReportManagement from './pages/report-management';
import EmergencyReport from './pages/emergency-report';
import Register from './pages/register';
import Profile from './pages/profile';
import Settings from './pages/settings';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return children;
};

const Routes = () => {
  return (
    <BrowserRouter>
      <MockDataProvider>
        <AuthProvider>
          <ErrorBoundary>
            <ScrollToTop />
            <RouterRoutes>
              {/* Define your route here */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <DepartmentManagement />
                </ProtectedRoute>
              } />
              <Route path="/department-management" element={
                <ProtectedRoute>
                  <DepartmentManagement />
                </ProtectedRoute>
              } />
              <Route path="/user-management" element={
                <ProtectedRoute>
                  <UserManagement />
                </ProtectedRoute>
              } />
              <Route path="/report-management" element={
                <ProtectedRoute>
                  <ReportManagement />
                </ProtectedRoute>
              } />
              <Route path="/emergency-report" element={
                <ProtectedRoute>
                  <EmergencyReport />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </RouterRoutes>
          </ErrorBoundary>
        </AuthProvider>
      </MockDataProvider>
    </BrowserRouter>
  );
};

export default Routes;