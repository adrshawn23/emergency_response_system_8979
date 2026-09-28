import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const EmergencyContacts = () => {
  const emergencyContacts = [
    {
      id: 'police',
      name: 'Police Department',
      number: '911',
      description: 'For crimes, violence, and security threats',
      icon: 'Shield',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      available: true
    },
    {
      id: 'fire',
      name: 'Fire Department',
      number: '911',
      description: 'For fires, smoke, and rescue operations',
      icon: 'Flame',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      available: true
    },
    {
      id: 'medical',
      name: 'Emergency Medical',
      number: '911',
      description: 'For medical emergencies and ambulance',
      icon: 'Heart',
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      available: true
    },
    {
      id: 'poison',
      name: 'Poison Control',
      number: '1-800-222-1222',
      description: 'For poisoning and toxic substance exposure',
      icon: 'AlertTriangle',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      available: true
    }
  ];

  const handleCall = (number) => {
    window.open(`tel:${number}`, '_self');
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Icon name="Phone" size={20} className="text-primary" />
        <h3 className="text-lg font-semibold text-foreground">
          Emergency Contacts
        </h3>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        For immediate life-threatening emergencies, call these numbers directly
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {emergencyContacts?.map((contact) => (
          <div
            key={contact?.id}
            className={`p-4 rounded-lg border border-border ${contact?.bgColor} hover:shadow-emergency transition-emergency`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <div className={`${contact?.color} mt-1`}>
                  <Icon name={contact?.icon} size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground text-sm">
                    {contact?.name}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {contact?.description}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-lg font-bold text-foreground">
                      {contact?.number}
                    </span>
                    {contact?.available && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-success rounded-full animate-pulse-subtle"></div>
                        <span className="text-xs text-success font-medium">Available</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCall(contact?.number)}
                iconName="Phone"
                className="flex-shrink-0 ml-2"
              >
                Call
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 p-4 bg-warning/10 border border-warning/20 rounded-lg">
        <div className="flex items-start space-x-2">
          <Icon name="AlertTriangle" size={16} className="text-warning mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Important Notice
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This emergency report system supplements but does not replace direct emergency calls. 
              For immediate life-threatening situations, always call 911 first.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyContacts;