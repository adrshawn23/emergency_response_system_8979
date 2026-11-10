import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import CommandAnalytics from './CommandAnalytics';

const typeOf = r => (r.report_type || r.emergency_type || r.incident_type || 'other');
const statusOf = r => (r.status || 'unknown');
const locationOf = r => r.attachments?.location || r.location || '—';
const contactOf = r => r.attachments?.contact_name || '—';

const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-800',
  assigned: 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-cyan-100 text-cyan-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-red-100 text-red-700',
  arrived: 'bg-emerald-100 text-emerald-700',
};
const badge = s => STATUS_BADGE[s] || 'bg-slate-100 text-slate-600';

const toCsv = (rows) => {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Report ID', 'Type', 'Status', 'Priority', 'Location', 'Contact', 'Department', 'Reported at'];
  const lines = [header.map(esc).join(',')];
  rows.forEach(r => {
    lines.push([
      r.report_id || r.id,
      typeOf(r),
      statusOf(r),
      r.priority || '',
      locationOf(r),
      contactOf(r),
      r.assigned_department?.name || 'Unassigned',
      r.created_at ? new Date(r.created_at).toLocaleString() : '',
    ].map(esc).join(','));
  });
  return lines.join('\r\n');
};

const downloadCsv = (rows) => {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `incident-reports-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// A single audit row — status transitions come from incident_status_history,
// assistance events from cross_department_assistance; merged + sorted desc.
const buildActivity = (history, cda) => [
  ...history.map(r => ({
    id: `h-${r.id}`,
    at: new Date(r.created_at).getTime(),
    icon: 'Activity',
    label: r.report?.report_type || 'incident',
    text: `${r.from_status ? `${r.from_status} → ` : ''}${r.to_status}`,
    actor: r.actor?.full_name || r.meta?.marked_by_name || r.meta?.responder_name || 'system',
    note: r.meta?.method === 'gps'
      ? `GPS-verified${r.meta?.distance_m ? ` · ${r.meta.distance_m} m` : ''}`
      : r.meta?.method === 'manual' ? 'marked manually' : null,
    status: r.to_status,
  })),
  ...cda.map(r => ({
    id: `c-${r.id}`,
    at: new Date(r.created_at).getTime(),
    icon: 'Users',
    label: r.report?.report_type || 'incident',
    text: `assistance → ${r.department?.name || 'department'}${r.responder?.full_name ? ` · ${r.responder.full_name}` : ''}`,
    actor: r.notes === 'auto-dispatch' ? 'auto-dispatch' : (r.requester?.full_name || 'staff'),
    note: null,
    status: r.status,
  })),
].sort((a, b) => b.at - a.at).slice(0, 50);

const ReportsSection = () => {
  const [reports, setReports] = useState([]);
  const [history, setHistory] = useState([]);
  const [cda, setCda] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');

  useEffect(() => {
    let live = true;
    const fetchAll = async () => {
      const [r, h, c] = await Promise.all([
        supabase.from('emergency_reports_list').select('*').order('created_at', { ascending: false }),
        supabase.from('incident_status_history')
          .select('id, report_id, from_status, to_status, actor_id, meta, created_at, actor:user_profiles(full_name), report:emergency_reports(report_type)')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('cross_department_assistance')
          .select('id, report_id, status, notes, created_at, requester:user_profiles!requested_by(full_name), responder:user_profiles!responder_id(full_name), department:departments!assisting_department_id(name), report:emergency_reports(report_type)')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);
      if (!live) return;
      setReports(r.data || []);
      setHistory(h.data || []);
      setCda(c.data || []);
      setLoading(false);
    };
    fetchAll();
    const channel = supabase
      .channel(`reports_section_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_status_history' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cross_department_assistance' }, fetchAll)
      .subscribe();
    return () => { live = false; supabase.removeChannel(channel); };
  }, []);

  const types = useMemo(() =>
    [...new Set(reports.map(typeOf))].sort(), [reports]);

  const filtered = useMemo(() => reports.filter(r => {
    if (status !== 'all' && statusOf(r) !== status) return false;
    if (type !== 'all' && typeOf(r) !== type) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return [
      r.report_id || r.id, typeOf(r), statusOf(r), r.priority,
      locationOf(r), contactOf(r), r.content || r.description,
      r.attachments?.contact_phone, r.assigned_department?.name,
    ].some(v => String(v || '').toLowerCase().includes(q));
  }), [reports, status, type, query]);

  const activity = useMemo(() => buildActivity(history, cda), [history, cda]);

  return (
    <div className="mt-7 space-y-6">
      <CommandAnalytics reports={reports} />

      {/* Incident records — review surface with filters + CSV export */}
      <section className="rounded-lg border border-slate-200/70 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-bold">Incident records</h3>
            <p className="mt-0.5 text-xs text-slate-500">{filtered.length} of {reports.length} reports</p>
          </div>
          <button
            onClick={() => downloadCsv(filtered)}
            disabled={!filtered.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="Download" size={14} /> Export CSV
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search reports — id, location, contact, description…"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-taste-500"
          />
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-taste-500"
          >
            <option value="all">All statuses</option>
            {['pending', 'assigned', 'in-progress', 'resolved', 'declined'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-taste-500"
          >
            <option value="all">All types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="max-h-[480px] overflow-auto">
          <div className="grid min-w-[860px] grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,.8fr)_minmax(90px,.5fr)_minmax(110px,.6fr)_minmax(150px,.8fr)] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-400">
            <span>Incident</span><span>Location</span><span>Department</span><span>Priority</span><span>Status</span><span>Reported</span>
          </div>
          {loading && <p className="px-5 py-8 text-center text-sm text-slate-400">Loading records…</p>}
          {!loading && filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No reports match these filters.</p>
          )}
          {filtered.map(r => (
            <div key={r.id || r.report_id} className="grid min-w-[860px] grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,.8fr)_minmax(90px,.5fr)_minmax(110px,.6fr)_minmax(150px,.8fr)] items-center gap-4 border-b border-slate-100 px-5 py-3.5 last:border-0">
              <div className="min-w-0">
                <p className="truncate font-semibold capitalize">{typeOf(r)} <span className="font-mono text-xs font-normal text-slate-400">{r.report_id || r.id?.slice(0, 8)}</span></p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{r.content || r.description}</p>
              </div>
              <p className="truncate text-sm text-slate-600">{locationOf(r)}</p>
              <p className="truncate text-sm text-slate-600">{r.assigned_department?.name || '—'}</p>
              <span className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">{r.priority || '—'}</span>
              <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badge(statusOf(r))}`}>{statusOf(r)}</span>
              <p className="text-xs text-slate-500">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</p>
            </div>
          ))}
        </div>
      </section>

      {/* System activity — merged audit feed (status transitions + CDA events) */}
      <section className="rounded-lg border border-slate-200/70 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Icon name="ScrollText" size={16} className="text-slate-400" />
          <div>
            <h3 className="font-bold">System activity</h3>
            <p className="mt-0.5 text-xs text-slate-500">Status transitions and cross-department assistance, newest first</p>
          </div>
        </div>
        <ul className="max-h-[480px] divide-y divide-slate-100 overflow-auto px-5">
          {activity.length === 0 && !loading && (
            <li className="py-8 text-center text-sm text-slate-400">No activity recorded yet.</li>
          )}
          {activity.map(a => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-3 text-sm">
              <Icon name={a.icon} size={14} className="shrink-0 text-slate-400" />
              <span className="font-semibold capitalize text-slate-800">{a.label}</span>
              <span className="text-slate-600">{a.text}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badge(a.status)}`}>{a.status}</span>
              <span className="text-xs text-slate-500">by {a.actor}</span>
              {a.note && <span className="text-xs text-slate-400">· {a.note}</span>}
              <span className="ml-auto shrink-0 text-xs tabular-nums text-slate-400">{new Date(a.at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default ReportsSection;
