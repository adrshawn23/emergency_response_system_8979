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
import GeofenceGuard from './components/GeofenceGuard';

const geoProtected = element => <GeofenceGuard>{element}</GeofenceGuard>;

const ProtectedRoute = ({ children, roles }) => {
  const { user, profile, loading } = useAuth();
  if (loading || (user && !profile)) return <div className="min-h-screen flex items-center justify-center">Loading secure session…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(profile?.role)) return <Navigate to="/emergency-report" replace />;
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
            <Route path="/" element={protectedGeo(<ReportManagement />, ['admin','dispatcher','responder'])} />
            <Route path="/department-management" element={protectedGeo(<DepartmentManagement />, ['admin'])} />
            <Route path="/login" element={<Login />} />
            <Route path="/user-management" element={protectedGeo(<UserManagement />, ['admin'])} />
            <Route path="/report-management" element={protectedGeo(<ReportManagement />, ['admin','dispatcher','responder'])} />
            <Route path="/emergency-report" element={protectedGeo(<EmergencyReport />, ['admin','dispatcher','responder','resident'])} />
            <Route path="/geofence-settings" element={<ProtectedRoute roles={['admin']}><GeofenceSettings /></ProtectedRoute>} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<NotFound />} />
          </RouterRoutes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
