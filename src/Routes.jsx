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

const SuspendedScreen = () => {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-900/5">
        <h1 className="text-lg font-bold text-slate-900">Account suspended</h1>
        <p className="mt-2 text-sm text-slate-500">Your access has been suspended by an administrator. Contact the barangay office if you believe this is a mistake.</p>
        <button onClick={signOut} className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">Sign out</button>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, profile, loading } = useAuth();
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

  if (profile?.account_status === 'suspended') {
    return <SuspendedScreen />;
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
                  <RoleRoute roles={['admin']}><Dashboard section="settings" /></RoleRoute>
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
