import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

const ROLE_OPTIONS = ['resident', 'dispatcher', 'responder', 'admin'];

// Admin control panel: change any account's role, or suspend/reactivate it.
// Changes land in user_profiles; the affected user's AuthContext realtime
// subscription picks them up live (role gates + suspension screen).
// Editing your own role/status is disabled here AND blocked by the
// user_profiles_guard_privileged trigger server-side.
const UserAccessManager = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, full_name, email, role, status, account_status')
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

  return (
    <div className="rounded-lg border border-slate-200/70 bg-white p-6 lg:col-span-2">
      <h3 className="font-bold">User access & roles</h3>
      <p className="mt-1 text-sm text-slate-500">Changes apply to the user's live session immediately. Your own role and status cannot be edited.</p>
      {message && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{message}</p>}
      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
        {users.length === 0 && !message && <p className="text-sm text-slate-500">No users found.</p>}
        {users.map(u => {
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
                  onClick={() => updateUser(u.id, { account_status: suspended ? 'active' : 'suspended' })}
                  disabled={isSelf || busyId === u.id}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${suspended ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                >
                  {busyId === u.id ? 'Saving…' : suspended ? 'Reactivate' : 'Suspend'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserAccessManager;
