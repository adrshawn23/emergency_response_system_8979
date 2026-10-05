import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const UserModal = ({ 
  isOpen = false, 
  onClose = () => {}, 
  user = null, 
  onSave = () => {},
  mode = 'view' // 'view', 'edit', 'create'
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    status: 'active',
    address: '',
    emergencyContact: '',
    emergencyPhone: ''
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const roleOptions = [
    { value: 'admin', label: 'Administrator' },
    { value: 'dispatcher', label: 'Dispatcher' },
    { value: 'responder', label: 'Responder' },
    { value: 'resident', label: 'Resident' }
  ];

  const departmentOptions = [
    { value: 'fire', label: 'Fire Department' },
    { value: 'police', label: 'Police Department' },
    { value: 'medical', label: 'Medical Services' },
    { value: 'admin', label: 'Administration' }
  ];

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' }
  ];

  useEffect(() => {
    if (user && (mode === 'edit' || mode === 'view')) {
      setFormData({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        role: user?.role || '',
        department: user?.department || '',
        status: user?.status || 'active',
        address: user?.address || '',
        emergencyContact: user?.emergencyContact || '',
        emergencyPhone: user?.emergencyPhone || ''
      });
    } else if (mode === 'create') {
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: '',
        department: '',
        status: 'active',
        address: '',
        emergencyContact: '',
        emergencyPhone: ''
      });
    }
    setErrors({});
  }, [user, mode, isOpen]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors?.[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData?.name?.trim()) newErrors.name = 'Name is required';
    if (!formData?.email?.trim()) newErrors.email = 'Email is required';
    if (!formData?.role) newErrors.role = 'Role is required';
    if (!formData?.department) newErrors.department = 'Department is required';
    if (!formData?.phone?.trim()) {
      newErrors.phone = 'Phone is required';
    } else if (!/^0\d{10}$/.test(formData?.phone)) {
      newErrors.phone = 'Please enter a valid 11-digit phone number starting with 0 (e.g., 09948270026)';
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData?.email && !emailRegex?.test(formData?.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving user:', error);
    } finally {
      setIsLoading(false);
    }
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

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: 'bg-success text-success-foreground', label: 'Active' },
      inactive: { color: 'bg-muted text-muted-foreground', label: 'Inactive' },
      suspended: { color: 'bg-destructive text-destructive-foreground', label: 'Suspended' }
    };
    
    const config = statusConfig?.[status] || statusConfig?.inactive;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config?.color}`}>
        {config?.label}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
      <div className="bg-card rounded-lg border border-border shadow-emergency-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg ${
                mode === 'create' ? 'bg-primary/10' : 'bg-muted'
              } flex items-center justify-center`}>
                <Icon 
                  name={mode === 'create' ? 'UserPlus' : getRoleIcon(formData?.role)} 
                  size={20} 
                  className={mode === 'create' ? 'text-primary' : 'text-foreground'} 
                />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {mode === 'create' ? 'Add New User' : 
                   mode === 'edit' ? 'Edit User' : 'User Details'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {mode === 'create' ? 'Create a new user account' :
                   mode === 'edit' ? 'Update user information' : 'View user information'}
                </p>
              </div>
            </div>
            
            <Button variant="ghost" size="sm" onClick={onClose} iconName="X" />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {mode === 'view' ? (
            // View Mode
            (<div className="space-y-6">
              {/* User Avatar and Basic Info */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Image
                    src={user?.avatar}
                    alt={user?.name}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                  {user?.isOnline && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success border-2 border-card rounded-full"></div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">{user?.name}</h3>
                  <p className="text-muted-foreground">{user?.email}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    {getStatusBadge(user?.status)}
                    <span className="text-sm text-muted-foreground">•</span>
                    <span className="text-sm text-foreground capitalize">{user?.role}</span>
                  </div>
                </div>
              </div>
              {/* User Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="text-foreground">{user?.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Department</label>
                    <p className="text-foreground">{user?.department?.name || user?.department || 'Not assigned'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Registration Date</label>
                    <p className="text-foreground">
                      {user?.registrationDate ? new Date(user.registrationDate)?.toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                    <p className="text-foreground">{user?.address || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Emergency Contact</label>
                    <p className="text-foreground">{user?.emergencyContact || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Active</label>
                    <p className="text-foreground">
                      {user?.lastActive ? new Date(user.lastActive)?.toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
            </div>)
          ) : (
            // Edit/Create Mode
            (<div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  type="text"
                  value={formData?.name}
                  onChange={(e) => handleInputChange('name', e?.target?.value)}
                  error={errors?.name}
                  required
                  disabled={mode === 'view'}
                />
                
                <Input
                  label="Email Address"
                  type="email"
                  value={formData?.email}
                  onChange={(e) => handleInputChange('email', e?.target?.value)}
                  error={errors?.email}
                  required
                  disabled={mode === 'view'}
                />
                
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="09948270026"
                  value={formData?.phone}
                  onChange={(e) => handleInputChange('phone', e?.target?.value)}
                  error={errors?.phone}
                  required
                  disabled={mode === 'view'}
                  pattern="[0-9]{11}"
                  maxLength={11}
                />
                
                <Select
                  label="Role"
                  options={roleOptions}
                  value={formData?.role}
                  onChange={(value) => handleInputChange('role', value)}
                  error={errors?.role}
                  required
                  disabled={mode === 'view'}
                />
                
                <Select
                  label="Department"
                  options={departmentOptions}
                  value={formData?.department}
                  onChange={(value) => handleInputChange('department', value)}
                  error={errors?.department}
                  required
                  disabled={mode === 'view'}
                />
                
                <Select
                  label="Status"
                  options={statusOptions}
                  value={formData?.status}
                  onChange={(value) => handleInputChange('status', value)}
                  disabled={mode === 'view'}
                />
              </div>
              <Input
                label="Address"
                type="text"
                value={formData?.address}
                onChange={(e) => handleInputChange('address', e?.target?.value)}
                disabled={mode === 'view'}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Emergency Contact Name"
                  type="text"
                  value={formData?.emergencyContact}
                  onChange={(e) => handleInputChange('emergencyContact', e?.target?.value)}
                  disabled={mode === 'view'}
                />
                
                <Input
                  label="Emergency Contact Phone"
                  type="tel"
                  placeholder="09948270026"
                  value={formData?.emergencyPhone}
                  onChange={(e) => handleInputChange('emergencyPhone', e?.target?.value)}
                  disabled={mode === 'view'}
                  pattern="[0-9]{11}"
                  maxLength={11}
                />
              </div>
            </div>)
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>
            {mode === 'view' ? 'Close' : 'Cancel'}
          </Button>
          
          {mode !== 'view' && (
            <Button 
              onClick={handleSave} 
              loading={isLoading}
              iconName={mode === 'create' ? 'UserPlus' : 'Save'}
            >
              {mode === 'create' ? 'Create User' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserModal;