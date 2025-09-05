import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const DepartmentCard = ({ 
  department, 
  onEdit, 
  onDelete, 
  onViewMembers, 
  onAssignUsers,
  isDragging = false,
  onDragStart = () => {},
  onDragEnd = () => {}
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(department?.name);

  const handleSaveEdit = () => {
    if (editName?.trim() && editName !== department?.name) {
      onEdit(department?.id, { name: editName?.trim() });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(department?.name);
    setIsEditing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-success';
      case 'inactive': return 'text-muted-foreground';
      case 'maintenance': return 'text-warning';
      default: return 'text-foreground';
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'inactive': return 'bg-muted text-muted-foreground';
      case 'maintenance': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div 
      className={`bg-card border border-border rounded-lg p-6 shadow-emergency hover:shadow-emergency-lg transition-emergency ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
      draggable
      onDragStart={(e) => {
        e?.dataTransfer?.setData('text/plain', JSON.stringify(department));
        onDragStart(department);
      }}
      onDragEnd={onDragEnd}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e?.target?.value)}
                className="flex-1"
                placeholder="Department name"
                onKeyPress={(e) => {
                  if (e?.key === 'Enter') handleSaveEdit();
                  if (e?.key === 'Escape') handleCancelEdit();
                }}
                autoFocus
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveEdit}
                iconName="Check"
                disabled={!editName?.trim()}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                iconName="X"
              />
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                <Icon name={department?.icon || 'Building'} size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{department?.name}</h3>
                <p className="text-sm text-muted-foreground">{department?.description}</p>
              </div>
            </div>
          )}
        </div>
        
        {!isEditing && (
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(department?.status)}`}>
              {department?.status}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              iconName="Edit2"
              title="Edit department"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(department?.id)}
              iconName="Trash2"
              className="text-destructive hover:text-destructive"
              title="Delete department"
            />
          </div>
        )}
      </div>
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">{department?.totalMembers}</div>
          <div className="text-xs text-muted-foreground">Total Members</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-success">{department?.activeResponders}</div>
          <div className="text-xs text-muted-foreground">Active</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{department?.avgResponseTime}</div>
          <div className="text-xs text-muted-foreground">Avg Response</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-warning">{department?.incidentsHandled}</div>
          <div className="text-xs text-muted-foreground">Incidents</div>
        </div>
      </div>
      {/* Recent Activity */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-foreground mb-2">Recent Activity</h4>
        <div className="space-y-2">
          {department?.recentActivity?.slice(0, 2)?.map((activity, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <Icon name={activity?.icon} size={14} className={getStatusColor(activity?.type)} />
              <span className="text-muted-foreground">{activity?.message}</span>
              <span className="text-xs text-muted-foreground ml-auto">{activity?.time}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewMembers(department?.id)}
            iconName="Users"
            iconPosition="left"
          >
            View Members
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAssignUsers(department?.id)}
            iconName="UserPlus"
            iconPosition="left"
          >
            Assign Users
          </Button>
        </div>
        
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          <Icon name="Clock" size={12} />
          <span>Updated {department?.lastUpdated}</span>
        </div>
      </div>
    </div>
  );
};

export default DepartmentCard;