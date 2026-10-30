import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useMockData } from '../../contexts/MockDataContext';
import { supabase } from '../../lib/supabase';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { useMock } = useMockData();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      if (useMock) {
        // Mock mode: no real email provider — simulate success.
        setSent(true);
        return;
      }
      // supabase-js fetch has no default timeout — a dead network would leave
      // the button spinning forever, so race it against a hard timeout.
      const { error: resetError } = await Promise.race([
        supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), 20000)
        ),
      ]);
      if (resetError) {
        setError(resetError.message || 'Could not send reset email. Try again.');
        return;
      }
      setSent(true);
    } catch (err) {
      setError('Could not send reset email. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8">
        <div className="mb-6 flex justify-center">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-taste-500 text-white">
            <Icon name="ShieldCheck" size={28} />
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Enter the email tied to your account and we'll send a reset link.
        </p>

        {sent ? (
          <div className="mt-6">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <Icon name="CheckCircle" size={20} className="mt-0.5 shrink-0 text-emerald-600" />
              <p className="text-sm text-emerald-700">
                If an account exists for <span className="font-semibold">{email}</span>,
                a password reset link has been sent. Check your inbox and spam folder.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="mt-6 w-full rounded-xl bg-taste-500 px-4 py-3 text-sm font-semibold text-white hover:bg-taste-600"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="reset-email" className="mb-2 block text-sm font-semibold">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-taste-500 focus:ring-2 focus:ring-taste-100"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-taste-500 px-4 py-3 text-sm font-semibold text-white hover:bg-taste-600 disabled:opacity-60"
            >
              {isLoading ? 'Sending reset link…' : 'Send reset link'}
            </button>
            <p className="text-center text-sm">
              <Link to="/login" className="font-semibold text-taste-700 hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
