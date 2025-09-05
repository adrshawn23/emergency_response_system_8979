import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const MockCredentials = ({ onUseCredentials }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const mockUsers = [
    {
      role: 'Admin',
      email: 'admin@emergency.gov',
      password: 'admin123',
      description: 'Full system access and management'
    },
    {
      role: 'Dispatcher',
      email: 'dispatcher@emergency.gov',
      password: 'dispatch123',
      description: 'Coordinate emergency responses'
    },
    {
      role: 'Responder',
      email: 'responder@emergency.gov',
      password: 'respond123',
      description: 'Handle emergency incidents'
    },
    {
      role: 'Resident',
      email: 'resident@community.com',
      password: 'resident123',
      description: 'Report emergencies and receive alerts'
    }
  ];

  const getRoleColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'text-error';
      case 'dispatcher': return 'text-warning';
      case 'responder': return 'text-accent';
      case 'resident': return 'text-primary';
      default: return 'text-foreground';
    }
  };

  const getRoleIcon = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'Crown';
      case 'dispatcher': return 'Radio';
      case 'responder': return 'Truck';
      case 'resident': return 'Home';
      default: return 'User';
    }
  };

  return (
    <div className="mt-6 p-4 bg-muted/50 border border-border rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center space-x-2">
          <Icon name="TestTube" size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Demo Credentials</span>
        </div>
        <Icon 
          name={isExpanded ? "ChevronUp" : "ChevronDown"} 
          size={16} 
          className="text-muted-foreground" 
        />
      </button>
      {isExpanded && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Use these credentials to test different user roles:
          </p>
          
          {mockUsers?.map((user, index) => (
            <div key={index} className="p-3 bg-background border border-border rounded-md">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Icon 
                    name={getRoleIcon(user?.role)} 
                    size={14} 
                    className={getRoleColor(user?.role)} 
                  />
                  <span className={`text-sm font-medium ${getRoleColor(user?.role)}`}>
                    {user?.role}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onUseCredentials(user?.email, user?.password)}
                  iconName="Copy"
                  iconPosition="left"
                >
                  Use
                </Button>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs text-foreground font-mono">
                  Email: {user?.email}
                </p>
                <p className="text-xs text-foreground font-mono">
                  Password: {user?.password}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.description}
                </p>
              </div>
            </div>
          ))}
          
          <div className="mt-3 p-2 bg-warning/10 border border-warning/20 rounded-md">
            <div className="flex items-center space-x-2">
              <Icon name="AlertTriangle" size={12} className="text-warning" />
              <p className="text-xs text-warning">
                These are demo credentials for testing purposes only
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MockCredentials;