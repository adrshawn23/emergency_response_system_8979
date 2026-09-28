import React from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const EmergencyContactSection = ({ 
  formData, 
  errors, 
  onChange 
}) => {
  const relationshipOptions = [
    { value: 'spouse', label: 'Spouse' },
    { value: 'parent', label: 'Parent' },
    { value: 'child', label: 'Child' },
    { value: 'sibling', label: 'Sibling' },
    { value: 'relative', label: 'Other Relative' },
    { value: 'friend', label: 'Friend' },
    { value: 'colleague', label: 'Colleague' },
    { value: 'neighbor', label: 'Neighbor' },
    { value: 'other', label: 'Other' }
  ];

  const addEmergencyContact = () => {
    const newContact = {
      id: Date.now(),
      name: '',
      phone: '',
      email: '',
      relationship: '',
      isPrimary: formData?.emergencyContacts?.length === 0
    };
    
    onChange({
      target: {
        name: 'emergencyContacts',
        value: [...formData?.emergencyContacts, newContact]
      }
    });
  };

  const removeEmergencyContact = (contactId) => {
    const updatedContacts = formData?.emergencyContacts?.filter(contact => contact?.id !== contactId);
    // If we removed the primary contact, make the first remaining contact primary
    if (updatedContacts?.length > 0 && !updatedContacts?.some(c => c?.isPrimary)) {
      updatedContacts[0].isPrimary = true;
    }
    
    onChange({
      target: {
        name: 'emergencyContacts',
        value: updatedContacts
      }
    });
  };

  const updateEmergencyContact = (contactId, field, value) => {
    const updatedContacts = formData?.emergencyContacts?.map(contact => {
      if (contact?.id === contactId) {
        // If setting this contact as primary, unset others
        if (field === 'isPrimary' && value) {
          return { ...contact, [field]: value };
        }
        return { ...contact, [field]: value };
      } else if (field === 'isPrimary' && value) {
        // Unset primary for other contacts
        return { ...contact, isPrimary: false };
      }
      return contact;
    });
    
    onChange({
      target: {
        name: 'emergencyContacts',
        value: updatedContacts
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Emergency Contacts</h3>
            <p className="text-sm text-muted-foreground">
              Add people who should be notified in case of emergency situations
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addEmergencyContact}
            iconName="Plus"
            iconPosition="left"
            disabled={formData?.emergencyContacts?.length >= 3}
          >
            Add Contact
          </Button>
        </div>

        {formData?.emergencyContacts?.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
            <Icon name="Users" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-4">No emergency contacts added yet</p>
            <Button
              variant="outline"
              size="sm"
              onClick={addEmergencyContact}
              iconName="Plus"
              iconPosition="left"
            >
              Add Your First Contact
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {formData?.emergencyContacts?.map((contact, index) => (
              <div key={contact?.id} className="border border-border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-medium text-foreground">
                      Emergency Contact {index + 1}
                    </h4>
                    {contact?.isPrimary && (
                      <span className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                        Primary
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEmergencyContact(contact?.id)}
                    className="text-destructive hover:text-destructive"
                    iconName="Trash2"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    type="text"
                    placeholder="Enter contact's full name"
                    value={contact?.name}
                    onChange={(e) => updateEmergencyContact(contact?.id, 'name', e?.target?.value)}
                    error={errors?.[`emergencyContact_${contact?.id}_name`]}
                    required
                    className="w-full"
                  />

                  <Input
                    label="Phone Number"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={contact?.phone}
                    onChange={(e) => updateEmergencyContact(contact?.id, 'phone', e?.target?.value)}
                    error={errors?.[`emergencyContact_${contact?.id}_phone`]}
                    required
                    className="w-full"
                  />

                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="contact@example.com"
                    value={contact?.email}
                    onChange={(e) => updateEmergencyContact(contact?.id, 'email', e?.target?.value)}
                    error={errors?.[`emergencyContact_${contact?.id}_email`]}
                    description="Optional but recommended"
                    className="w-full"
                  />

                  <Select
                    label="Relationship"
                    options={relationshipOptions}
                    value={contact?.relationship}
                    onChange={(value) => updateEmergencyContact(contact?.id, 'relationship', value)}
                    error={errors?.[`emergencyContact_${contact?.id}_relationship`]}
                    placeholder="Select relationship..."
                    required
                    className="w-full"
                  />
                </div>

                {formData?.emergencyContacts?.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="primaryContact"
                        checked={contact?.isPrimary}
                        onChange={(e) => updateEmergencyContact(contact?.id, 'isPrimary', e?.target?.checked)}
                        className="w-4 h-4 text-primary border-border focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">Set as primary contact</span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">
                      Primary contact will be notified first in emergencies
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {formData?.emergencyContacts?.length > 0 && formData?.emergencyContacts?.length < 3 && (
          <div className="text-center pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={addEmergencyContact}
              iconName="Plus"
              iconPosition="left"
            >
              Add Another Contact ({formData?.emergencyContacts?.length}/3)
            </Button>
          </div>
        )}

        <div className="mt-4 p-4 bg-muted rounded-lg border border-border">
          <div className="flex items-start space-x-3">
            <Icon name="Info" size={20} className="text-primary mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-foreground mb-1">Emergency Contact Guidelines</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• At least one emergency contact is recommended</li>
                <li>• Primary contact will be notified first in emergency situations</li>
                <li>• Contacts should be people who can be reached 24/7</li>
                <li>• You can add up to 3 emergency contacts</li>
                <li>• Contact information is kept secure and only used for emergencies</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyContactSection;