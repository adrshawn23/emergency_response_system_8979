import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const CreateDepartmentModal = ({ isOpen, onClose, onCreateDepartment }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'Building',
    status: 'active',
    parentDepartment: '',
    capacity: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const iconOptions = [
    { value: 'Building', label: 'Building' },
    { value: 'Shield', label: 'Shield' },
    { value: 'Truck', label: 'Truck' },
    { value: 'Heart', label: 'Heart' },
    { value: 'Zap', label: 'Zap' },
    { value: 'Users', label: 'Users' },
    { value: 'Settings', label: 'Settings' },
    { value: 'AlertTriangle', label: 'Alert Triangle' }
  ];

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'maintenance', label: 'Maintenance' }
  ];

  const parentDepartmentOptions = [
    { value: '', label: 'None (Root Department)' },
    { value: 'emergency-services', label: 'Emergency Services' },
    { value: 'public-safety', label: 'Public Safety' },
    { value: 'administration', label: 'Administration' }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors?.[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.name?.trim()) {
      newErrors.name = 'Department name is required';
    } else if (formData?.name?.length < 3) {
      newErrors.name = 'Department name must be at least 3 characters';
    }

    if (!formData?.description?.trim()) {
      newErrors.description = 'Description is required';
    }

    if (formData?.capacity && (isNaN(formData?.capacity) || parseInt(formData?.capacity) < 1)) {
      newErrors.capacity = 'Capacity must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
      const departmentData = {
        ...formData,
        capacity: formData?.capacity ? parseInt(formData?.capacity) : null,
        createdAt: new Date()?.toISOString(),
        totalMembers: 0,
        activeResponders: 0,
        avgResponseTime: '0m',
        incidentsHandled: 0,
        recentActivity: []
      };

      await onCreateDepartment(departmentData);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        icon: 'Building',
        status: 'active',
        parentDepartment: '',
        capacity: ''
      });
      
      onClose();
    } catch (error) {
      setErrors({ submit: 'Failed to create department. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      icon: 'Building',
      status: 'active',
      parentDepartment: '',
      capacity: ''
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
      <div className="bg-card border border-border rounded-lg shadow-emergency-lg w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
              <Icon name="Plus" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Create Department</h2>
              <p className="text-sm text-muted-foreground">Add a new department to the system</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            iconName="X"
            disabled={isSubmitting}
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors?.submit && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{errors?.submit}</p>
            </div>
          )}

          <Input
            label="Department Name"
            type="text"
            placeholder="Enter department name"
            value={formData?.name}
            onChange={(e) => handleInputChange('name', e?.target?.value)}
            error={errors?.name}
            required
            disabled={isSubmitting}
          />

          <Input
            label="Description"
            type="text"
            placeholder="Brief description of the department"
            value={formData?.description}
            onChange={(e) => handleInputChange('description', e?.target?.value)}
            error={errors?.description}
            required
            disabled={isSubmitting}
          />

          <Select
            label="Department Icon"
            options={iconOptions}
            value={formData?.icon}
            onChange={(value) => handleInputChange('icon', value)}
            disabled={isSubmitting}
          />

          <Select
            label="Status"
            options={statusOptions}
            value={formData?.status}
            onChange={(value) => handleInputChange('status', value)}
            disabled={isSubmitting}
          />

          <Select
            label="Parent Department"
            description="Optional: Select a parent department for hierarchy"
            options={parentDepartmentOptions}
            value={formData?.parentDepartment}
            onChange={(value) => handleInputChange('parentDepartment', value)}
            disabled={isSubmitting}
          />

          <Input
            label="Capacity"
            type="number"
            placeholder="Maximum number of members (optional)"
            value={formData?.capacity}
            onChange={(e) => handleInputChange('capacity', e?.target?.value)}
            error={errors?.capacity}
            disabled={isSubmitting}
            min="1"
          />

          {/* Preview */}
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <h4 className="text-sm font-medium text-foreground mb-2">Preview</h4>
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
                <Icon name={formData?.icon} size={20} className="text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {formData?.name || 'Department Name'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formData?.description || 'Department description'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              iconName="Plus"
              iconPosition="left"
            >
              Create Department
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDepartmentModal;