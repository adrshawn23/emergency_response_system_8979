import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import UserTable from './components/UserTable';
import PendingRegistrations from './components/PendingRegistrations';
import UserStatsCards from './components/UserStatsCards';
import UserModal from './components/UserModal';
import DepartmentDistribution from './components/DepartmentDistribution';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import { supabase } from '../../lib/supabase';
import { mockUsers, mockDepartments } from '../../data/mockData';

const UserManagement = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { useMock } = useMockData();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [userModal, setUserModal] = useState({ isOpen: false, user: null, mode: 'view' });
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        if (useMock) {
          // Use mock data
          const activeUsers = mockUsers.filter(u => u.is_active);
          const pendingUsersData = mockUsers.filter(u => !u.is_active);
          setUsers(activeUsers);
          setPendingUsers(pendingUsersData);
        } else {
          // Use Supabase
          const { data: activeUsers, error: activeError } = await supabase
            .from('user_profiles')
            .select('*, department:departments(*)')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
          
          if (activeError) throw activeError;

          const { data: pendingUsersData, error: pendingError } = await supabase
            .from('user_profiles')
            .select('*, department:departments(*)')
            .eq('is_active', false)
            .order('created_at', { ascending: false });
          
          if (pendingError) throw pendingError;

          setUsers(activeUsers || []);
          setPendingUsers(pendingUsersData || []);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [useMock]);

  const filteredUsers = users?.filter(user => {
    const matchesSearch = user?.first_name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
                         user?.last_name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
                         user?.email?.toLowerCase()?.includes(searchTerm?.toLowerCase());
    const matchesRole = !selectedRole || user?.role === selectedRole;
    const matchesDepartment = !selectedDepartment || user?.department?.name?.toLowerCase()?.includes(selectedDepartment?.toLowerCase());
    const matchesStatus = !selectedStatus || user?.is_active === (selectedStatus === 'active');
    
    return matchesSearch && matchesRole && matchesDepartment && matchesStatus;
  });

  const stats = {
    totalUsers: users?.length,
    activeUsers: users?.filter(u => u?.is_active)?.length,
    pendingApprovals: pendingUsers?.length,
    onlineUsers: 0
  };

  const departmentData = [
    { name: 'Fire Department', value: users?.filter(u => u?.department?.name === 'Fire Department')?.length, color: '#EF4444' },
    { name: 'Police Department', value: users?.filter(u => u?.department?.name === 'Police Department')?.length, color: '#3B82F6' },
    { name: 'Medical Services', value: users?.filter(u => u?.department?.name === 'Medical Services')?.length, color: '#10B981' },
    { name: 'Administration', value: users?.filter(u => u?.department?.name === 'Administration')?.length, color: '#F59E0B' }
  ];

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'User Management', path: '/user-management' }
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleEditUser = (user) => {
    setUserModal({ isOpen: true, user, mode: 'edit' });
  };

  const handleViewProfile = (user) => {
    setUserModal({ isOpen: true, user, mode: 'view' });
  };

  const handleDeleteUser = async (user) => {
    if (window.confirm(`Are you sure you want to delete ${user?.first_name} ${user?.last_name}?`)) {
      try {
        if (useMock) {
          // Mock mode: remove from local state
          setUsers(prev => prev?.filter(u => u?.id !== user?.id));
        } else {
          // Supabase mode
          const { error } = await supabase
            .from('user_profiles')
            .delete()
            .eq('id', user.id);
          
          if (error) throw error;
          setUsers(prev => prev?.filter(u => u?.id !== user?.id));
        }
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const handleToggleUserStatus = async (user) => {
    try {
      const newStatus = !user?.is_active;
      if (useMock) {
        // Mock mode: update local state
        setUsers(prev => prev?.map(u => 
          u?.id === user?.id ? { ...u, is_active: newStatus } : u
        ));
      } else {
        // Supabase mode
        const { error } = await supabase
          .from('user_profiles')
          .update({ is_active: newStatus })
          .eq('id', user.id);
        
        if (error) throw error;
        setUsers(prev => prev?.map(u => 
          u?.id === user?.id ? { ...u, is_active: newStatus } : u
        ));
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  const handleCreateUser = () => {
    setUserModal({ isOpen: true, user: null, mode: 'create' });
  };

  const handleSaveUser = async (userData) => {
    try {
      if (userModal?.mode === 'create') {
        const { data, error } = await supabase
          .from('user_profiles')
          .insert(userData)
          .select()
          .single();
        
        if (error) throw error;
        setUsers(prev => [...prev, data]);
      } else if (userModal?.mode === 'edit') {
        const { error } = await supabase
          .from('user_profiles')
          .update(userData)
          .eq('id', userModal?.user?.id);
        
        if (error) throw error;
        setUsers(prev => prev?.map(u => 
          u?.id === userModal?.user?.id ? { ...u, ...userData } : u
        ));
      }
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

  const handleApproveUser = async (userId) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: true })
        .eq('id', userId);
      
      if (error) throw error;
      
      const approvedUser = pendingUsers?.find(u => u?.id === userId);
      if (approvedUser) {
        setUsers(prev => [...prev, { ...approvedUser, is_active: true }]);
        setPendingUsers(prev => prev?.filter(u => u?.id !== userId));
      }
    } catch (error) {
      console.error('Error approving user:', error);
    }
  };

  const handleRejectUser = async (userId, reason) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      setPendingUsers(prev => prev?.filter(u => u?.id !== userId));
    } catch (error) {
      console.error('Error rejecting user:', error);
    }
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
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">User Management</h1>
              <p className="text-muted-foreground mt-1">
                Manage user accounts, registrations, and system access control
              </p>
            </div>
            
            <div className="flex items-center space-x-3 mt-4 lg:mt-0">
              <Button variant="outline" iconName="Download">
                Export Users
              </Button>
              <Button onClick={handleCreateUser} iconName="UserPlus">
                Add New User
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <UserStatsCards stats={stats} />

          {/* Tab Navigation */}
          <div className="mt-8 mb-6">
            <div className="border-b border-border">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('users')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-emergency ${
                    activeTab === 'users' ?'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon name="Users" size={16} />
                    <span>All Users ({users?.length})</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-emergency ${
                    activeTab === 'pending' ?'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon name="Clock" size={16} />
                    <span>Pending Approvals ({pendingUsers?.length})</span>
                    {pendingUsers?.length > 0 && (
                      <span className="bg-warning text-warning-foreground text-xs px-2 py-1 rounded-full">
                        {pendingUsers?.length}
                      </span>
                    )}
                  </div>
                </button>
                
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-emergency ${
                    activeTab === 'analytics' ?'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon name="BarChart3" size={16} />
                    <span>Analytics</span>
                  </div>
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'users' && (
            <UserTable
              users={filteredUsers}
              onEditUser={handleEditUser}
              onDeleteUser={handleDeleteUser}
              onToggleUserStatus={handleToggleUserStatus}
              onViewProfile={handleViewProfile}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedRole={selectedRole}
              onRoleChange={setSelectedRole}
              selectedDepartment={selectedDepartment}
              onDepartmentChange={setSelectedDepartment}
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
            />
          )}

          {activeTab === 'pending' && (
            <PendingRegistrations
              pendingUsers={pendingUsers}
              onApproveUser={handleApproveUser}
              onRejectUser={handleRejectUser}
            />
          )}

          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DepartmentDistribution departmentData={departmentData} />
              
              <div className="bg-card rounded-lg border border-border shadow-emergency p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                    <Icon name="UserPlus" size={16} className="text-success" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">New user registered</p>
                      <p className="text-xs text-muted-foreground">Alex Martinez applied for responder role</p>
                    </div>
                    <span className="text-xs text-muted-foreground">2h ago</span>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                    <Icon name="UserCheck" size={16} className="text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">User status updated</p>
                      <p className="text-xs text-muted-foreground">Jennifer Chen activated</p>
                    </div>
                    <span className="text-xs text-muted-foreground">4h ago</span>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                    <Icon name="Settings" size={16} className="text-warning" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Role changed</p>
                      <p className="text-xs text-muted-foreground">Robert Thompson promoted to supervisor</p>
                    </div>
                    <span className="text-xs text-muted-foreground">1d ago</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      {/* User Modal */}
      <UserModal
        isOpen={userModal?.isOpen}
        onClose={() => setUserModal({ isOpen: false, user: null, mode: 'view' })}
        user={userModal?.user}
        mode={userModal?.mode}
        onSave={handleSaveUser}
      />
    </div>
  );
};

export default UserManagement;