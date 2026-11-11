import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import useAppSetting from '../../../hooks/useAppSetting';

const STALE_ASSIGNED_MS = 10 * 60 * 1000; // assigned >10m with no response = stale

const fmtAge = ms => {
  if (ms == null) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.floor(hrs)}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${Math.floor(hrs % 24)}h`;
};

// Live ops snapshot for the command center — current workload only, so it
// complements the Reports page (historical trends) instead of duplicating it.
// Every tile answers "what needs attention right now".
const CommandOps = ({ reports, isAdmin = false }) => {
  const [cdaOpen, setCdaOpen] = useState(0);

  // Admin-tunable radii (app_settings). arrival_radius_m gates GPS arrival
  // server-side; incident_radius_m sizes the circle drawn on incident maps.
  const arrivalRadius = useAppSetting('arrival_radius_m', 50);
  const incidentRadius = useAppSetting('incident_radius_m', 150);
  const [radiusDraft, setRadiusDraft] = useState(null); // {key: value} edits
  const [savingRadius, setSavingRadius] = useState(false);
  const [radiusMsg, setRadiusMsg] = useState('');
  const draftArrival = radiusDraft?.arrival_radius_m ?? arrivalRadius;
  const draftIncident = radiusDraft?.incident_radius_m ?? incidentRadius;
  const radiusDirty = radiusDraft != null
    && (Number(draftArrival) !== arrivalRadius || Number(draftIncident) !== incidentRadius);

  const saveRadius = async () => {
    // value is jsonb — must serialize as a NUMBER, or value::text on the
    // server yields '"150"' and the arrival RPC's ::double cast fails.
    const rows = [
      { key: 'arrival_radius_m', value: Number(draftArrival) },
      { key: 'incident_radius_m', value: Number(draftIncident) },
    ];
    if (rows.some(r => !Number.isFinite(r.value) || r.value <= 0)) {
      setRadiusMsg('Radii must be positive numbers.');
      return;
    }
    setSavingRadius(true);
    setRadiusMsg('');
    const { error } = await supabase.from('app_settings').upsert(rows);
    setSavingRadius(false);
    setRadiusMsg(error ? `Save failed: ${error.message}` : 'Saved — applies to new arrivals and reopened incident maps.');
    if (!error) setRadiusDraft(null);
  };

  useEffect(() => {
    let live = true;
    const fetchCda = async () => {
      const { count } = await supabase
        .from('cross_department_assistance')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'accepted']);
      if (live) setCdaOpen(count || 0);
    };
    fetchCda();
    const ch = supabase
      .channel(`ops_cda_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cross_department_assistance' }, fetchCda)
      .subscribe();
    return () => { live = false; supabase.removeChannel(ch); };
  }, []);

  const s = useMemo(() => {
    const rows = reports || [];
    const open = rows.filter(r => !['resolved', 'declined'].includes(r.status));
    const pending = open.filter(r => r.status === 'pending');
    const assigned = open.filter(r => r.status === 'assigned');
    const inProg = open.filter(r => r.status === 'in-progress');
    const oldest = open.reduce((m, r) => {
      const t = new Date(r.created_at || 0).getTime();
      return t && t < (m ?? Infinity) ? t : m;
    }, null);
    const deployed = new Set(open.map(r => r.assigned_to).filter(Boolean)).size;
    // Stale = still 'assigned' and untouched longer than the threshold —
    // updated_at is the last write, i.e. roughly when it was assigned.
    const stale = open.filter(r =>
      r.status === 'assigned'
      && Date.now() - new Date(r.updated_at || r.created_at || 0).getTime() > STALE_ASSIGNED_MS
    ).length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const resolvedToday = rows.filter(r =>
      r.status === 'resolved' && new Date(r.updated_at || r.created_at || 0) >= today
    ).length;
    const highOpen = open.filter(r => r.priority === 'high').length;
    return {
      open: open.length, pending: pending.length, assigned: assigned.length,
      inProg: inProg.length, oldest: oldest ? Date.now() - oldest : null,
      deployed, resolvedToday, highOpen, stale,
    };
  }, [reports]);

  const tiles = [
    { label: 'Open now', value: s.open, icon: 'Siren', tone: s.open ? 'text-red-600' : 'text-slate-900' },
    { label: 'Awaiting triage', value: s.pending, icon: 'Inbox', tone: s.pending ? 'text-amber-600' : 'text-slate-900' },
    { label: 'Assigned — waiting response', value: s.assigned, icon: 'UserCheck', tone: 'text-slate-900' },
    { label: 'Responding', value: s.inProg, icon: 'Ambulance', tone: s.inProg ? 'text-cyan-700' : 'text-slate-900' },
    { label: 'Assistance in flight', value: cdaOpen, icon: 'Users', tone: 'text-slate-900' },
    { label: 'Responders deployed', value: s.deployed, icon: 'Radio', tone: 'text-slate-900' },
    { label: 'Resolved today', value: s.resolvedToday, icon: 'CheckCircle2', tone: 'text-emerald-700' },
    { label: 'Oldest open', value: fmtAge(s.oldest), icon: 'Timer', tone: s.oldest && s.oldest > 3600000 ? 'text-red-600' : 'text-slate-900' },
  ];

  return (
    <section className="rounded-lg border border-slate-200/70 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-bold">Live operations</h3>
          <p className="mt-0.5 text-xs text-slate-500">Current workload — historical trends live under Reports</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {s.stale > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
              <Icon name="ClockAlert" size={13} /> {s.stale} assigned — no response
            </span>
          )}
          {s.highOpen > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
              <Icon name="AlertTriangle" size={13} /> {s.highOpen} high-priority open
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-3 p-5 grid-cols-2 sm:grid-cols-4">
        {tiles.map(t => (
          <div key={t.label} className="rounded-xl border border-slate-200/70 p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Icon name={t.icon} size={13} className="text-slate-400" /> {t.label}
            </p>
            <p className={`mt-2 text-2xl font-semibold tabular-nums ${t.tone}`}>{t.value}</p>
          </div>
        ))}
      </div>
      {isAdmin && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <Icon name="Settings2" size={13}/> Operational settings
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-slate-500">Arrival radius (m) — GPS gate for "Arrived"</span>
              <input
                type="number" min="1" value={draftArrival}
                onChange={e => setRadiusDraft(d => ({ ...(d || {}), arrival_radius_m: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">Incident map radius (m) — circle on incident maps</span>
              <input
                type="number" min="1" value={draftIncident}
                onChange={e => setRadiusDraft(d => ({ ...(d || {}), incident_radius_m: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={saveRadius}
              disabled={savingRadius || !radiusDirty}
              className="rounded-lg bg-taste-500 px-4 py-2 text-xs font-semibold text-white hover:bg-taste-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {savingRadius ? 'Saving…' : 'Save settings'}
            </button>
            {radiusMsg && <p className="text-xs text-slate-500">{radiusMsg}</p>}
          </div>
        </div>
      )}
    </section>
  );
};

export default CommandOps;
