import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import NotFound from "pages/NotFound";
import DepartmentManagement from './pages/department-management';
import Login from './pages/login';
import UserManagement from './pages/user-management';
import ReportManagement from './pages/report-management';
import EmergencyReport from './pages/emergency-report';
import Register from './pages/register';
import GeofenceSettings from './pages/geofence-settings';
import Dashboard from './pages/dashboard';
import Broadcasting from './pages/broadcasting';
import EmergencyContacts from './pages/emergency-contacts';
import Notifications from './pages/notifications';
import AccountManagement from './pages/account-management';
import GeofenceGuard from './components/GeofenceGuard';
import ForgotPassword from './pages/forgot-password';
import ResetPassword from './pages/reset-password';

const geoProtected = element => <GeofenceGuard>{element}</GeofenceGuard>;

const ProtectedRoute = ({ children, roles }) => {
  const { user, profile, loading } = useAuth();
  if (loading || (user && !profile)) return <div className="min-h-screen flex items-center justify-center">Loading secure session…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(profile?.role)) return <Navigate to="/dashboard" replace />;
  if (profile?.is_active === false) return <Navigate to="/login" replace />;
  return children;
};

const protectedGeo = (element, roles) => <ProtectedRoute roles={roles}><GeofenceGuard>{element}</GeofenceGuard></ProtectedRoute>;

const Routes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <ScrollToTop />
          <RouterRoutes>
            {/* Define your route here */}
            <Route path="/" element={protectedGeo(<Dashboard />, ['admin','dispatcher','responder','resident'])} />
            <Route path="/dashboard" element={protectedGeo(<Dashboard />, ['admin','dispatcher','responder','resident'])} />
            <Route path="/department-management" element={protectedGeo(<DepartmentManagement />, ['admin'])} />
            <Route path="/login" element={<Login />} />
            <Route path="/user-management" element={protectedGeo(<UserManagement />, ['admin'])} />
            <Route path="/report-management" element={protectedGeo(<ReportManagement />, ['admin','dispatcher','responder'])} />
            <Route path="/emergency-report" element={protectedGeo(<EmergencyReport />, ['admin','dispatcher','responder','resident'])} />
            <Route path="/broadcasting" element={protectedGeo(<Broadcasting />, ['admin','dispatcher','responder','resident'])} />
            <Route path="/emergency-contacts" element={protectedGeo(<EmergencyContacts />, ['admin','dispatcher','responder','resident'])} />
            <Route path="/notifications" element={protectedGeo(<Notifications />, ['admin','dispatcher','responder','resident'])} />
            <Route path="/account-management" element={protectedGeo(<AccountManagement />, ['admin','dispatcher','responder','resident'])} />
            <Route path="/geofence-settings" element={<ProtectedRoute roles={['admin']}><GeofenceSettings /></ProtectedRoute>} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </RouterRoutes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
