import React from 'react';
import Icon from '../../../components/AppIcon';

const PrioritySelector = ({ 
  selectedPriority, 
  onPrioritySelect, 
  error = null 
}) => {
  const priorityLevels = [
    {
      id: 'critical',
      label: 'Critical',
      icon: 'AlertTriangle',
      color: 'text-red-600',
      bgColor: 'bg-red-50 hover:bg-red-100',
      borderColor: 'border-red-300',
      description: 'Life-threatening emergency requiring immediate response'
    },
    {
      id: 'high',
      label: 'High',
      icon: 'AlertCircle',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 hover:bg-orange-100',
      borderColor: 'border-orange-300',
      description: 'Serious situation requiring urgent attention'
    },
    {
      id: 'medium',
      label: 'Medium',
      icon: 'Info',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 hover:bg-yellow-100',
      borderColor: 'border-yellow-300',
      description: 'Important but not immediately life-threatening'
    },
    {
      id: 'low',
      label: 'Low',
      icon: 'Circle',
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100',
      borderColor: 'border-green-300',
      description: 'Non-urgent situation for documentation'
    }
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-3">
          Priority Level <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {priorityLevels?.map((priority) => (
            <button
              key={priority?.id}
              type="button"
              onClick={() => onPrioritySelect(priority?.id)}
              className={`p-4 rounded-lg border-2 transition-emergency text-left ${
                selectedPriority === priority?.id
                  ? `${priority?.borderColor} ${priority?.bgColor} ring-2 ring-offset-2 ring-primary`
                  : `border-border hover:${priority?.borderColor} ${priority?.bgColor}`
              }`}
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className={`${priority?.color}`}>
                  <Icon name={priority?.icon} size={20} />
                </div>
                <h3 className="font-medium text-foreground text-sm">
                  {priority?.label}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {priority?.description}
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

export default PrioritySelector;