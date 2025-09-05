import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';

// Import components
import DepartmentCard from './components/DepartmentCard';
import CreateDepartmentModal from './components/CreateDepartmentModal';
import UserAssignmentPanel from './components/UserAssignmentPanel';
import DepartmentHierarchy from './components/DepartmentHierarchy';
import DepartmentStats from './components/DepartmentStats';
import BulkOperationsPanel from './components/BulkOperationsPanel';

const DepartmentManagement = () => {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid, list, hierarchy
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignmentPanelOpen, setIsAssignmentPanelOpen] = useState(false);
  const [selectedDepartmentForAssignment, setSelectedDepartmentForAssignment] = useState(null);
  const [draggedDepartment, setDraggedDepartment] = useState(null);

  // Mock user data
  const currentUser = {
    id: 1,
    name: "Admin User",
    email: "admin@emergency.gov",
    role: "admin"
  };

  // Mock departments data
  const [departments, setDepartments] = useState([
    {
      id: 'fire-dept',
      name: 'Fire Department',
      description: 'Emergency fire response and rescue operations',
      icon: 'Flame',
      status: 'active',
      parentDepartment: null,
      totalMembers: 45,
      activeResponders: 38,
      avgResponseTime: '4m',
      incidentsHandled: 127,
      lastUpdated: '2 hours ago',
      createdAt: '2024-01-15T10:00:00Z',
      capacity: 60,
      members: [
        { id: 1, name: 'John Smith', email: 'john.smith@fire.gov', role: 'responder', isActive: true },
        { id: 2, name: 'Sarah Johnson', email: 'sarah.johnson@fire.gov', role: 'dispatcher', isActive: true }
      ],
      recentActivity: [
        { icon: 'AlertTriangle', message: 'Responded to building fire on Main St', time: '1h ago', type: 'emergency' },
        { icon: 'UserPlus', message: 'New responder John Doe joined', time: '3h ago', type: 'user' }
      ]
    },
    {
      id: 'police-dept',
      name: 'Police Department',
      description: 'Law enforcement and public safety',
      icon: 'Shield',
      status: 'active',
      parentDepartment: null,
      totalMembers: 62,
      activeResponders: 55,
      avgResponseTime: '3m',
      incidentsHandled: 203,
      lastUpdated: '1 hour ago',
      createdAt: '2024-01-10T08:00:00Z',
      capacity: 80,
      members: [
        { id: 3, name: 'Mike Wilson', email: 'mike.wilson@police.gov', role: 'responder', isActive: true },
        { id: 4, name: 'Lisa Brown', email: 'lisa.brown@police.gov', role: 'dispatcher', isActive: false }
      ],
      recentActivity: [
        { icon: 'Car', message: 'Traffic incident on Highway 101', time: '30m ago', type: 'emergency' },
        { icon: 'Settings', message: 'Equipment maintenance completed', time: '2h ago', type: 'system' }
      ]
    },
    {
      id: 'medical-dept',
      name: 'Medical Emergency',
      description: 'Emergency medical services and ambulance dispatch',
      icon: 'Heart',
      status: 'active',
      parentDepartment: null,
      totalMembers: 38,
      activeResponders: 32,
      avgResponseTime: '5m',
      incidentsHandled: 156,
      lastUpdated: '45 minutes ago',
      createdAt: '2024-01-20T12:00:00Z',
      capacity: 50,
      members: [
        { id: 5, name: 'Dr. Emily Davis', email: 'emily.davis@medical.gov', role: 'responder', isActive: true },
        { id: 6, name: 'Tom Anderson', email: 'tom.anderson@medical.gov', role: 'dispatcher', isActive: true }
      ],
      recentActivity: [
        { icon: 'Ambulance', message: 'Medical emergency at City Park', time: '45m ago', type: 'emergency' },
        { icon: 'Users', message: 'Training session completed', time: '4h ago', type: 'system' }
      ]
    },
    {
      id: 'hazmat-dept',
      name: 'Hazmat Response',
      description: 'Hazardous materials and chemical emergency response',
      icon: 'AlertTriangle',
      status: 'maintenance',
      parentDepartment: 'fire-dept',
      totalMembers: 12,
      activeResponders: 8,
      avgResponseTime: '8m',
      incidentsHandled: 23,
      lastUpdated: '6 hours ago',
      createdAt: '2024-02-01T14:00:00Z',
      capacity: 20,
      members: [
        { id: 7, name: 'Robert Chen', email: 'robert.chen@hazmat.gov', role: 'responder', isActive: false }
      ],
      recentActivity: [
        { icon: 'Wrench', message: 'Equipment maintenance in progress', time: '6h ago', type: 'system' },
        { icon: 'AlertCircle', message: 'Chemical spill response completed', time: '1d ago', type: 'emergency' }
      ]
    }
  ]);

  // Mock available users for assignment
  const availableUsers = [
    { id: 8, name: 'Alex Rodriguez', email: 'alex.rodriguez@emergency.gov', role: 'responder' },
    { id: 9, name: 'Maria Garcia', email: 'maria.garcia@emergency.gov', role: 'dispatcher' },
    { id: 10, name: 'David Kim', email: 'david.kim@emergency.gov', role: 'responder' },
    { id: 11, name: 'Jennifer Lee', email: 'jennifer.lee@emergency.gov', role: 'admin' }
  ];

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Department Management', path: '/department-management' }
  ];

  const statusFilterOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'maintenance', label: 'Maintenance' }
  ];

  const viewModeOptions = [
    { value: 'grid', label: 'Grid View' },
    { value: 'list', label: 'List View' },
    { value: 'hierarchy', label: 'Hierarchy View' }
  ];

  // Filter departments
  const filteredDepartments = departments?.filter(dept => {
    const matchesSearch = dept?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
                         dept?.description?.toLowerCase()?.includes(searchTerm?.toLowerCase());
    const matchesStatus = statusFilter === 'all' || dept?.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle navigation
  const handleNavigation = (path) => {
    navigate(path);
  };

  // Department operations
  const handleCreateDepartment = async (departmentData) => {
    const newDepartment = {
      ...departmentData,
      id: `dept-${Date.now()}`,
      totalMembers: 0,
      activeResponders: 0,
      avgResponseTime: '0m',
      incidentsHandled: 0,
      lastUpdated: 'Just now',
      members: [],
      recentActivity: [
        { icon: 'Plus', message: 'Department created', time: 'Just now', type: 'system' }
      ]
    };
    
    setDepartments(prev => [...prev, newDepartment]);
  };

  const handleEditDepartment = (departmentId, updates) => {
    setDepartments(prev => prev?.map(dept => 
      dept?.id === departmentId 
        ? { ...dept, ...updates, lastUpdated: 'Just now' }
        : dept
    ));
  };

  const handleDeleteDepartment = (departmentId) => {
    if (window.confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
      setDepartments(prev => prev?.filter(dept => dept?.id !== departmentId));
      setSelectedDepartments(prev => prev?.filter(dept => dept?.id !== departmentId));
    }
  };

  const handleViewMembers = (departmentId) => {
    const department = departments?.find(d => d?.id === departmentId);
    setSelectedDepartmentForAssignment(department);
    setIsAssignmentPanelOpen(true);
  };

  const handleAssignUsers = (departmentId, users) => {
    setDepartments(prev => prev?.map(dept => {
      if (dept?.id === departmentId) {
        const newMembers = users?.filter(user => 
          !dept?.members?.some(member => member?.id === user?.id)
        );
        return {
          ...dept,
          members: [...dept?.members, ...newMembers?.map(user => ({ ...user, isActive: true }))],
          totalMembers: dept?.totalMembers + newMembers?.length,
          activeResponders: dept?.activeResponders + newMembers?.filter(u => u?.role === 'responder')?.length,
          lastUpdated: 'Just now'
        };
      }
      return dept;
    }));
  };

  const handleRemoveUser = (departmentId, userId) => {
    setDepartments(prev => prev?.map(dept => {
      if (dept?.id === departmentId) {
        const removedUser = dept?.members?.find(m => m?.id === userId);
        return {
          ...dept,
          members: dept?.members?.filter(m => m?.id !== userId),
          totalMembers: dept?.totalMembers - 1,
          activeResponders: removedUser?.role === 'responder' ? dept?.activeResponders - 1 : dept?.activeResponders,
          lastUpdated: 'Just now'
        };
      }
      return dept;
    }));
  };

  const handleDepartmentSelect = (department) => {
    setSelectedDepartments(prev => {
      const isSelected = prev?.some(d => d?.id === department?.id);
      if (isSelected) {
        return prev?.filter(d => d?.id !== department?.id);
      } else {
        return [...prev, department];
      }
    });
  };

  const handleBulkOperation = (operationData) => {
    console.log('Executing bulk operation:', operationData);
    // Implementation would depend on the specific operation
    setSelectedDepartments([]);
  };

  const handleExportData = () => {
    const exportData = {
      departments: filteredDepartments,
      exportDate: new Date()?.toISOString(),
      totalDepartments: departments?.length,
      activeDepartments: departments?.filter(d => d?.status === 'active')?.length
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `departments-export-${new Date()?.toISOString()?.split('T')?.[0]}.json`;
    document.body?.appendChild(a);
    a?.click();
    document.body?.removeChild(a);
    URL.revokeObjectURL(url);
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
          {/* Header Section */}
          <div className="flex flex-col space-y-4">
            <BreadcrumbNavigation 
              items={breadcrumbItems}
              onNavigate={handleNavigation}
            />
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Department Management</h1>
                <p className="text-muted-foreground">
                  Manage emergency response departments and organizational structure
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={handleExportData}
                  iconName="Download"
                  iconPosition="left"
                >
                  Export Data
                </Button>
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  iconName="Plus"
                  iconPosition="left"
                >
                  Create Department
                </Button>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <DepartmentStats departments={departments} />

          {/* Bulk Operations */}
          <BulkOperationsPanel
            selectedDepartments={selectedDepartments}
            onBulkOperation={handleBulkOperation}
            onClearSelection={() => setSelectedDepartments([])}
            availableUsers={availableUsers}
          />

          {/* Filters and Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <Input
                type="search"
                placeholder="Search departments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e?.target?.value)}
                className="w-full sm:w-64"
              />
              <Select
                options={statusFilterOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                className="w-full sm:w-40"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Select
                options={viewModeOptions}
                value={viewMode}
                onChange={setViewMode}
                className="w-40"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDepartments(filteredDepartments)}
                iconName="CheckSquare"
                disabled={filteredDepartments?.length === 0}
              >
                Select All
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="space-y-6">
            {viewMode === 'hierarchy' ? (
              <DepartmentHierarchy
                departments={filteredDepartments}
                onDepartmentSelect={handleDepartmentSelect}
                selectedDepartment={selectedDepartments?.[0]}
              />
            ) : (
              <div className={`grid gap-6 ${
                viewMode === 'grid' ?'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' :'grid-cols-1'
              }`}>
                {filteredDepartments?.map(department => (
                  <DepartmentCard
                    key={department?.id}
                    department={department}
                    onEdit={handleEditDepartment}
                    onDelete={handleDeleteDepartment}
                    onViewMembers={handleViewMembers}
                    onAssignUsers={(deptId) => {
                      const dept = departments?.find(d => d?.id === deptId);
                      setSelectedDepartmentForAssignment(dept);
                      setIsAssignmentPanelOpen(true);
                    }}
                    isDragging={draggedDepartment?.id === department?.id}
                    onDragStart={setDraggedDepartment}
                    onDragEnd={() => setDraggedDepartment(null)}
                  />
                ))}
              </div>
            )}

            {filteredDepartments?.length === 0 && (
              <div className="text-center py-12">
                <Icon name="Building" size={48} className="text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No departments found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || statusFilter !== 'all' ?'Try adjusting your search or filter criteria' :'Get started by creating your first department'
                  }
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    iconName="Plus"
                    iconPosition="left"
                  >
                    Create First Department
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      {/* Modals */}
      <CreateDepartmentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateDepartment={handleCreateDepartment}
      />
      <UserAssignmentPanel
        isOpen={isAssignmentPanelOpen}
        onClose={() => {
          setIsAssignmentPanelOpen(false);
          setSelectedDepartmentForAssignment(null);
        }}
        department={selectedDepartmentForAssignment}
        availableUsers={availableUsers}
        onAssignUsers={handleAssignUsers}
        onRemoveUser={handleRemoveUser}
      />
    </div>
  );
};

export default DepartmentManagement;