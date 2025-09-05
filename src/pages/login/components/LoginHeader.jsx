import React from 'react';
import Icon from '../../../components/AppIcon';

const LoginHeader = () => {
  return (
    <div className="text-center mb-8">
      <div className="flex items-center justify-center mb-4">
        <div className="flex items-center justify-center w-16 h-16 bg-primary rounded-xl shadow-emergency">
          <Icon name="Shield" size={32} color="white" />
        </div>
      </div>
      
      <h1 className="text-2xl font-bold text-foreground mb-2">
        Emergency Response System
      </h1>
      
      <p className="text-muted-foreground text-sm">
        Sign in to access your emergency response dashboard
      </p>
      
      <div className="mt-4 p-3 bg-accent/10 border border-accent/20 rounded-lg">
        <div className="flex items-center justify-center space-x-2">
          <Icon name="Info" size={16} className="text-accent" />
          <p className="text-xs text-accent font-medium">
            Secure access for authorized personnel only
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginHeader;