import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import LoginHeader from './components/LoginHeader';
import LoginFooter from './components/LoginFooter';
import TrustSignals from './components/TrustSignals';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import { supabase } from '../../lib/supabase';

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signOut, user, profile } = useAuth();
  const { useMock } = useMockData();
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

      // Block suspended accounts only. Pending registrants MUST be able to
      // sign in — their home page hosts the ID-verification card that is the
      // sole submission/resubmission path. Routes.jsx renders SuspendedScreen
      // for suspended profiles as well; this is a belt-and-suspenders check.
      if (!useMock && data?.user) {
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('account_status')
          .eq('id', data.user.id)
          .maybeSingle();
        if (prof?.account_status === 'suspended') {
          await signOut();
          throw new Error('Your account has been suspended. Contact the barangay office if you believe this is a mistake.');
        }
      }

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
    <div className="relative min-h-screen flex items-center justify-center bg-taste-50 p-4">
      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <LoginHeader />
          <LoginForm 
            onLogin={handleLogin}
            isLoading={isLoading}
            error={error}
            onForgotPassword={handleForgotPassword}
            onCreateAccount={handleCreateAccount}
          />
          <TrustSignals />
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-600">
            Kalubihan Emergency Response &copy; {new Date()?.getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
