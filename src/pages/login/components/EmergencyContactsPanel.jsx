import React, { useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const CHANNEL_ICON = { phone: 'Phone', radio: 'Radio', email: 'Mail', other: 'Info' };

/**
 * Public emergency hotlines shown on the sign-in page. Reads the same
 * admin-managed department_contacts directory as the dashboard Contacts
 * section — requires the contacts_anon_select policy (migration
 * 20261118150000) since visitors are unauthenticated here. Renders nothing
 * when no active entries are readable (policy missing or table empty).
 */
const EmergencyContactsPanel = () => {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('department_contacts')
        .select('id, label, channel, value, description')
        .eq('active', true)
        .order('sort_order')
        .order('created_at');
      if (!cancelled) {
        setEntries(data ?? []);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!loaded || entries.length === 0) return null;

  const href = (e) => {
    if (e.channel === 'phone') return `tel:${e.value.replace(/[^\d+]/g, '')}`;
    if (e.channel === 'email') return `mailto:${e.value}`;
    return null;
  };

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="Phone" size={16} className="text-rose-600" />
        <h2 className="text-sm font-semibold text-slate-800">Emergency hotlines</h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {entries.map(e => {
          const link = href(e);
          return (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              <Icon name={CHANNEL_ICON[e.channel] ?? 'Info'} size={16} className="shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-700">{e.label}</p>
                {e.description && (
                  <p className="truncate text-xs text-slate-500">{e.description}</p>
                )}
              </div>
              {link ? (
                <a
                  href={link}
                  className="shrink-0 rounded-lg bg-rose-50 px-2.5 py-1 text-[13px] font-semibold text-rose-700 hover:bg-rose-100"
                >
                  {e.value}
                </a>
              ) : (
                <span className="shrink-0 text-[13px] font-semibold text-slate-700">{e.value}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default EmergencyContactsPanel;
