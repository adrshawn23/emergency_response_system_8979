import React, { useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import { userProfilesService } from '../../../services/supabaseService';

const AssignResponderModal = ({ 
  report, 
  isOpen, 
  onClose, 
  onAssign,
  className = "" 
}) => {
  const [selectedResponder, setSelectedResponder] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [priority, setPriority] = useState(report?.priority || 'medium');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [responders, setResponders] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    userProfilesService.getRespondersByDepartment().then(({ data }) => {
      setResponders((data || []).map(item => ({
        value: item.id,
        label: item.full_name,
        department: item.department?.type || '',
        departmentId: item.department_id,
        status: item.is_active ? 'available' : 'unavailable',
        experience: 'Verified responder',
        currentLoad: 0
      })));
    });
  }, [isOpen]);

  if (!isOpen || !report) return null;

  /* Legacy examples
  const mockResponders = [
    {
      value: 'resp-001',
      label: 'Officer John Martinez',
      department: 'police',
      status: 'available',
      experience: '8 years',
      currentLoad: 2
    },
    {
      value: 'resp-002',
      label: 'Firefighter Sarah Chen',
      department: 'fire',
      status: 'available',
      experience: '5 years',
      currentLoad: 1
    },
    {
      value: 'resp-003',
      label: 'Paramedic Mike Johnson',
      department: 'medical',
      status: 'busy',
      experience: '12 years',
      currentLoad: 4
    },
    {
      value: 'resp-004',
      label: 'Officer Lisa Thompson',
      department: 'police',
      status: 'available',
      experience: '3 years',
      currentLoad: 1
    },
    {
      value: 'resp-005',
      label: 'Fire Captain David Wilson',
      department: 'fire',
      status: 'available',
      experience: '15 years',
      currentLoad: 0
    }
  ]; */

  const departmentOptions = [
    { value: '', label: 'All Departments' },
    { value: 'police', label: 'Police Department' },
    { value: 'fire', label: 'Fire Department' },
    { value: 'medical', label: 'Medical Services' },
    { value: 'emergency', label: 'Emergency Management' }
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'high', label: 'High Priority' },
    { value: 'critical', label: 'Critical Priority' }
  ];

  const filteredResponders = responders?.filter(responder => 
    !selectedDepartment || responder?.department === selectedDepartment
  );

  const responderOptions = filteredResponders?.map(responder => ({
    value: responder?.value,
    label: responder?.label,
    description: `${responder?.department} • ${responder?.status} • Load: ${responder?.currentLoad}/5`,
    disabled: responder?.status === 'busy' && responder?.currentLoad >= 4
  }));

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'text-success';
      case 'busy': return 'text-warning';
      case 'unavailable': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getLoadColor = (load) => {
    if (load <= 2) return 'text-success';
    if (load <= 3) return 'text-warning';
    return 'text-destructive';
  };

  const selectedResponderData = responders?.find(r => r?.value === selectedResponder);

  const handleAssign = async () => {
    if (!selectedResponder) return;

    setLoading(true);
    try {
      await onAssign({
        reportId: report?.id,
        responderId: selectedResponder,
        responderData: selectedResponderData,
        departmentId: selectedResponderData?.departmentId,
        priority,
        notes
      });
      onClose();
    } catch (error) {
      console.error('Assignment failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
      <div className={`bg-card border border-border rounded-lg shadow-emergency-lg max-w-2xl w-full max-h-[90vh] overflow-hidden ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <Icon name="UserPlus" size={24} className="text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Assign Responder
              </h2>
              <p className="text-sm text-muted-foreground">
                Report #{report?.id} - {report?.location}
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

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-96">
          {/* Department Filter */}
          <div>
            <Select
              label="Filter by Department"
              description="Filter responders by their department"
              options={departmentOptions}
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              className="w-full"
            />
          </div>

          {/* Responder Selection */}
          <div>
            <Select
              label="Select Responder"
              description="Choose an available responder for this incident"
              options={responderOptions}
              value={selectedResponder}
              onChange={setSelectedResponder}
              searchable
              required
              className="w-full"
            />
          </div>

          {/* Selected Responder Details */}
          {selectedResponderData && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="text-sm font-semibold text-foreground mb-3">Responder Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <span className={`text-xs font-medium capitalize ${getStatusColor(selectedResponderData?.status)}`}>
                      {selectedResponderData?.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Experience</span>
                    <span className="text-xs text-foreground">{selectedResponderData?.experience}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Department</span>
                    <span className="text-xs text-foreground capitalize">{selectedResponderData?.department}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Current Load</span>
                    <span className={`text-xs font-medium ${getLoadColor(selectedResponderData?.currentLoad)}`}>
                      {selectedResponderData?.currentLoad}/5
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Load Bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Workload</span>
                  <span className="text-xs text-foreground">{(selectedResponderData?.currentLoad / 5 * 100)?.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-emergency ${
                      selectedResponderData?.currentLoad <= 2 ? 'bg-success' :
                      selectedResponderData?.currentLoad <= 3 ? 'bg-warning' : 'bg-destructive'
                    }`}
                    style={{ width: `${(selectedResponderData?.currentLoad / 5) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Priority Adjustment */}
          <div>
            <Select
              label="Priority Level"
              description="Adjust priority if needed based on current situation"
              options={priorityOptions}
              value={priority}
              onChange={setPriority}
              className="w-full"
            />
          </div>

          {/* Assignment Notes */}
          <div>
            <Input
              label="Assignment Notes"
              description="Additional instructions or information for the responder"
              type="text"
              placeholder="Enter any special instructions..."
              value={notes}
              onChange={(e) => setNotes(e?.target?.value)}
              className="w-full"
            />
          </div>

          {/* Assignment Summary */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <h4 className="text-sm font-semibold text-foreground mb-2">Assignment Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Report:</span>
                <span className="text-foreground">#{report?.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location:</span>
                <span className="text-foreground">{report?.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Incident Type:</span>
                <span className="text-foreground capitalize">{report?.incidentType?.replace('-', ' ')}</span>
              </div>
              {selectedResponderData && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned To:</span>
                  <span className="text-foreground">{selectedResponderData?.label}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority:</span>
                <span className="text-foreground capitalize">{priority}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/50">
          <div className="flex items-center space-x-2">
            <Icon name="Info" size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Assignment will notify the responder immediately
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={handleAssign}
              disabled={!selectedResponder || loading}
              loading={loading}
              iconName="UserPlus"
              iconPosition="left"
            >
              Assign Responder
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignResponderModal;
