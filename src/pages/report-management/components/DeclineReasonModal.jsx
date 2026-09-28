import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import { Checkbox } from '../../../components/ui/Checkbox';

const DeclineReasonModal = ({ 
  report, 
  isOpen, 
  onClose, 
  onDecline,
  className = "" 
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [notifyReporter, setNotifyReporter] = useState(true);
  const [escalateToSupervisor, setEscalateToSupervisor] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !report) return null;

  const reasonOptions = [
    { value: 'insufficient-info', label: 'Insufficient Information' },
    { value: 'duplicate', label: 'Duplicate Report' },
    { value: 'false-alarm', label: 'False Alarm' },
    { value: 'outside-jurisdiction', label: 'Outside Jurisdiction' },
    { value: 'resolved-already', label: 'Already Resolved' },
    { value: 'non-emergency', label: 'Non-Emergency Matter' },
    { value: 'resource-unavailable', label: 'Resources Unavailable' },
    { value: 'other', label: 'Other (Specify Below)' }
  ];

  const handleDecline = async () => {
    if (!selectedReason) return;
    if (selectedReason === 'other' && !customReason?.trim()) return;

    setLoading(true);
    try {
      await onDecline({
        reportId: report?.id,
        reason: selectedReason === 'other' ? customReason : reasonOptions?.find(r => r?.value === selectedReason)?.label,
        reasonCode: selectedReason,
        notifyReporter,
        escalateToSupervisor,
        timestamp: new Date()
      });
      onClose();
    } catch (error) {
      console.error('Decline failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReasonDescription = (reason) => {
    switch (reason) {
      case 'insufficient-info':
        return 'The report lacks necessary details to proceed with emergency response.';
      case 'duplicate':
        return 'This incident has already been reported and is being handled.';
      case 'false-alarm':
        return 'Investigation determined this to be a false alarm or misunderstanding.';
      case 'outside-jurisdiction':
        return 'This incident falls outside our response jurisdiction.';
      case 'resolved-already':
        return 'The situation has been resolved before emergency response was needed.';
      case 'non-emergency':
        return 'This matter does not require emergency response services.';
      case 'resource-unavailable':
        return 'Required emergency resources are currently unavailable.';
      case 'other':
        return 'Please provide specific details in the custom reason field.';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
      <div className={`bg-card border border-border rounded-lg shadow-emergency-lg max-w-2xl w-full max-h-[90vh] overflow-hidden ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <Icon name="X" size={24} className="text-destructive" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Decline Report
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
          {/* Warning Notice */}
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <div className="flex items-start space-x-3">
              <Icon name="AlertTriangle" size={20} className="text-warning flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">Important Notice</h4>
                <p className="text-sm text-muted-foreground">
                  Declining an emergency report requires proper justification. This action will be logged 
                  and may be reviewed by supervisors. Ensure you have thoroughly evaluated the situation.
                </p>
              </div>
            </div>
          </div>

          {/* Report Summary */}
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="text-sm font-semibold text-foreground mb-3">Report Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="text-foreground capitalize">{report?.incidentType?.replace('-', ' ')}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Priority:</span>
                  <span className="text-foreground capitalize">{report?.priority}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Reporter:</span>
                  <span className="text-foreground">{report?.reporter?.name}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Time:</span>
                  <span className="text-foreground">{new Date(report.timestamp)?.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-sm text-foreground">{report?.description}</p>
            </div>
          </div>

          {/* Decline Reason */}
          <div>
            <Select
              label="Reason for Declining"
              description="Select the primary reason for declining this emergency report"
              options={reasonOptions}
              value={selectedReason}
              onChange={setSelectedReason}
              required
              className="w-full"
            />
            
            {selectedReason && (
              <div className="mt-3 p-3 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground">
                  {getReasonDescription(selectedReason)}
                </p>
              </div>
            )}
          </div>

          {/* Custom Reason */}
          {selectedReason === 'other' && (
            <div>
              <Input
                label="Custom Reason"
                description="Provide specific details about why this report is being declined"
                type="text"
                placeholder="Enter detailed explanation..."
                value={customReason}
                onChange={(e) => setCustomReason(e?.target?.value)}
                required
                className="w-full"
              />
            </div>
          )}

          {/* Additional Options */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Additional Actions</h4>
            
            <Checkbox
              label="Notify Reporter"
              description="Send notification to the person who submitted this report"
              checked={notifyReporter}
              onChange={(e) => setNotifyReporter(e?.target?.checked)}
            />
            
            <Checkbox
              label="Escalate to Supervisor"
              description="Flag this decline for supervisor review"
              checked={escalateToSupervisor}
              onChange={(e) => setEscalateToSupervisor(e?.target?.checked)}
            />
          </div>

          {/* Impact Warning */}
          {report?.priority === 'critical' || report?.priority === 'high' && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start space-x-3">
                <Icon name="AlertCircle" size={20} className="text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">High Priority Warning</h4>
                  <p className="text-sm text-muted-foreground">
                    This is a {report?.priority} priority report. Declining high-priority reports 
                    requires supervisor approval and will be automatically escalated for review.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/50">
          <div className="flex items-center space-x-2">
            <Icon name="Clock" size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              This action will be logged with timestamp
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDecline}
              disabled={!selectedReason || (selectedReason === 'other' && !customReason?.trim()) || loading}
              loading={loading}
              iconName="X"
              iconPosition="left"
            >
              Decline Report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeclineReasonModal;