import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import LoginHeader from './components/LoginHeader';
import LoginFooter from './components/LoginFooter';
import TrustSignals from './components/TrustSignals';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const Login = () => {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (user) navigate('/', { replace: true }); }, [user, navigate]);

  const handleLogin = async (formData) => {
    setIsLoading(true);
    setError('');

    try {
      const { data, error: authError } = await signIn(formData.email.trim(), formData.password);
      if (authError) throw authError;
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', data.user.id).single();
      if (profile?.is_active === false) {
        await supabase.auth.signOut();
        throw new Error('Your account is awaiting administrator approval.');
      }
      navigate(profile?.role === 'resident' ? '/emergency-report' : '/report-management', { replace: true });
    } catch (err) {
      setError(err?.message || 'Login failed. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // In a real app, this would navigate to forgot password page
    alert('Forgot password functionality would redirect to password recovery page.');
  };

  const handleCreateAccount = () => {
    navigate('/register');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-xl shadow-emergency-lg p-8">
          <LoginHeader />
          
          <LoginForm 
            onLogin={handleLogin}
            isLoading={isLoading}
            error={error}
          />
          
          <LoginFooter 
            onForgotPassword={handleForgotPassword}
            onCreateAccount={handleCreateAccount}
          />
          
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
