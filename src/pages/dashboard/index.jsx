import React, { useState, useEffect, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import { useAuth } from '../../contexts/AuthContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user: authUser, profile } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const currentUser = { id: authUser?.id, name: profile?.full_name || authUser?.email || 'User', role: profile?.role };
  
  const [stats, setStats] = useState({
    totalReports: 0,
    pendingReports: 0,
    activeResponders: 0,
    totalUsers: 0,
    criticalIncidents: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/' }
  ];

  const handleNavigation = useCallback((path) => {
    navigate(path);
  }, [navigate]);

  useEffect(() => {
    // Mock data - replace with actual API calls
    setStats({
      totalReports: 156,
      pendingReports: 12,
      activeResponders: 45,
      totalUsers: 234,
      criticalIncidents: 3
    });

    setRecentActivity([
      { icon: 'AlertTriangle', message: 'Critical fire incident reported', time: '5m ago', type: 'emergency' },
      { icon: 'UserPlus', message: 'New responder registered', time: '15m ago', type: 'user' },
      { icon: 'CheckCircle', message: 'Medical emergency resolved', time: '30m ago', type: 'success' },
      { icon: 'Bell', message: 'System broadcast sent', time: '1h ago', type: 'system' }
    ]);
  }, []);

  const StatCard = memo(({ icon, label, value, color, trend }) => (
    <div className="bg-card rounded-lg border border-border shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 ${trend > 0 ? 'text-success' : 'text-destructive'}`}>
              {trend > 0 ? '+' : ''}{trend}% from last week
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon name={icon} size={24} className="text-white" />
        </div>
      </div>
    </div>
  ));

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={currentUser} 
        notificationCount={3}
        onNavigate={handleNavigation}
      />
      <Sidebar 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={setIsSidebarCollapsed}
        user={currentUser}
        onNavigate={handleNavigation}
      />
      <main className={`pt-16 transition-emergency ${
        isSidebarCollapsed ? 'ml-16' : 'ml-64'
      }`}>
        <div className="p-6 space-y-6">
          {/* Breadcrumb */}
          <BreadcrumbNavigation 
            items={breadcrumbItems}
            onNavigate={handleNavigation}
          />

          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {currentUser?.name}. Here's what's happening today.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard 
              icon="FileText" 
              label="Total Reports" 
              value={stats.totalReports} 
              color="bg-primary"
              trend={12}
            />
            <StatCard 
              icon="Clock" 
              label="Pending" 
              value={stats.pendingReports} 
              color="bg-warning"
              trend={-5}
            />
            <StatCard 
              icon="Users" 
              label="Active Responders" 
              value={stats.activeResponders} 
              color="bg-success"
              trend={8}
            />
            <StatCard 
              icon="UserCheck" 
              label="Total Users" 
              value={stats.totalUsers} 
              color="bg-info"
              trend={15}
            />
            <StatCard 
              icon="AlertTriangle" 
              label="Critical" 
              value={stats.criticalIncidents} 
              color="bg-destructive"
              trend={-2}
            />
          </div>

          {/* Recent Activity */}
          <div className="bg-card rounded-lg border border-border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-4 p-3 bg-muted/30 rounded-lg">
                  <div className={`p-2 rounded-lg ${
                    activity.type === 'emergency' ? 'bg-destructive/10 text-destructive' :
                    activity.type === 'success' ? 'bg-success/10 text-success' :
                    activity.type === 'user' ? 'bg-primary/10 text-primary' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    <Icon name={activity.icon} size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card rounded-lg border border-border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                onClick={() => handleNavigation('/emergency-report')}
                iconName="Plus"
                iconPosition="left"
                className="justify-start"
              >
                New Emergency Report
              </Button>
              {profile?.role === 'admin' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleNavigation('/user-management')}
                    iconName="Users"
                    iconPosition="left"
                    className="justify-start"
                  >
                    Manage Users
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleNavigation('/department-management')}
                    iconName="Building"
                    iconPosition="left"
                    className="justify-start"
                  >
                    Departments
                  </Button>
                </>
              )}
              {(profile?.role === 'admin' || profile?.role === 'dispatcher' || profile?.role === 'responder') && (
                <Button
                  variant="outline"
                  onClick={() => handleNavigation('/report-management')}
                  iconName="FileText"
                  iconPosition="left"
                  className="justify-start"
                >
                  View Reports
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => handleNavigation('/broadcasting')}
                iconName="Bell"
                iconPosition="left"
                className="justify-start"
              >
                Broadcasting
              </Button>
              <Button
                variant="outline"
                onClick={() => handleNavigation('/emergency-contacts')}
                iconName="Phone"
                iconPosition="left"
                className="justify-start"
              >
                Emergency Contacts
              </Button>
              <Button
                variant="outline"
                onClick={() => handleNavigation('/notifications')}
                iconName="BellRing"
                iconPosition="left"
                className="justify-start"
              >
                Notifications
              </Button>
              <Button
                variant="outline"
                onClick={() => handleNavigation('/account-management')}
                iconName="Settings"
                iconPosition="left"
                className="justify-start"
              >
                Account Settings
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
