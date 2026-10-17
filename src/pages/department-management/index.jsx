import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import { supabase } from '../../lib/supabase';

// Import components
import DepartmentCard from './components/DepartmentCard';
import CreateDepartmentModal from './components/CreateDepartmentModal';
import UserAssignmentPanel from './components/UserAssignmentPanel';
import DepartmentHierarchy from './components/DepartmentHierarchy';
import DepartmentStats from './components/DepartmentStats';
import BulkOperationsPanel from './components/BulkOperationsPanel';

const DepartmentManagement = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { useMock } = useMockData();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignmentPanelOpen, setIsAssignmentPanelOpen] = useState(false);
  const [selectedDepartmentForAssignment, setSelectedDepartmentForAssignment] = useState(null);
  const [draggedDepartment, setDraggedDepartment] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (useMock) {
          // Use mock data
          setDepartments(mockDepartments);
          const activeUsers = mockUsers.filter(u => u.is_active);
          setAvailableUsers(activeUsers);
        } else {
          // Use Supabase - fetch departments with member counts
          const { data: deptData, error: deptError } = await supabase
            .from('departments')
            .select('*, user_profiles(count)')
            .order('created_at', { ascending: false });
          
          if (deptError) throw deptError;
          
          // Transform data to include member counts
          const departmentsWithCounts = (deptData || []).map(dept => ({
            ...dept,
            totalMembers: dept.user_profiles?.[0]?.count || 0,
            status: dept.is_active ? 'active' : 'inactive'
          }));
          setDepartments(departmentsWithCounts);

          const { data: userData, error: userError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('is_active', true);
          
          if (userError) throw userError;
          setAvailableUsers(userData || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        console.error('Error details:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [useMock]);

  const filteredDepartments = departments?.filter(dept => {
    const matchesSearch = dept?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
                         dept?.description?.toLowerCase()?.includes(searchTerm?.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && dept?.is_active) ||
                         (statusFilter === 'inactive' && !dept?.is_active);
    return matchesSearch && matchesStatus;
  });

  // Handle navigation
  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleCreateDepartment = async (departmentData) => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .insert({
          name: departmentData.name,
          type: departmentData.type,
          description: departmentData.description,
          contact_email: departmentData.contact_email,
          contact_phone: departmentData.contact_phone,
          address: departmentData.address,
          is_active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      const newDept = {
        ...data,
        totalMembers: 0,
        status: 'active'
      };
      setDepartments(prev => [...prev, newDept]);
    } catch (error) {
      console.error('Error creating department:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      throw error;
    }
  };

  const handleEditDepartment = async (departmentId, updates) => {
    try {
      const updateData = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.contact_email !== undefined) updateData.contact_email = updates.contact_email;
      if (updates.contact_phone !== undefined) updateData.contact_phone = updates.contact_phone;
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

      const { error } = await supabase
        .from('departments')
        .update(updateData)
        .eq('id', departmentId);
      
      if (error) throw error;
      setDepartments(prev => prev?.map(dept => 
        dept?.id === departmentId 
          ? { 
              ...dept, 
              ...updateData,
              status: updateData.is_active !== undefined ? (updateData.is_active ? 'active' : 'inactive') : dept.status
            }
          : dept
      ));
    } catch (error) {
      console.error('Error updating department:', error);
      throw error;
    }
  };

  const handleDeleteDepartment = async (departmentId) => {
    if (window.confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
      try {
        const { error } = await supabase
          .from('departments')
          .delete()
          .eq('id', departmentId);
        
        if (error) throw error;
        setDepartments(prev => prev?.filter(dept => dept?.id !== departmentId));
        setSelectedDepartments(prev => prev?.filter(dept => dept?.id !== departmentId));
      } catch (error) {
        console.error('Error deleting department:', error);
        throw error;
      }
    }
  };

  const handleViewMembers = (departmentId) => {
    const department = departments?.find(d => d?.id === departmentId);
    setSelectedDepartmentForAssignment(department);
    setIsAssignmentPanelOpen(true);
  };

  const handleAssignUsers = async (departmentId, users) => {
    try {
      for (const user of users) {
        const { error } = await supabase
          .from('user_profiles')
          .update({ department_id: departmentId })
          .eq('id', user.id);
        
        if (error) throw error;
      }
      
      // Refresh departments to get updated member counts
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*, user_profiles(count)')
        .order('created_at', { ascending: false });
      
      if (deptError) throw deptError;
      
      const departmentsWithCounts = (deptData || []).map(dept => ({
        ...dept,
        totalMembers: dept.user_profiles?.[0]?.count || 0,
        status: dept.is_active ? 'active' : 'inactive'
      }));
      setDepartments(departmentsWithCounts);
    } catch (error) {
      console.error('Error assigning users:', error);
      throw error;
    }
  };

  const handleRemoveUser = async (departmentId, userId) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ department_id: null })
        .eq('id', userId);
      
      if (error) throw error;
      
      // Refresh departments to get updated member counts
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*, user_profiles(count)')
        .order('created_at', { ascending: false });
      
      if (deptError) throw deptError;
      
      const departmentsWithCounts = (deptData || []).map(dept => ({
        ...dept,
        totalMembers: dept.user_profiles?.[0]?.count || 0,
        status: dept.is_active ? 'active' : 'inactive'
      }));
      setDepartments(departmentsWithCounts);
    } catch (error) {
      console.error('Error removing user:', error);
      throw error;
    }
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