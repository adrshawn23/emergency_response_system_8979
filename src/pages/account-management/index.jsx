import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import { useAuth } from '../../contexts/AuthContext';

const AccountManagement = () => {
  const navigate = useNavigate();
  const { user: authUser, profile, signOut } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const currentUser = { id: authUser?.id, name: profile?.full_name || authUser?.email || 'User', role: profile?.role };
  
  const [activeTab, setActiveTab] = useState('profile');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangeDepartment, setShowChangeDepartment] = useState(false);
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [departments] = useState([
    { id: 'fire-dept', name: 'Fire Department' },
    { id: 'police-dept', name: 'Police Department' },
    { id: 'medical-dept', name: 'Medical Emergency' },
    { id: 'hazmat-dept', name: 'Hazmat Response' }
  ]);

  const [selectedDepartment, setSelectedDepartment] = useState('');

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Account Management', path: '/account-management' }
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    // TODO: Implement password change logic
    console.log('Password change:', passwordForm);
    setShowChangePassword(false);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleDepartmentChange = (e) => {
    e.preventDefault();
    // TODO: Implement department change logic
    console.log('Department change:', selectedDepartment);
    setShowChangeDepartment(false);
    setSelectedDepartment('');
  };

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
            <h1 className="text-3xl font-bold text-foreground">Account Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account settings and preferences
            </p>
          </div>

          {/* Tabs */}
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
                Profile
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
              {(profile?.role === 'responder' || profile?.role === 'dispatcher') && (
                <button
                  onClick={() => setActiveTab('department')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-emergency ${
                    activeTab === 'department' 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                  }`}
                >
                  Department
                </button>
              )}
            </nav>
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Profile Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
                  <Input
                    defaultValue={profile?.full_name || currentUser?.name}
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                  <Input
                    defaultValue={authUser?.email}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Phone</label>
                  <Input
                    defaultValue={profile?.phone || ''}
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Role</label>
                  <Input
                    defaultValue={profile?.role || currentUser?.role}
                    disabled
                    className="bg-muted capitalize"
                  />
                </div>
                <Button onClick={() => console.log('Save profile')}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-card rounded-lg border border-border shadow-sm p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Change Password</h2>
                {!showChangePassword ? (
                  <Button onClick={() => setShowChangePassword(true)}>
                    Change Password
                  </Button>
                ) : (
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Current Password</label>
                      <Input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        placeholder="Enter current password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">New Password</label>
                      <Input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        placeholder="Enter new password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Confirm New Password</label>
                      <Input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        placeholder="Confirm new password"
                      />
                    </div>
                    <div className="flex space-x-3">
                      <Button type="submit">Update Password</Button>
                      <Button variant="outline" onClick={() => setShowChangePassword(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              <div className="bg-card rounded-lg border border-border shadow-sm p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Account Actions</h2>
                <Button variant="destructive" onClick={handleLogout}>
                  <Icon name="LogOut" size={16} className="mr-2" />
                  Log Out
                </Button>
              </div>
            </div>
          )}

          {/* Department Tab */}
          {activeTab === 'department' && (
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Change Department</h2>
              <p className="text-muted-foreground mb-4">
                Request to change your assigned department. This will require admin approval.
              </p>
              
              {!showChangeDepartment ? (
                <Button onClick={() => setShowChangeDepartment(true)}>
                  Request Department Change
                </Button>
              ) : (
                <form onSubmit={handleDepartmentChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Current Department</label>
                    <Input
                      defaultValue={profile?.department || 'Not assigned'}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">New Department</label>
                    <select
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                      required
                    >
                      <option value="">Select a department</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Reason for Change</label>
                    <textarea
                      className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                      rows="3"
                      placeholder="Please provide a reason for this department change request"
                      required
                    />
                  </div>
                  <div className="flex space-x-3">
                    <Button type="submit">Submit Request</Button>
                    <Button variant="outline" onClick={() => setShowChangeDepartment(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AccountManagement;
