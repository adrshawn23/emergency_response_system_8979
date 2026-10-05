import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import { mockUsers } from '../../data/mockData';

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { useMock } = useMockData();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Profile', path: '/profile' }
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordErrors({});
    setPasswordSuccess('');
    setIsSubmitting(true);

    // Validation
    const errors = {};
    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    if (!passwordForm.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters';
    }
    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password';
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      setIsSubmitting(false);
      return;
    }

    try {
      if (useMock) {
        // Mock mode: verify current password and update
        const mockUser = mockUsers.find(u => u.id === user.id);
        if (mockUser && passwordForm.currentPassword === 'admin123') {
          // In mock mode, we just simulate success
          setPasswordSuccess('Password changed successfully!');
          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
          setShowPasswordForm(false);
          setTimeout(() => setPasswordSuccess(''), 3000);
        } else {
          setPasswordErrors({ currentPassword: 'Current password is incorrect' });
        }
      } else {
        // Supabase mode: would implement actual password change
        // For now, simulate success
        setPasswordSuccess('Password changed successfully!');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordForm(false);
        setTimeout(() => setPasswordSuccess(''), 3000);
      }
    } catch (error) {
      setPasswordErrors({ currentPassword: 'Failed to change password. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
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
            <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account settings and preferences
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6">
            <div className="border-b border-border">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-emergency ${
                    activeTab === 'profile' 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                  }`}
                >
                  Profile Information
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-emergency ${
                    activeTab === 'security' 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                  }`}
                >
                  Security
                </button>
              </nav>
            </div>
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="bg-card rounded-lg border border-border shadow-emergency p-6">
              <div className="flex items-start space-x-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-3xl font-semibold text-white">
                      {profile?.first_name?.charAt(0) || user?.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                </div>

                {/* Profile Details */}
                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {profile?.full_name || user?.name || 'User'}
                    </h2>
                    <p className="text-muted-foreground capitalize">
                      {profile?.role || user?.role || 'User'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <p className="text-foreground">{profile?.email || user?.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Phone</label>
                      <p className="text-foreground">{profile?.phone || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Department</label>
                      <p className="text-foreground">
                        {profile?.department?.name || 'Not assigned'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <p className="text-success">
                        {profile?.is_active !== false ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Button variant="outline" onClick={() => setActiveTab('security')}>
                      Change Password
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Change Password */}
              <div className="bg-card rounded-lg border border-border shadow-emergency p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground">Change Password</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Update your password to keep your account secure
                  </p>
                </div>

                {passwordSuccess && (
                  <div className="mb-4 p-3 bg-success/10 border border-success rounded-lg">
                    <p className="text-sm text-success">{passwordSuccess}</p>
                  </div>
                )}

                {!showPasswordForm ? (
                  <Button onClick={() => setShowPasswordForm(true)}>
                    Change Password
                  </Button>
                ) : (
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <Input
                      label="Current Password"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                      error={passwordErrors.currentPassword}
                      required
                    />
                    <Input
                      label="New Password"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                      error={passwordErrors.newPassword}
                      required
                    />
                    <Input
                      label="Confirm New Password"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                      error={passwordErrors.confirmPassword}
                      required
                    />
                    <div className="flex space-x-3">
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Changing...' : 'Change Password'}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setShowPasswordForm(false);
                          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                          setPasswordErrors({});
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {/* Logout */}
              <div className="bg-card rounded-lg border border-border shadow-emergency p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Logout</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sign out of your account on this device
                  </p>
                </div>
                <Button variant="destructive" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Profile;
