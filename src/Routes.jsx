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
import ForgotPassword from './pages/forgot-password';
import ResetPassword from './pages/reset-password';
import Profile from './pages/profile';
import Settings from './pages/settings';
import NotificationsPage from './pages/notifications';
import Dashboard from './pages/dashboard';

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

const RoleRoute = ({ roles, children }) => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only bounce once a role is actually known — a transient role-less
    // profile (e.g. mid-refetch after navigation) must not redirect.
    if (profile?.role && !roles.includes(profile.role)) navigate('/', { replace: true });
  }, [profile, roles, navigate]);

  if (loading || !profile?.role) return <div className="flex items-center justify-center min-h-screen">Loading permissions...</div>;

  return roles.includes(profile.role) ? children : null;
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
              <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/department-management" element={
                <ProtectedRoute>
                  <RoleRoute roles={['admin']}><Dashboard section="departments" /></RoleRoute>
                </ProtectedRoute>
              } />
              <Route path="/user-management" element={
                <ProtectedRoute>
                  <RoleRoute roles={['admin']}><Dashboard section="residents" /></RoleRoute>
                </ProtectedRoute>
              } />
              <Route path="/report-management" element={
                <ProtectedRoute>
                  <RoleRoute roles={['dispatcher', 'responder', 'admin']}><Dashboard section="queue" /></RoleRoute>
                </ProtectedRoute>
              } />
              <Route path="/emergency-report" element={
                <ProtectedRoute>
                  <RoleRoute roles={['resident', 'dispatcher', 'responder', 'admin']}><Dashboard section="new" /></RoleRoute>
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Dashboard section="profile" />
                </ProtectedRoute>
              } />
              <Route path="/notifications" element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <RoleRoute roles={['admin', 'dispatcher', 'responder', 'resident']}><Dashboard section="settings" /></RoleRoute>
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
