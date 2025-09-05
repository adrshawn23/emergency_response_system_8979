import React from 'react';
import Button from '../../../components/ui/Button';

const LoginFooter = ({ onForgotPassword, onCreateAccount }) => {
  return (
    <div className="mt-6 space-y-4">
      <div className="text-center">
        <Button
          variant="link"
          size="sm"
          onClick={onForgotPassword}
          iconName="Key"
          iconPosition="left"
        >
          Forgot Password?
        </Button>
      </div>
      
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            New to the system?
          </span>
        </div>
      </div>
      
      <div className="text-center">
        <Button
          variant="outline"
          size="lg"
          fullWidth
          onClick={onCreateAccount}
          iconName="UserPlus"
          iconPosition="left"
        >
          Create Account
        </Button>
      </div>
      
      <div className="text-center mt-4">
        <p className="text-xs text-muted-foreground">
          By signing in, you agree to our emergency response protocols
        </p>
      </div>
    </div>
  );
};

export default LoginFooter;