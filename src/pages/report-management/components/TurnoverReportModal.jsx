import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const TurnoverReportModal = ({ isOpen, onClose, report, onSubmit }) => {
  const [formData, setFormData] = useState({
    actionsTaken: '',
    resourcesUsed: '',
    outcome: '',
    recommendations: '',
    followUpRequired: false,
    followUpNotes: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const outcomeOptions = [
    { value: 'resolved', label: 'Fully Resolved' },
    { value: 'partially-resolved', label: 'Partially Resolved' },
    { value: 'referred', label: 'Referred to Another Agency' },
    { value: 'ongoing', label: 'Ongoing Investigation' }
  ];

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.actionsTaken.trim()) {
      newErrors.actionsTaken = 'Actions taken is required';
    }
    if (!formData.resourcesUsed.trim()) {
      newErrors.resourcesUsed = 'Resources used is required';
    }
    if (!formData.outcome) {
      newErrors.outcome = 'Outcome is required';
    }
    if (formData.followUpRequired && !formData.followUpNotes.trim()) {
      newErrors.followUpNotes = 'Follow-up notes are required when follow-up is needed';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        reportId: report?.report_id,
        ...formData,
        submittedAt: new Date().toISOString()
      });
      setFormData({
        actionsTaken: '',
        resourcesUsed: '',
        outcome: '',
        recommendations: '',
        followUpRequired: false,
        followUpNotes: ''
      });
      onClose();
    } catch (error) {
      console.error('Error submitting turnover report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-emergency-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Submit Turnover Report</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Report #{report?.report_id} - {report?.emergency_type?.replace('-', ' ')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground transition-emergency rounded-md hover:bg-muted"
            >
              <Icon name="X" size={20} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Report Summary */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Report Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location:</span>
                <span className="text-foreground">{report?.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority:</span>
                <span className="text-foreground capitalize">{report?.priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="text-foreground capitalize">{report?.status?.replace('-', ' ')}</span>
              </div>
            </div>
          </div>

          {/* Actions Taken */}
          <div>
            <Input
              label="Actions Taken"
              type="textarea"
              rows={4}
              placeholder="Describe the actions taken during the response..."
              value={formData.actionsTaken}
              onChange={(e) => setFormData({...formData, actionsTaken: e.target.value})}
              error={errors.actionsTaken}
              required
            />
          </div>

          {/* Resources Used */}
          <div>
            <Input
              label="Resources Used"
              type="textarea"
              rows={3}
              placeholder="List the resources deployed (personnel, equipment, vehicles, etc.)..."
              value={formData.resourcesUsed}
              onChange={(e) => setFormData({...formData, resourcesUsed: e.target.value})}
              error={errors.resourcesUsed}
              required
            />
          </div>

          {/* Outcome */}
          <div>
            <Select
              label="Outcome"
              options={outcomeOptions}
              value={formData.outcome}
              onChange={(value) => setFormData({...formData, outcome: value})}
              error={errors.outcome}
              required
            />
          </div>

          {/* Recommendations */}
          <div>
            <Input
              label="Recommendations"
              type="textarea"
              rows={3}
              placeholder="Any recommendations for future similar incidents..."
              value={formData.recommendations}
              onChange={(e) => setFormData({...formData, recommendations: e.target.value})}
            />
          </div>

          {/* Follow-up Required */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="followUpRequired"
              checked={formData.followUpRequired}
              onChange={(e) => setFormData({...formData, followUpRequired: e.target.checked})}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="followUpRequired" className="text-sm text-foreground">
              Follow-up required
            </label>
          </div>

          {/* Follow-up Notes */}
          {formData.followUpRequired && (
            <div>
              <Input
                label="Follow-up Notes"
                type="textarea"
                rows={3}
                placeholder="Describe the follow-up actions needed..."
                value={formData.followUpNotes}
                onChange={(e) => setFormData({...formData, followUpNotes: e.target.value})}
                error={errors.followUpNotes}
                required
              />
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TurnoverReportModal;
