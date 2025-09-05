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

const UserManagement = () => {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [userModal, setUserModal] = useState({ isOpen: false, user: null, mode: 'view' });

  // Mock current user (admin)
  const currentUser = {
    id: 1,
    name: "Sarah Johnson",
    email: "sarah.johnson@emergency.gov",
    role: "admin",
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150"
  };

  // Mock users data
  const [users, setUsers] = useState([
    {
      id: 1,
      name: "Michael Rodriguez",
      email: "michael.rodriguez@fire.gov",
      phone: "+1 (555) 123-4567",
      role: "responder",
      department: "Fire Department",
      status: "active",
      registrationDate: "2024-01-15",
      lastActive: "2025-01-05T10:30:00Z",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
      isOnline: true,
      address: "123 Main St, Springfield",
      emergencyContact: "Maria Rodriguez",
      emergencyPhone: "+1 (555) 987-6543"
    },
    {
      id: 2,
      name: "Jennifer Chen",
      email: "jennifer.chen@police.gov",
      phone: "+1 (555) 234-5678",
      role: "dispatcher",
      department: "Police Department",
      status: "active",
      registrationDate: "2024-02-20",
      lastActive: "2025-01-05T09:15:00Z",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
      isOnline: true,
      address: "456 Oak Ave, Springfield",
      emergencyContact: "David Chen",
      emergencyPhone: "+1 (555) 876-5432"
    },
    {
      id: 3,
      name: "Robert Thompson",
      email: "robert.thompson@medical.gov",
      phone: "+1 (555) 345-6789",
      role: "responder",
      department: "Medical Services",
      status: "inactive",
      registrationDate: "2024-03-10",
      lastActive: "2025-01-03T14:20:00Z",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
      isOnline: false,
      address: "789 Pine St, Springfield",
      emergencyContact: "Lisa Thompson",
      emergencyPhone: "+1 (555) 765-4321"
    },
    {
      id: 4,
      name: "Emily Davis",
      email: "emily.davis@resident.com",
      phone: "+1 (555) 456-7890",
      role: "resident",
      department: "N/A",
      status: "active",
      registrationDate: "2024-04-05",
      lastActive: "2025-01-04T16:45:00Z",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
      isOnline: false,
      address: "321 Elm St, Springfield",
      emergencyContact: "John Davis",
      emergencyPhone: "+1 (555) 654-3210"
    },
    {
      id: 5,
      name: "James Wilson",
      email: "james.wilson@admin.gov",
      phone: "+1 (555) 567-8901",
      role: "admin",
      department: "Administration",
      status: "active",
      registrationDate: "2024-01-01",
      lastActive: "2025-01-05T11:00:00Z",
      avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150",
      isOnline: true,
      address: "654 Maple Dr, Springfield",
      emergencyContact: "Susan Wilson",
      emergencyPhone: "+1 (555) 543-2109"
    }
  ]);

  // Mock pending registrations
  const [pendingUsers, setPendingUsers] = useState([
    {
      id: 101,
      name: "Alex Martinez",
      email: "alex.martinez@gmail.com",
      phone: "+1 (555) 678-9012",
      requestedRole: "responder",
      requestedDepartment: "Fire Department",
      applicationDate: "2025-01-03T08:30:00Z",
      avatar: "https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?w=150",
      address: "987 Cedar Ln, Springfield",
      message: "I have 5 years of experience as a volunteer firefighter and would like to join the emergency response team.",
      idDocuments: [
        { name: "Driver\'s License", url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=300" },
        { name: "Fire Safety Certificate", url: "https://images.unsplash.com/photo-1554224154-26032fced8bd?w=300" }
      ]
    },
    {
      id: 102,
      name: "Lisa Park",
      email: "lisa.park@yahoo.com",
      phone: "+1 (555) 789-0123",
      requestedRole: "dispatcher",
      requestedDepartment: "Police Department",
      applicationDate: "2025-01-02T14:15:00Z",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
      address: "147 Birch St, Springfield",
      message: "Former 911 operator with 3 years of experience. Looking to contribute to emergency response coordination.",
      idDocuments: [
        { name: "State ID", url: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=300" }
      ]
    }
  ]);

  // Filter users based on search and filters
  const filteredUsers = users?.filter(user => {
    const matchesSearch = user?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
                         user?.email?.toLowerCase()?.includes(searchTerm?.toLowerCase());
    const matchesRole = !selectedRole || user?.role === selectedRole;
    const matchesDepartment = !selectedDepartment || user?.department?.toLowerCase()?.includes(selectedDepartment?.toLowerCase());
    const matchesStatus = !selectedStatus || user?.status === selectedStatus;
    
    return matchesSearch && matchesRole && matchesDepartment && matchesStatus;
  });

  // Calculate stats
  const stats = {
    totalUsers: users?.length,
    activeUsers: users?.filter(u => u?.status === 'active')?.length,
    pendingApprovals: pendingUsers?.length,
    onlineUsers: users?.filter(u => u?.isOnline)?.length
  };

  // Department distribution data
  const departmentData = [
    { name: 'Fire Department', value: users?.filter(u => u?.department === 'Fire Department')?.length, color: '#EF4444' },
    { name: 'Police Department', value: users?.filter(u => u?.department === 'Police Department')?.length, color: '#3B82F6' },
    { name: 'Medical Services', value: users?.filter(u => u?.department === 'Medical Services')?.length, color: '#10B981' },
    { name: 'Administration', value: users?.filter(u => u?.department === 'Administration')?.length, color: '#F59E0B' }
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

  const handleDeleteUser = (user) => {
    if (window.confirm(`Are you sure you want to delete ${user?.name}?`)) {
      setUsers(prev => prev?.filter(u => u?.id !== user?.id));
    }
  };

  const handleToggleUserStatus = (user) => {
    const newStatus = user?.status === 'active' ? 'inactive' : 'active';
    setUsers(prev => prev?.map(u => 
      u?.id === user?.id ? { ...u, status: newStatus } : u
    ));
  };

  const handleCreateUser = () => {
    setUserModal({ isOpen: true, user: null, mode: 'create' });
  };

  const handleSaveUser = (userData) => {
    if (userModal?.mode === 'create') {
      const newUser = {
        ...userData,
        id: Math.max(...users?.map(u => u?.id)) + 1,
        registrationDate: new Date()?.toISOString()?.split('T')?.[0],
        lastActive: new Date()?.toISOString(),
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
        isOnline: false
      };
      setUsers(prev => [...prev, newUser]);
    } else if (userModal?.mode === 'edit') {
      setUsers(prev => prev?.map(u => 
        u?.id === userModal?.user?.id ? { ...u, ...userData } : u
      ));
    }
  };

  const handleApproveUser = (userId) => {
    const pendingUser = pendingUsers?.find(u => u?.id === userId);
    if (pendingUser) {
      const newUser = {
        id: Math.max(...users?.map(u => u?.id)) + 1,
        name: pendingUser?.name,
        email: pendingUser?.email,
        phone: pendingUser?.phone,
        role: pendingUser?.requestedRole,
        department: pendingUser?.requestedDepartment,
        status: 'active',
        registrationDate: new Date()?.toISOString()?.split('T')?.[0],
        lastActive: new Date()?.toISOString(),
        avatar: pendingUser?.avatar,
        isOnline: false,
        address: pendingUser?.address,
        emergencyContact: '',
        emergencyPhone: ''
      };
      
      setUsers(prev => [...prev, newUser]);
      setPendingUsers(prev => prev?.filter(u => u?.id !== userId));
    }
  };

  const handleRejectUser = (userId, reason) => {
    setPendingUsers(prev => prev?.filter(u => u?.id !== userId));
    // In a real app, you would send a rejection email with the reason
    console.log(`User ${userId} rejected with reason: ${reason}`);
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