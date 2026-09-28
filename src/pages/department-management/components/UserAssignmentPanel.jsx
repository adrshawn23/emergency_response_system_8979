import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const UserAssignmentPanel = ({ 
  isOpen, 
  onClose, 
  department, 
  availableUsers = [], 
  onAssignUsers,
  onRemoveUser 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [filterRole, setFilterRole] = useState('all');
  const [draggedUser, setDraggedUser] = useState(null);

  const roleOptions = [
    { value: 'all', label: 'All Roles' },
    { value: 'responder', label: 'Responder' },
    { value: 'dispatcher', label: 'Dispatcher' },
    { value: 'admin', label: 'Admin' }
  ];

  const filteredAvailableUsers = availableUsers?.filter(user => {
    const matchesSearch = user?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
                         user?.email?.toLowerCase()?.includes(searchTerm?.toLowerCase());
    const matchesRole = filterRole === 'all' || user?.role === filterRole;
    const notInDepartment = !department?.members?.some(member => member?.id === user?.id);
    return matchesSearch && matchesRole && notInDepartment;
  });

  const handleUserSelect = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev?.some(u => u?.id === user?.id);
      if (isSelected) {
        return prev?.filter(u => u?.id !== user?.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleBulkAssign = () => {
    if (selectedUsers?.length > 0) {
      onAssignUsers(department?.id, selectedUsers);
      setSelectedUsers([]);
    }
  };

  const handleDragStart = (user) => {
    setDraggedUser(user);
  };

  const handleDragOver = (e) => {
    e?.preventDefault();
  };

  const handleDrop = (e) => {
    e?.preventDefault();
    if (draggedUser) {
      onAssignUsers(department?.id, [draggedUser]);
      setDraggedUser(null);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'text-destructive';
      case 'dispatcher': return 'text-warning';
      case 'responder': return 'text-primary';
      default: return 'text-muted-foreground';
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-destructive text-destructive-foreground';
      case 'dispatcher': return 'bg-warning text-warning-foreground';
      case 'responder': return 'bg-primary text-primary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
      <div className="bg-card border border-border rounded-lg shadow-emergency-lg w-full max-w-4xl max-h-[90vh] overflow-hidden animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
              <Icon name="UserPlus" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Manage Users - {department?.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Assign users to department or manage existing members
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            iconName="X"
          />
        </div>

        <div className="flex h-[600px]">
          {/* Available Users */}
          <div className="flex-1 border-r border-border">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground mb-3">Available Users</h3>
              
              <div className="flex space-x-2 mb-3">
                <Input
                  type="search"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e?.target?.value)}
                  className="flex-1"
                />
                <Select
                  options={roleOptions}
                  value={filterRole}
                  onChange={setFilterRole}
                  className="w-32"
                />
              </div>

              {selectedUsers?.length > 0 && (
                <div className="flex items-center justify-between p-2 bg-primary/10 rounded-md">
                  <span className="text-sm text-primary">
                    {selectedUsers?.length} users selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkAssign}
                    iconName="ArrowRight"
                    iconPosition="right"
                  >
                    Assign Selected
                  </Button>
                </div>
              )}
            </div>

            <div className="p-4 overflow-y-auto h-full">
              <div className="space-y-2">
                {filteredAvailableUsers?.map(user => (
                  <div
                    key={user?.id}
                    draggable
                    onDragStart={() => handleDragStart(user)}
                    className={`flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted transition-emergency cursor-move ${
                      selectedUsers?.some(u => u?.id === user?.id) ? 'bg-primary/10 border-primary' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full text-xs font-semibold">
                        {user?.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{user?.name}</p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user?.role)}`}>
                        {user?.role}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUserSelect(user)}
                        iconName={selectedUsers?.some(u => u?.id === user?.id) ? "Check" : "Plus"}
                        className={selectedUsers?.some(u => u?.id === user?.id) ? "text-primary" : ""}
                      />
                    </div>
                  </div>
                ))}

                {filteredAvailableUsers?.length === 0 && (
                  <div className="text-center py-8">
                    <Icon name="Users" size={32} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No available users found</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Department Members */}
          <div className="flex-1">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                Department Members ({department?.members?.length || 0})
              </h3>
            </div>

            <div 
              className="p-4 overflow-y-auto h-full"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="space-y-2">
                {department?.members?.map(member => (
                  <div
                    key={member?.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted transition-emergency"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full text-xs font-semibold">
                        {member?.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{member?.name}</p>
                        <p className="text-xs text-muted-foreground">{member?.email}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(member?.role)}`}>
                            {member?.role}
                          </span>
                          {member?.isActive && (
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 bg-success rounded-full"></div>
                              <span className="text-xs text-success">Active</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveUser(department?.id, member?.id)}
                      iconName="X"
                      className="text-destructive hover:text-destructive"
                      title="Remove from department"
                    />
                  </div>
                ))}

                {(!department?.members || department?.members?.length === 0) && (
                  <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                    <Icon name="UserPlus" size={32} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-1">No members assigned</p>
                    <p className="text-xs text-muted-foreground">Drag users here or use the assign button</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Drag and drop users between panels or use the assign buttons
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserAssignmentPanel;