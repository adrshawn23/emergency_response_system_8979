import React from 'react';
import Input from '../../../components/ui/Input';

// Sitios and streets within Barangay Kalubihan — picked from a dropdown so
// the stored address uses the canonical spelling (helps ID-address match).
const SITIOS = [
  'Kalubihan Proper',
  'Sanciangko',
  'Leon Kilat',
  'Pelaez',
  'P. Lopez',
  'Osmeña Blvd',
  'Borromeo St',
];

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
          description="Approval or rejection of your account is emailed here — use a real address you can access (Gmail, Yahoo, Outlook, etc.)"
          required
          className="w-full"
        />
        
        <Input
          label="Phone Number"
          type="tel"
          name="phone"
          placeholder="09948270026"
          value={formData?.phone}
          onChange={onChange}
          error={errors?.phone}
          description="Required for emergency communications (11 digits, starting with 0)"
          required
          className="w-full"
          pattern="[0-9]{11}"
          maxLength={11}
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

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="residencyType">
            Residency Type <span className="text-destructive">*</span>
          </label>
          <select
            id="residencyType"
            name="residencyType"
            value={formData?.residencyType || 'resident'}
            onChange={onChange}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="resident">Resident — I live at my Kalubihan home address</option>
            <option value="boarder">Boarder — I rent/room in Kalubihan; my ID shows my home address</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {formData?.residencyType === 'boarder'
              ? 'Boarders: the address below is your Kalubihan boarding address. Your ID may show a home address outside Kalubihan — an administrator will verify your boarding situation.'
              : 'Residents: the address below must match the address on your ID.'}
          </p>
          {errors?.residencyType && <p className="mt-1 text-xs text-destructive">{errors.residencyType}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="sitio">
          Sitio / Street <span className="text-destructive">*</span>
        </label>
        <select
          id="sitio"
          name="sitio"
          value={formData?.sitio || ''}
          onChange={onChange}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="" disabled>Select your sitio or street</option>
          {SITIOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick the sitio or street your {formData?.residencyType === 'boarder' ? 'boarding' : 'Kalubihan'} address is on.
        </p>
        {errors?.sitio && <p className="mt-1 text-xs text-destructive">{errors.sitio}</p>}
      </div>
      {/* Free-text Address input temporarily removed — the sitio/street
          dropdown is the stored location for now. Restore the block (and
          the address validation in register/index.jsx) when re-enabled. */}
    </div>
  );
};

export default PersonalInfoSection;