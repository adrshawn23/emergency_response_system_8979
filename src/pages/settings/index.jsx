import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';

const Settings = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { useMock, toggleMockMode } = useMockData();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Settings', path: '/settings' }
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={profile || user}
        notificationCount={3}
        onNavigate={handleNavigation}
      />
      <Sidebar 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={setIsSidebarCollapsed}
        user={profile || user}
        onNavigate={handleNavigation}
      />
      <main className={`pt-16 transition-emergency ${
        isSidebarCollapsed ? 'ml-16' : 'ml-64'
      }`}>
        <div className="p-6">
          {/* Breadcrumb */}
          <BreadcrumbNavigation 
            items={breadcrumbItems}
            onNavigate={handleNavigation}
            className="mb-6"
          />

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your application settings and preferences
            </p>
          </div>

          <div className="space-y-6">
            {/* Data Source Settings */}
            <div className="bg-card rounded-lg border border-border shadow-emergency p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground">Data Source</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose between mock data for testing or live Supabase connection
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${useMock ? 'bg-primary' : 'bg-muted-foreground'}`}>
                    <Icon name={useMock ? 'Database' : 'Cloud'} size={20} color="white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {useMock ? 'Mock Mode' : 'Live Mode'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {useMock ? 'Using local mock data' : 'Connected to Supabase'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={toggleMockMode}
                  variant={useMock ? 'default' : 'outline'}
                >
                  Switch to {useMock ? 'Live' : 'Mock'}
                </Button>
              </div>

              <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Mock Mode:</strong> Use pre-defined data for testing without database connection.<br/>
                  <strong>Live Mode:</strong> Connect to Supabase for real data persistence.
                </p>
              </div>
            </div>

            {/* Account Settings */}
            <div className="bg-card rounded-lg border border-border shadow-emergency p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground">Account</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your account settings
                </p>
              </div>

              <div className="space-y-4">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => navigate('/profile')}
                  iconName="User"
                >
                  View Profile
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => navigate('/profile')}
                  iconName="Lock"
                >
                  Change Password
                </Button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-card rounded-lg border border-destructive/50 shadow-emergency p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Irreversible and destructive actions
                </p>
              </div>

              <Button
                variant="destructive"
                fullWidth
                onClick={handleLogout}
                iconName="LogOut"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
