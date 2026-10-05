import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const UserTable = ({ 
  users = [], 
  onEditUser = () => {}, 
  onDeleteUser = () => {}, 
  onToggleUserStatus = () => {},
  onViewProfile = () => {},
  searchTerm = "",
  onSearchChange = () => {},
  selectedRole = "",
  onRoleChange = () => {},
  selectedDepartment = "",
  onDepartmentChange = () => {},
  selectedStatus = "",
  onStatusChange = () => {}
}) => {
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedUsers, setSelectedUsers] = useState([]);

  const roleOptions = [
    { value: '', label: 'All Roles' },
    { value: 'admin', label: 'Administrator' },
    { value: 'dispatcher', label: 'Dispatcher' },
    { value: 'responder', label: 'Responder' },
    { value: 'resident', label: 'Resident' }
  ];

  const departmentOptions = [
    { value: '', label: 'All Departments' },
    { value: 'fire', label: 'Fire Department' },
    { value: 'police', label: 'Police Department' },
    { value: 'medical', label: 'Medical Services' },
    { value: 'admin', label: 'Administration' }
  ];

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'pending', label: 'Pending Approval' },
    { value: 'suspended', label: 'Suspended' }
  ];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => 
      prev?.includes(userId) 
        ? prev?.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers?.length === users?.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users?.map(user => user?.id));
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: 'bg-success text-success-foreground', label: 'Active' },
      inactive: { color: 'bg-muted text-muted-foreground', label: 'Inactive' },
      pending: { color: 'bg-warning text-warning-foreground', label: 'Pending' },
      suspended: { color: 'bg-destructive text-destructive-foreground', label: 'Suspended' }
    };
    
    const config = statusConfig?.[status] || statusConfig?.inactive;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config?.color}`}>
        {config?.label}
      </span>
    );
  };

  const getRoleIcon = (role) => {
    const roleIcons = {
      admin: 'Shield',
      dispatcher: 'Radio',
      responder: 'Truck',
      resident: 'User'
    };
    return roleIcons?.[role] || 'User';
  };

  const sortedUsers = [...users]?.sort((a, b) => {
    let aValue = a?.[sortField];
    let bValue = b?.[sortField];
    
    if (typeof aValue === 'string') {
      aValue = aValue?.toLowerCase();
      bValue = bValue?.toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  return (
    <div className="bg-card rounded-lg border border-border shadow-emergency">
      {/* Header with Filters */}
      <div className="p-6 border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">User Management</h2>
            <p className="text-sm text-muted-foreground">
              {users?.length} total users • {selectedUsers?.length} selected
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="search"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e?.target?.value)}
              className="w-full sm:w-64"
            />
            
            <div className="flex gap-2">
              <Select
                options={roleOptions}
                value={selectedRole}
                onChange={onRoleChange}
                placeholder="Filter by role"
                className="w-40"
              />
              
              <Select
                options={departmentOptions}
                value={selectedDepartment}
                onChange={onDepartmentChange}
                placeholder="Filter by department"
                className="w-40"
              />
              
              <Select
                options={statusOptions}
                value={selectedStatus}
                onChange={onStatusChange}
                placeholder="Filter by status"
                className="w-40"
              />
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedUsers?.length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {selectedUsers?.length} user{selectedUsers?.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" iconName="UserCheck">
                  Activate Selected
                </Button>
                <Button variant="outline" size="sm" iconName="UserX">
                  Deactivate Selected
                </Button>
                <Button variant="destructive" size="sm" iconName="Trash2">
                  Delete Selected
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-12 p-4">
                <input
                  type="checkbox"
                  checked={selectedUsers?.length === users?.length && users?.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-border"
                />
              </th>
              
              <th className="text-left p-4">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary"
                >
                  <span>User</span>
                  <Icon 
                    name={sortField === 'name' ? (sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown') : 'ChevronsUpDown'} 
                    size={14} 
                  />
                </button>
              </th>
              
              <th className="text-left p-4">
                <button
                  onClick={() => handleSort('role')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary"
                >
                  <span>Role</span>
                  <Icon 
                    name={sortField === 'role' ? (sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown') : 'ChevronsUpDown'} 
                    size={14} 
                  />
                </button>
              </th>
              
              <th className="text-left p-4">
                <button
                  onClick={() => handleSort('department')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary"
                >
                  <span>Department</span>
                  <Icon 
                    name={sortField === 'department' ? (sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown') : 'ChevronsUpDown'} 
                    size={14} 
                  />
                </button>
              </th>
              
              <th className="text-left p-4">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary"
                >
                  <span>Status</span>
                  <Icon 
                    name={sortField === 'status' ? (sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown') : 'ChevronsUpDown'} 
                    size={14} 
                  />
                </button>
              </th>
              
              <th className="text-left p-4">
                <button
                  onClick={() => handleSort('registrationDate')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary"
                >
                  <span>Registered</span>
                  <Icon 
                    name={sortField === 'registrationDate' ? (sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown') : 'ChevronsUpDown'} 
                    size={14} 
                  />
                </button>
              </th>
              
              <th className="text-right p-4">
                <span className="text-sm font-medium text-foreground">Actions</span>
              </th>
            </tr>
          </thead>
          
          <tbody>
            {sortedUsers?.map((user) => (
              <tr key={user?.id} className="border-b border-border hover:bg-muted/30 transition-emergency">
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedUsers?.includes(user?.id)}
                    onChange={() => handleSelectUser(user?.id)}
                    className="rounded border-border"
                  />
                </td>
                
                <td className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Image
                        src={user?.avatar}
                        alt={user?.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      {user?.isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-success border-2 border-card rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{user?.name}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                </td>
                
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    <Icon name={getRoleIcon(user?.role)} size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground capitalize">{user?.role}</span>
                  </div>
                </td>
                
                <td className="p-4">
                  <span className="text-sm text-foreground">{user?.department?.name || user?.department || 'Not assigned'}</span>
                </td>
                
                <td className="p-4">
                  {getStatusBadge(user?.status)}
                </td>
                
                <td className="p-4">
                  <span className="text-sm text-muted-foreground">
                    {new Date(user.registrationDate)?.toLocaleDateString()}
                  </span>
                </td>
                
                <td className="p-4">
                  <div className="flex items-center justify-end space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewProfile(user)}
                      iconName="Eye"
                      className="text-muted-foreground hover:text-foreground"
                    />
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditUser(user)}
                      iconName="Edit"
                      className="text-muted-foreground hover:text-primary"
                    />
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleUserStatus(user)}
                      iconName={user?.status === 'active' ? 'UserX' : 'UserCheck'}
                      className={user?.status === 'active' ? 'text-warning hover:text-warning' : 'text-success hover:text-success'}
                    />
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteUser(user)}
                      iconName="Trash2"
                      className="text-muted-foreground hover:text-destructive"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {sortedUsers?.length === 0 && (
          <div className="p-12 text-center">
            <Icon name="Users" size={48} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No users found</h3>
            <p className="text-muted-foreground">
              {searchTerm || selectedRole || selectedDepartment || selectedStatus
                ? "Try adjusting your filters to see more results." :"Get started by adding your first user to the system."
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserTable;