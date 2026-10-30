import React from 'react';
import Icon from '../../../components/AppIcon';

const LoginHeader = () => {
  return (
    <div className="text-center mb-8">
      <div className="flex items-center justify-center mb-5">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-red-600">
          <Icon name="Siren" size={30} color="white" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2 tracking-tight">
        Emergency Response
      </h1>

      <p className="text-muted-foreground text-sm">
        Sign in to your command dashboard
      </p>

      <div className="mt-4 p-3 bg-taste-50 border border-taste-200 rounded-lg">
        <div className="flex items-center justify-center space-x-2">
          <Icon name="ShieldCheck" size={16} className="text-taste-600" />
          <p className="text-xs text-taste-700 font-medium">
            Secure access for authorized personnel only
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginHeader;