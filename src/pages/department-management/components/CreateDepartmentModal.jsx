import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const CreateDepartmentModal = ({ isOpen, onClose, onCreateDepartment }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'fire',
    description: '',
    contact_email: '',
    contact_phone: '',
    address: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const typeOptions = [
    { value: 'fire', label: 'Fire Department' },
    { value: 'medical', label: 'Medical/EMS' },
    { value: 'police', label: 'Police' },
    { value: 'emergency_management', label: 'Emergency Management' }
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

    if (formData?.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData?.contact_email)) {
      newErrors.contact_email = 'Please enter a valid email address';
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
        name: formData.name,
        type: formData.type,
        description: formData.description,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
        address: formData.address || null
      };

      await onCreateDepartment(departmentData);
      
      // Reset form
      setFormData({
        name: '',
        type: 'fire',
        description: '',
        contact_email: '',
        contact_phone: '',
        address: ''
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
      type: 'fire',
      description: '',
      contact_email: '',
      contact_phone: '',
      address: ''
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

          <Select
            label="Department Type"
            options={typeOptions}
            value={formData?.type}
            onChange={(value) => handleInputChange('type', value)}
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

          <Input
            label="Contact Email"
            type="email"
            placeholder="department@example.com"
            value={formData?.contact_email}
            onChange={(e) => handleInputChange('contact_email', e?.target?.value)}
            error={errors?.contact_email}
            disabled={isSubmitting}
          />

          <Input
            label="Contact Phone"
            type="tel"
            placeholder="09XXXXXXXXX"
            value={formData?.contact_phone}
            onChange={(e) => handleInputChange('contact_phone', e?.target?.value)}
            disabled={isSubmitting}
          />

          <Input
            label="Address"
            type="text"
            placeholder="Department address"
            value={formData?.address}
            onChange={(e) => handleInputChange('address', e?.target?.value)}
            disabled={isSubmitting}
          />

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