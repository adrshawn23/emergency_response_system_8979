import React from 'react';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';

const RoleSelectionSection = ({ 
  formData, 
  errors, 
  onChange,
  departments = []
}) => {
  // Self-registration is resident-only — staff accounts (responder,
  // dispatcher, department_admin, admin) are provisioned by administrators.
  const roleOptions = [
    {
      value: 'resident',
      label: 'Resident/Boarder',
      description: 'Community member who can report emergencies and receive alerts'
    }
  ];

  // Roles that must pick a department at registration
  const deptRoles = ['responder', 'department_admin'];
  const needsDepartment = deptRoles.includes(formData?.role);

  const departmentOptions = departments.map(d => ({
    value: d.id,
    label: d.name,
  }));

  const getRoleIcon = (role) => {
    switch (role) {
      case 'resident': return 'Home';
      case 'responder': return 'Shield';
      case 'dispatcher': return 'Radio';
      case 'department_admin': return 'Building2';
      case 'admin': return 'Crown';
      default: return 'User';
    }
  };

  const getRoleRequirements = (role) => {
    switch (role) {
      case 'resident':
        return {
          approval: true,
          requirements: ['Valid ID verification', 'Address confirmation'],
          timeline: 'Account activation follows administrator review'
        };
      case 'responder':
        return {
          approval: true,
          requirements: ['Valid ID verification', 'Professional certification', 'Department verification', 'Background check'],
          timeline: '3-5 business days for approval'
        };
      case 'dispatcher':
        return {
          approval: true,
          requirements: ['Valid ID verification', 'Emergency services training certificate', 'Department authorization'],
          timeline: '2-4 business days for approval'
        };
      case 'department_admin':
        return {
          approval: true,
          requirements: ['Valid ID verification', 'Department assignment', 'Administrator review'],
          timeline: '3-5 business days for approval'
        };
      case 'admin':
        return {
          approval: true,
          requirements: ['Valid ID verification', 'System administrator authorization'],
          timeline: 'Reviewed only by existing administrators'
        };
      default:
        return { approval: false, requirements: [], timeline: '' };
    }
  };

  const selectedRoleInfo = getRoleRequirements(formData?.role);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Role Selection</h3>
        
        <Select
          label="Select Your Role"
          description="Public registration is for residents and boarders — staff accounts are created by administrators."
          options={roleOptions}
          value={formData?.role}
          onChange={(value) => onChange({ target: { name: 'role', value } })}
          error={errors?.role}
          placeholder="Select your role..."
          required
          className="w-full"
        />
      </div>

      {needsDepartment && (
        <div>
          <Select
            label="Department"
            description="Choose the department you belong to — an administrator still confirms the assignment at approval."
            options={departmentOptions}
            value={formData?.departmentId}
            onChange={(value) => onChange({ target: { name: 'departmentId', value } })}
            error={errors?.departmentId}
            placeholder="Select your department..."
            required
            className="w-full"
          />
        </div>
      )}
      {formData?.role && (
        <div className="bg-muted rounded-lg p-4 border border-border">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 p-2 bg-primary rounded-lg">
              <Icon name={getRoleIcon(formData?.role)} size={20} color="white" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-foreground mb-2">
                {roleOptions?.find(r => r?.value === formData?.role)?.label} Requirements
              </h4>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Required Documents:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {selectedRoleInfo?.requirements?.map((req, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <Icon name="Check" size={14} className="text-success" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center space-x-2 p-3 bg-card rounded-md border border-border">
                  <Icon 
                    name={selectedRoleInfo?.approval ? "Clock" : "CheckCircle"} 
                    size={16} 
                    className={selectedRoleInfo?.approval ? "text-warning" : "text-success"}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {selectedRoleInfo?.approval ? 'Approval Required' : 'Instant Activation'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedRoleInfo?.timeline}
                    </p>
                  </div>
                </div>

                {selectedRoleInfo?.approval && (
                  <div className="bg-warning/10 border border-warning/20 rounded-md p-3">
                    <div className="flex items-start space-x-2">
                      <Icon name="AlertTriangle" size={16} className="text-warning mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-warning">Administrative Approval Required</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Your account will be reviewed by system administrators before activation. 
                          You'll receive an email notification once approved.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleSelectionSection;
