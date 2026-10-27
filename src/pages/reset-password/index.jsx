import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useMockData } from '../../contexts/MockDataContext';
import { supabase } from '../../lib/supabase';

// Landing page for the Supabase recovery link sent by /forgot-password.
// supabase-js auto-exchanges the token in the URL hash and emits a
// PASSWORD_RECOVERY auth event; only then is updateUser allowed.
const ResetPassword = () => {
  const navigate = useNavigate();
  const { useMock } = useMockData();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (useMock) {
      setReady(true);
      return;
    }
    // Recovery link clicked → session established + PASSWORD_RECOVERY event.
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // If the user already has a valid recovery session (e.g. page refresh),
    // getSession returns one without a second event.
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setReady(true);
    });
    return () => subscription?.subscription?.unsubscribe?.();
  }, [useMock]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      if (useMock) {
        setDone(true);
        return;
      }
      const { error: updateError } = await Promise.race([
        supabase.auth.updateUser({ password }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), 20000)
        ),
      ]);
      if (updateError) {
        setError(updateError.message || 'Could not update password. Try again.');
        return;
      }
      // Recovery session is single-purpose — sign out so the next login
      // uses the new password.
      await supabase.auth.signOut();
      setDone(true);
    } catch {
      setError('Could not update password. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-blue-700 text-white">
            <Icon name="ShieldCheck" size={28} />
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Enter a new password for your account.
        </p>

        {done ? (
          <div className="mt-6">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <Icon name="CheckCircle" size={20} className="mt-0.5 shrink-0 text-emerald-600" />
              <p className="text-sm text-emerald-700">
                Password updated. Sign in with your new password.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="mt-6 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Continue to sign in
            </button>
          </div>
        ) : ready ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-semibold">
                New password <span className="text-red-500">*</span>
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold">
                Confirm password <span className="text-red-500">*</span>
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {isLoading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        ) : (
          <div className="mt-6">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              This reset link is invalid or has expired. Request a new one from the
              forgot-password page.
            </div>
            <p className="mt-6 text-center text-sm">
              <Link to="/forgot-password" className="font-semibold text-blue-700 hover:underline">
                Request a new reset link
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
