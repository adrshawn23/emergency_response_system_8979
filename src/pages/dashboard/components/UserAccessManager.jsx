import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

const ROLE_OPTIONS = ['resident', 'dispatcher', 'responder', 'department_admin', 'admin'];

// Admin control panel: change any account's role, or suspend/reactivate it.
// Changes land in user_profiles; the affected user's AuthContext realtime
// subscription picks them up live (role gates + suspension screen).
// Editing your own role/status is disabled here AND blocked by the
// user_profiles_guard_privileged trigger server-side.
const UserAccessManager = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');
  // Suspension must carry a reason — shown to the user + emailed to them
  const [suspendFor, setSuspendFor] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendError, setSuspendError] = useState('');

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, full_name, email, role, status, account_status, suspension_reason')
      .order('created_at', { ascending: false });
    if (error) {
      setMessage(`Could not load users: ${error.message}`);
      return;
    }
    setUsers(data || []);
  }, []);

  useEffect(() => {
    fetchUsers();
    // Keep the admin's list in sync when profiles change anywhere.
    const channel = supabase
      .channel('admin-user-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, fetchUsers)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchUsers]);

  const updateUser = async (id, patch) => {
    setBusyId(id);
    setMessage('');
    const { error } = await supabase.from('user_profiles').update(patch).eq('id', id);
    if (error) {
      setMessage(`Update failed: ${error.message}`);
    } else {
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...patch } : u)));
    }
    setBusyId(null);
  };

  const submitSuspend = async () => {
    const reason = suspendReason.trim();
    if (!suspendFor || !reason) {
      setSuspendError('A reason is required — the user sees this on the suspended screen and in the email.');
      return;
    }
    const { error } = await supabase
      .from('user_profiles')
      .update({ account_status: 'suspended', suspension_reason: reason })
      .eq('id', suspendFor.id);
    if (error) { setSuspendError(error.message); return; }
    setUsers(prev => prev.map(u => (u.id === suspendFor.id ? { ...u, account_status: 'suspended', suspension_reason: reason } : u)));
    const targetId = suspendFor.id;
    setSuspendFor(null); setSuspendReason(''); setSuspendError('');
    // Best-effort notify — suspension already landed even if email fails.
    supabase.functions.invoke('notify-suspension', { body: { user_id: targetId } })
      .catch(e => console.error('notify-suspension invoke failed:', e));
  };

  return (
    <div className="rounded-lg border border-slate-200/70 bg-white p-6 lg:col-span-2">
      <h3 className="font-bold">User access & roles</h3>
      <p className="mt-1 text-sm text-slate-500">Changes apply to the user's live session immediately. Your own role and status cannot be edited.</p>
      {message && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{message}</p>}
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by name, email, or role…"
        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {(() => {
          const q = query.trim().toLowerCase();
          const filtered = q
            ? users.filter(u => [u.full_name, u.first_name, u.last_name, u.email, u.role].some(v => v?.toLowerCase().includes(q)))
            : users;
          if (filtered.length === 0) return <p className="text-sm text-slate-500">{users.length === 0 && !message ? 'No users found.' : 'No users match your search.'}</p>;
          return filtered.map(u => {
          const isSelf = u.id === profile?.id;
          const suspended = u.account_status === 'suspended';
          const name = u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Unnamed';
          return (
            <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}{isSelf && <span className="ml-1 text-xs text-slate-400">(you)</span>}</p>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {suspended && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">suspended</span>}
                {u.status === 'inactive' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">pending</span>}
                <select
                  value={u.role || 'resident'}
                  disabled={isSelf || busyId === u.id}
                  onChange={e => updateUser(u.id, { role: e.target.value })}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <button
                  onClick={() => {
                    if (suspended) {
                      updateUser(u.id, { account_status: 'active', suspension_reason: null });
                    } else {
                      setSuspendFor(u); setSuspendReason(''); setSuspendError('');
                    }
                  }}
                  disabled={isSelf || busyId === u.id}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${suspended ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                >
                  {busyId === u.id ? 'Saving…' : suspended ? 'Reactivate' : 'Suspend'}
                </button>
              </div>
            </div>
          );
          });
        })()}
      </div>

      {/* Suspension reason — required; the user sees it on their suspended
          screen and in the notification email */}
      {suspendFor && (
        <div className="fixed inset-0 z-1050 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h3 className="text-lg font-bold">Suspend {suspendFor.full_name || suspendFor.email}</h3>
              <button onClick={() => setSuspendFor(null)} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600">The account is locked immediately — they can't report, respond, or sign in past a suspended screen. Tell them why.</p>
              <label className="mt-4 block text-sm font-semibold">Reason <span className="text-red-500">*</span></label>
              <textarea
                value={suspendReason}
                onChange={e => { setSuspendReason(e.target.value); setSuspendError(''); }}
                rows={3}
                placeholder="e.g. False reports filed repeatedly after warning…"
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {suspendError && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">{suspendError}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setSuspendFor(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
                <button onClick={submitSuspend} disabled={!suspendReason.trim()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">Suspend account</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAccessManager;
