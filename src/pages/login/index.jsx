import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import LoginHeader from './components/LoginHeader';
import LoginFooter from './components/LoginFooter';
import TrustSignals from './components/TrustSignals';
import MockCredentials from './components/MockCredentials';

const Login = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Mock user database for authentication
  const mockUsers = [
    {
      email: 'admin@emergency.gov',
      password: 'admin123',
      role: 'admin',
      name: 'System Administrator',
      id: 1
    },
    {
      email: 'dispatcher@emergency.gov',
      password: 'dispatch123',
      role: 'dispatcher',
      name: 'Emergency Dispatcher',
      id: 2
    },
    {
      email: 'responder@emergency.gov',
      password: 'respond123',
      role: 'responder',
      name: 'First Responder',
      id: 3
    },
    {
      email: 'resident@community.com',
      password: 'resident123',
      role: 'resident',
      name: 'Community Resident',
      id: 4
    }
  ];

  const handleLogin = async (formData) => {
    setIsLoading(true);
    setError('');

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Find user in mock database
      const user = mockUsers?.find(
        u => u?.email?.toLowerCase() === formData?.email?.toLowerCase() && 
             u?.password === formData?.password
      );

      if (user) {
        // Store user data in localStorage (in real app, use secure token storage)
        localStorage.setItem('currentUser', JSON.stringify({
          id: user?.id,
          name: user?.name,
          email: user?.email,
          role: user?.role,
          loginTime: new Date()?.toISOString()
        }));

        // Navigate based on user role
        switch (user?.role) {
          case 'admin': navigate('/user-management');
            break;
          case 'dispatcher': navigate('/report-management');
            break;
          case 'responder': navigate('/report-management');
            break;
          case 'resident': navigate('/emergency-report');
            break;
          default:
            navigate('/');
        }
      } else {
        setError('Invalid email or password. Please check your credentials and try again.');
      }
    } catch (err) {
      setError('Login failed. Please try again later.');
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

  const handleUseCredentials = (email, password) => {
    // Auto-fill the form with selected credentials
    const event = { target: { name: 'email', value: email } };
    document.querySelector('input[name="email"]').value = email;
    document.querySelector('input[name="password"]').value = password;
    
    // Trigger change events to update form state
    const emailInput = document.querySelector('input[name="email"]');
    const passwordInput = document.querySelector('input[name="password"]');
    
    emailInput?.dispatchEvent(new Event('input', { bubbles: true }));
    passwordInput?.dispatchEvent(new Event('input', { bubbles: true }));
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
          
          <MockCredentials onUseCredentials={handleUseCredentials} />
          
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