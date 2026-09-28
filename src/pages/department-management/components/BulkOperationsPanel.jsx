import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';

const BulkOperationsPanel = ({ 
  selectedDepartments = [], 
  onBulkOperation, 
  onClearSelection,
  availableUsers = []
}) => {
  const [operationType, setOperationType] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const operationOptions = [
    { value: '', label: 'Select Operation' },
    { value: 'merge', label: 'Merge Departments' },
    { value: 'transfer-users', label: 'Transfer Users' },
    { value: 'change-status', label: 'Change Status' },
    { value: 'delete', label: 'Delete Departments' }
  ];

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'maintenance', label: 'Maintenance' }
  ];

  const departmentOptions = selectedDepartments?.map(dept => ({
    value: dept?.id,
    label: dept?.name
  }));

  const handleUserSelection = (userId, checked) => {
    setSelectedUsers(prev => {
      if (checked) {
        return [...prev, userId];
      } else {
        return prev?.filter(id => id !== userId);
      }
    });
  };

  const handleExecuteOperation = () => {
    if (!operationType) return;

    const operationData = {
      type: operationType,
      departments: selectedDepartments,
      targetDepartment,
      selectedUsers,
      status: operationType === 'change-status' ? targetDepartment : undefined
    };

    onBulkOperation(operationData);
    setIsConfirmOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setOperationType('');
    setTargetDepartment('');
    setSelectedUsers([]);
  };

  const getOperationDescription = () => {
    switch (operationType) {
      case 'merge':
        return `Merge ${selectedDepartments?.length} departments into one. All users will be transferred to the target department.`;
      case 'transfer-users':
        return `Transfer selected users from ${selectedDepartments?.length} departments to the target department.`;
      case 'change-status':
        return `Change the status of ${selectedDepartments?.length} departments.`;
      case 'delete':
        return `Delete ${selectedDepartments?.length} departments. This action cannot be undone.`;
      default:
        return '';
    }
  };

  const isOperationReady = () => {
    if (!operationType) return false;
    
    switch (operationType) {
      case 'merge': case'transfer-users':
        return targetDepartment && (operationType !== 'transfer-users' || selectedUsers?.length > 0);
      case 'change-status':
        return targetDepartment;
      case 'delete':
        return true;
      default:
        return false;
    }
  };

  if (selectedDepartments?.length === 0) return null;

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-4 shadow-emergency">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
              <Icon name="Settings" size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Bulk Operations</h3>
              <p className="text-sm text-muted-foreground">
                {selectedDepartments?.length} departments selected
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            iconName="X"
            iconPosition="left"
          >
            Clear Selection
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Operation Type */}
          <Select
            label="Operation"
            options={operationOptions}
            value={operationType}
            onChange={setOperationType}
            placeholder="Choose operation"
          />

          {/* Target Department (for merge/transfer) */}
          {(operationType === 'merge' || operationType === 'transfer-users') && (
            <Select
              label="Target Department"
              options={departmentOptions}
              value={targetDepartment}
              onChange={setTargetDepartment}
              placeholder="Select target"
            />
          )}

          {/* Status (for status change) */}
          {operationType === 'change-status' && (
            <Select
              label="New Status"
              options={statusOptions}
              value={targetDepartment}
              onChange={setTargetDepartment}
              placeholder="Select status"
            />
          )}

          {/* Execute Button */}
          <div className="flex items-end">
            <Button
              variant={operationType === 'delete' ? 'destructive' : 'default'}
              onClick={() => setIsConfirmOpen(true)}
              disabled={!isOperationReady()}
              iconName="Play"
              iconPosition="left"
              fullWidth
            >
              Execute
            </Button>
          </div>
        </div>

        {/* User Selection (for transfer operations) */}
        {operationType === 'transfer-users' && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
            <h4 className="text-sm font-semibold text-foreground mb-3">Select Users to Transfer</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
              {availableUsers?.map(user => (
                <Checkbox
                  key={user?.id}
                  label={`${user?.name} (${user?.role})`}
                  checked={selectedUsers?.includes(user?.id)}
                  onChange={(e) => handleUserSelection(user?.id, e?.target?.checked)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Selected Departments Preview */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-foreground mb-2">Selected Departments</h4>
          <div className="flex flex-wrap gap-2">
            {selectedDepartments?.map(dept => (
              <div key={dept?.id} className="flex items-center space-x-2 px-3 py-1 bg-primary/10 rounded-full">
                <Icon name={dept?.icon || 'Building'} size={14} className="text-primary" />
                <span className="text-sm text-primary">{dept?.name}</span>
                <span className="text-xs text-muted-foreground">({dept?.totalMembers})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
          <div className="bg-card border border-border rounded-lg shadow-emergency-lg w-full max-w-md animate-slide-down">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                  operationType === 'delete' ? 'bg-destructive/10' : 'bg-warning/10'
                }`}>
                  <Icon 
                    name={operationType === 'delete' ? 'AlertTriangle' : 'AlertCircle'} 
                    size={20} 
                    className={operationType === 'delete' ? 'text-destructive' : 'text-warning'} 
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Confirm Operation</h3>
                  <p className="text-sm text-muted-foreground">This action will affect multiple departments</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-foreground mb-2">{getOperationDescription()}</p>
                {operationType === 'delete' && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive font-medium">
                      Warning: This action cannot be undone!
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setIsConfirmOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant={operationType === 'delete' ? 'destructive' : 'default'}
                  onClick={handleExecuteOperation}
                  iconName="Check"
                  iconPosition="left"
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkOperationsPanel;