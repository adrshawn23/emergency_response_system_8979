import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import LoginHeader from './components/LoginHeader';
import LoginFooter from './components/LoginFooter';
import TrustSignals from './components/TrustSignals';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import Icon from '../../components/AppIcon';

const Login = () => {
  const navigate = useNavigate();
  const { signIn, user, profile } = useAuth();
  const { useMock, toggleMockMode } = useMockData();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { 
    if (user && profile) {
      navigate('/', { replace: true }); 
    }
  }, [user, profile, navigate]);

  const handleLogin = async (formData) => {
    setIsLoading(true);
    setError('');

    try {
      const { data, error: authError } = await signIn(formData.email.trim(), formData.password);
      if (authError) throw authError;
      
      // Navigate to home page - ProtectedRoute will handle role-based redirects
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.message || 'Login failed. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  const handleCreateAccount = () => {
    navigate('/register');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Mock Mode Toggle */}
        <div className="mb-4 flex justify-end">
          <button
            onClick={toggleMockMode}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-emergency ${
              useMock 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            title={useMock ? 'Mock Mode Enabled' : 'Live Mode Enabled'}
          >
            <Icon name={useMock ? 'Database' : 'Cloud'} size={16} />
            <span>{useMock ? 'Mock Mode' : 'Live Mode'}</span>
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-emergency-lg p-8">
          <LoginHeader />
          
          <LoginForm 
            onLogin={handleLogin}
            isLoading={isLoading}
            error={error}
            onForgotPassword={handleForgotPassword}
            onCreateAccount={handleCreateAccount}
          />
          {useMock && (
            <button
              type="button"
              onClick={() => handleLogin({ email: 'admin@emergency.gov', password: 'mock-admin' })}
              className="mt-4 w-full rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              Open demo Administrator account
            </button>
          )}
          {!useMock && (
            <p className="mt-4 rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
              You are in Live Mode. Sign in with an account created in Supabase, or switch to Mock Mode above to use the demo Administrator account.
            </p>
          )}
          
          <TrustSignals />
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Emergency Response System &copy; {new Date()?.getFullYear()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Secure • Reliable • Always Ready
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
