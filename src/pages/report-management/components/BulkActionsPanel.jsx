import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const BulkActionsPanel = ({ 
  selectedReports = [], 
  onBulkAction, 
  onClearSelection,
  className = "" 
}) => {
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedResponder, setSelectedResponder] = useState('');
  const [loading, setLoading] = useState(false);

  if (selectedReports?.length === 0) return null;

  const actionOptions = [
    { value: '', label: 'Select Action...' },
    { value: 'assign', label: 'Assign to Responder' },
    { value: 'accept', label: 'Accept Reports' },
    { value: 'decline', label: 'Decline Reports' },
    { value: 'change-priority', label: 'Change Priority' },
    { value: 'export', label: 'Export Reports' }
  ];

  const responderOptions = [
    { value: '', label: 'Select Responder...' },
    { value: 'resp-001', label: 'Officer John Martinez' },
    { value: 'resp-002', label: 'Firefighter Sarah Chen' },
    { value: 'resp-003', label: 'Paramedic Mike Johnson' },
    { value: 'resp-004', label: 'Officer Lisa Thompson' },
    { value: 'resp-005', label: 'Fire Captain David Wilson' }
  ];

  const priorityOptions = [
    { value: '', label: 'Select Priority...' },
    { value: 'low', label: 'Low Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'high', label: 'High Priority' },
    { value: 'critical', label: 'Critical Priority' }
  ];

  const handleBulkAction = async () => {
    if (!selectedAction) return;
    
    setLoading(true);
    try {
      await onBulkAction({
        action: selectedAction,
        reportIds: selectedReports,
        responder: selectedResponder,
        timestamp: new Date()
      });
      setSelectedAction('');
      setSelectedResponder('');
    } catch (error) {
      console.error('Bulk action failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'assign': return 'UserPlus';
      case 'accept': return 'Check';
      case 'decline': return 'X';
      case 'change-priority': return 'AlertTriangle';
      case 'export': return 'Download';
      default: return 'Settings';
    }
  };

  return (
    <div className={`bg-card border border-border rounded-lg shadow-emergency p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Icon name="CheckSquare" size={20} className="text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Bulk Actions</h3>
            <p className="text-xs text-muted-foreground">
              {selectedReports?.length} report{selectedReports?.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          iconName="X"
          title="Clear selection"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Action Selection */}
        <div className="md:col-span-1">
          <Select
            label="Action"
            options={actionOptions}
            value={selectedAction}
            onChange={setSelectedAction}
            className="w-full"
          />
        </div>

        {/* Conditional Fields */}
        {selectedAction === 'assign' && (
          <div className="md:col-span-1">
            <Select
              label="Responder"
              options={responderOptions}
              value={selectedResponder}
              onChange={setSelectedResponder}
              searchable
              className="w-full"
            />
          </div>
        )}

        {selectedAction === 'change-priority' && (
          <div className="md:col-span-1">
            <Select
              label="New Priority"
              options={priorityOptions}
              value={selectedResponder}
              onChange={setSelectedResponder}
              className="w-full"
            />
          </div>
        )}

        {/* Action Button */}
        <div className="md:col-span-1 flex items-end">
          <Button
            variant="default"
            onClick={handleBulkAction}
            disabled={!selectedAction || (selectedAction === 'assign' && !selectedResponder) || loading}
            loading={loading}
            iconName={getActionIcon(selectedAction)}
            iconPosition="left"
            className="w-full"
          >
            Apply
          </Button>
        </div>
      </div>
      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkAction({ action: 'accept', reportIds: selectedReports })}
            iconName="Check"
            iconPosition="left"
            disabled={loading}
          >
            Accept All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkAction({ action: 'decline', reportIds: selectedReports })}
            iconName="X"
            iconPosition="left"
            disabled={loading}
          >
            Decline All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkAction({ action: 'export', reportIds: selectedReports })}
            iconName="Download"
            iconPosition="left"
            disabled={loading}
          >
            Export Selected
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkAction({ action: 'priority-high', reportIds: selectedReports })}
            iconName="AlertTriangle"
            iconPosition="left"
            disabled={loading}
          >
            Mark High Priority
          </Button>
        </div>
      </div>
      {/* Selection Summary */}
      <div className="mt-4 p-3 bg-muted/50 rounded-md">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Selected Reports:</span>
          <span className="text-foreground font-medium">{selectedReports?.length}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-muted-foreground">Action:</span>
          <span className="text-foreground">
            {selectedAction ? actionOptions?.find(a => a?.value === selectedAction)?.label : 'None selected'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BulkActionsPanel;