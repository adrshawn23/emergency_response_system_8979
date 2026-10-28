import React from 'react';
import Icon from '../../../components/AppIcon';

const LoginHeader = () => {
  return (
    <div className="text-center mb-8">
      <div className="flex items-center justify-center mb-5">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-rose-500 shadow-glow-primary">
          <Icon name="Siren" size={30} color="white" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2 tracking-tight">
        Emergency Response
      </h1>

      <p className="text-muted-foreground text-sm">
        Sign in to your command dashboard
      </p>

      <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
        <div className="flex items-center justify-center space-x-2">
          <Icon name="ShieldCheck" size={16} className="text-indigo-600" />
          <p className="text-xs text-indigo-700 font-medium">
            Secure access for authorized personnel only
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginHeader;