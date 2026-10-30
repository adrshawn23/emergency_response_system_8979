import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

// Pages admins can open up to other roles. 'access' itself is intentionally
// absent — the permission editor must stay admin-only.
const EDITABLE_PAGES = [
  { key: 'queue', label: 'Incident queue' },
  { key: 'new', label: 'New incident' },
  { key: 'residents', label: 'Residents & review' },
  { key: 'departments', label: 'Departments' },
  { key: 'settings', label: 'System settings' },
];

// 'admin' is excluded — it always has full access and is shown as locked.
const EDITABLE_ROLES = ['resident', 'dispatcher', 'responder'];

export default function PageAccessMatrix() {
  const { pageRoles } = useAuth();
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  const toggle = async (pageKey, role) => {
    const current = pageRoles[pageKey] || [];
    const next = current.includes(role)
      ? current.filter(r => r !== role)
      : [...current, role];
    if (!next.includes('admin')) next.push('admin'); // keep admin in stored list

    setBusyKey(`${pageKey}:${role}`);
    setError('');
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

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="pb-2 font-semibold">Page</th>
            {EDITABLE_ROLES.map(r => (
              <th key={r} className="pb-2 font-semibold capitalize">{r}</th>
            ))}
            <th className="pb-2 font-semibold">Admin</th>
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
                  <td key={role} className="py-2.5">
                    <input
                      type="checkbox"
                      checked={allowed}
                      disabled={busy}
                      onChange={() => toggle(p.key, role)}
                      aria-label={`${p.label} — ${role}`}
                      className="h-4 w-4 cursor-pointer accent-red-600 disabled:opacity-50"
                    />
                  </td>
                );
              })}
              <td className="py-2.5">
                <Icon name="Lock" size={14} className="text-slate-400" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-xs text-slate-400">
        Access control is admin-only and cannot be widened here.
      </p>
    </div>
  );
}
