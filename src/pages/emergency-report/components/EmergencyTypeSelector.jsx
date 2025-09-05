import React from 'react';
import Icon from '../../../components/AppIcon';

const EmergencyTypeSelector = ({ 
  selectedType, 
  onTypeSelect, 
  error = null 
}) => {
  const emergencyTypes = [
    {
      id: 'fire',
      label: 'Fire Emergency',
      icon: 'Flame',
      color: 'text-red-600',
      bgColor: 'bg-red-50 hover:bg-red-100',
      borderColor: 'border-red-200',
      description: 'Building fires, wildfires, smoke'
    },
    {
      id: 'medical',
      label: 'Medical Emergency',
      icon: 'Heart',
      color: 'text-pink-600',
      bgColor: 'bg-pink-50 hover:bg-pink-100',
      borderColor: 'border-pink-200',
      description: 'Injuries, illness, accidents'
    },
    {
      id: 'police',
      label: 'Police Emergency',
      icon: 'Shield',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
      borderColor: 'border-blue-200',
      description: 'Crime, violence, security threats'
    },
    {
      id: 'natural',
      label: 'Natural Disaster',
      icon: 'CloudRain',
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100',
      borderColor: 'border-green-200',
      description: 'Floods, storms, earthquakes'
    },
    {
      id: 'utility',
      label: 'Utility Emergency',
      icon: 'Zap',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 hover:bg-yellow-100',
      borderColor: 'border-yellow-200',
      description: 'Power outages, gas leaks, water issues'
    },
    {
      id: 'traffic',
      label: 'Traffic Accident',
      icon: 'Car',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 hover:bg-orange-100',
      borderColor: 'border-orange-200',
      description: 'Vehicle accidents, road hazards'
    },
    {
      id: 'hazmat',
      label: 'Hazardous Materials',
      icon: 'AlertTriangle',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100',
      borderColor: 'border-purple-200',
      description: 'Chemical spills, toxic substances'
    },
    {
      id: 'other',
      label: 'Other Emergency',
      icon: 'HelpCircle',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 hover:bg-gray-100',
      borderColor: 'border-gray-200',
      description: 'Other urgent situations'
    }
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-3">
          Emergency Type <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {emergencyTypes?.map((type) => (
            <button
              key={type?.id}
              type="button"
              onClick={() => onTypeSelect(type?.id)}
              className={`p-4 rounded-lg border-2 transition-emergency text-left ${
                selectedType === type?.id
                  ? `${type?.borderColor} ${type?.bgColor} ring-2 ring-offset-2 ring-primary`
                  : `border-border hover:${type?.borderColor} ${type?.bgColor}`
              }`}
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className={`${type?.color}`}>
                  <Icon name={type?.icon} size={20} />
                </div>
                <h3 className="font-medium text-foreground text-sm">
                  {type?.label}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {type?.description}
              </p>
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive flex items-center space-x-1">
          <Icon name="AlertCircle" size={16} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

export default EmergencyTypeSelector;