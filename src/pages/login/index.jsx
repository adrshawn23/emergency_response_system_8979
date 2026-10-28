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

      // Block unapproved accounts: admin approval flips user_profiles.status
      // to 'active'. Without this check a pending registrant could sign in
      // and use the app before review.
      if (!useMock && data?.user) {
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('status')
          .eq('id', data.user.id)
          .maybeSingle();
        if (prof && prof.status !== 'active') {
          await signOut();
          throw new Error('Your account is pending administrator approval. You can sign in once it is activated.');
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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-900 p-4">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-indigo-600/30 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full bg-rose-500/20 blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-violet-600/20 blur-[100px]" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur-xl">
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
          <p className="text-xs text-slate-300">
            Kalubihan Emergency Response &copy; {new Date()?.getFullYear()}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Secure • Reliable • Always Ready
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
