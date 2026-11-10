import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

// Pages admins can open up to other roles. 'access' itself is intentionally
// absent — the permission editor must stay admin-only.
const EDITABLE_PAGES = [
  { key: 'queue', label: 'Incident queue' },
  { key: 'new', label: 'New incident' },
  { key: 'reports', label: 'Reports' },
  { key: 'metrics', label: 'Response times' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'residents', label: 'Residents & review' },
  { key: 'departments', label: 'Departments' },
];

// 'admin' is excluded — it always has full access and is shown as locked.
const EDITABLE_ROLES = ['resident', 'dispatcher', 'responder', 'department_admin'];

// Fixed pages — shown for completeness but intentionally not editable.
const LOCKED_PAGES = [
  { key: 'command', label: 'Command center / Home', note: 'Every role needs a landing page' },
  { key: 'profile', label: 'Profile', note: 'All signed-in users' },
  { key: 'access', label: 'Access control', note: 'Admin only — the permission editor itself' },
];

export default function PageAccessMatrix() {
  const { pageRoles } = useAuth();
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  const toggle = async (pageKey, role) => {
    setBusyKey(`${pageKey}:${role}`);
    setError('');

    // Read the live row before writing — pageRoles in context lags behind
    // rapid toggles and other sessions, so deriving the next array from it
    // silently restores roles a previous toggle just removed.
    const { data: row, error: readErr } = await supabase
      .from('page_permissions')
      .select('allowed_roles')
      .eq('page_key', pageKey)
      .maybeSingle();
    if (readErr) {
      setError(readErr.message);
      setBusyKey('');
      return;
    }
    const current = row?.allowed_roles ?? pageRoles[pageKey] ?? [];
    const next = current.includes(role)
      ? current.filter(r => r !== role)
      : [...current, role];
    if (!next.includes('admin')) next.push('admin'); // keep admin in stored list

    const { error: err } = await supabase
      .from('page_permissions')
      .upsert({ page_key: pageKey, allowed_roles: next });
    if (err) setError(err.message);
    setBusyKey('');
  };

  return (
    <div className="rounded-lg border border-slate-200/70 bg-white p-6">
      <h3 className="font-bold">Page access by role</h3>
      <p className="mt-1 text-sm text-slate-500">
        Choose which sidebar pages each role can open. Admin always has full
        access and changes apply to live sessions immediately.
      </p>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="pb-2 font-semibold">Page</th>
            {EDITABLE_ROLES.map(r => (
              <th key={r} className="pb-2 text-center font-semibold capitalize">{r.replace(/_/g, ' ')}</th>
            ))}
            <th className="pb-2 text-center font-semibold">Admin</th>
          </tr>
        </thead>
        <tbody>
          {EDITABLE_PAGES.map(p => (
            <tr key={p.key} className="border-t border-slate-100">
              <td className="py-2.5 font-medium text-slate-700">{p.label}</td>
              {EDITABLE_ROLES.map(role => {
                const allowed = (pageRoles[p.key] || []).includes(role);
                const busy = busyKey === `${p.key}:${role}`;
                return (
                  <td key={role} className="py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={allowed}
                      disabled={busy}
                      onChange={() => toggle(p.key, role)}
                      aria-label={`${p.label} � ${role}`}
                      className="h-4 w-4 cursor-pointer accent-red-600 disabled:opacity-50"
                    />
                  </td>
                );
              })}
              <td className="py-2.5 text-center">
                <Icon name="Lock" size={14} className="mx-auto text-slate-400" />
              </td>
            </tr>
          ))}
          {LOCKED_PAGES.map(p => (
            <tr key={p.key} className="border-t border-slate-100 bg-slate-50/60">
              <td className="py-2.5 font-medium text-slate-400">
                {p.label}
                <span className="ml-2 text-[10px] font-normal text-slate-400">({p.note})</span>
              </td>
              {EDITABLE_ROLES.map(role => (
                <td key={role} className="py-2.5 text-center">
                  <Icon name="Lock" size={14} className="mx-auto text-slate-300" />
                </td>
              ))}
              <td className="py-2.5 text-center">
                <Icon name="Lock" size={14} className="mx-auto text-slate-400" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Locked rows are fixed by design � Command center is every role's landing
        page, Profile is needed by all users, and Access control must stay
        admin-only.
      </p>
    </div>
  );
}
