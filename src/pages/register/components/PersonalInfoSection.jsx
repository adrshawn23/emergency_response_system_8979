import React from 'react';
import Input from '../../../components/ui/Input';

const PersonalInfoSection = ({ 
  formData, 
  errors, 
  onChange 
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name"
            type="text"
            name="firstName"
            placeholder="Enter your first name"
            value={formData?.firstName}
            onChange={onChange}
            error={errors?.firstName}
            required
            className="w-full"
          />
          
          <Input
            label="Last Name"
            type="text"
            name="lastName"
            placeholder="Enter your last name"
            value={formData?.lastName}
            onChange={onChange}
            error={errors?.lastName}
            required
            className="w-full"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Email Address"
          type="email"
          name="email"
          placeholder="Enter your email address"
          value={formData?.email}
          onChange={onChange}
          error={errors?.email}
          description="We'll use this for account verification and notifications"
          required
          className="w-full"
        />
        
        <Input
          label="Phone Number"
          type="tel"
          name="phone"
          placeholder="(555) 123-4567"
          value={formData?.phone}
          onChange={onChange}
          error={errors?.phone}
          description="Required for emergency communications"
          required
          className="w-full"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Date of Birth"
          type="date"
          name="dateOfBirth"
          value={formData?.dateOfBirth}
          onChange={onChange}
          error={errors?.dateOfBirth}
          required
          className="w-full"
        />
        
        <Input
          label="Address"
          type="text"
          name="address"
          placeholder="Enter your full address"
          value={formData?.address}
          onChange={onChange}
          error={errors?.address}
          description="Required for location-based emergency services"
          required
          className="w-full"
        />
      </div>
    </div>
  );
};

export default PersonalInfoSection;