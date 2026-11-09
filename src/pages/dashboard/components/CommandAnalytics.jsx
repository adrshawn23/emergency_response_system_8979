import React, { useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';

const DAY_MS = 86400000;

const typeOf = r => (r.report_type || r.emergency_type || r.incident_type || 'other');
const when = r => new Date(r.created_at || r.createdAt || 0).getTime();

// Groups reports by a key fn into a sorted [label, count] list (desc).
const groupCount = (rows, fn) =>
  Object.entries(
    rows.reduce((acc, r) => {
      const k = fn(r);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

const fmtDuration = ms => {
  if (ms == null) return '—';
  const mins = ms / 60000;
  if (mins < 60) return `${Math.round(mins)} min`;
  const hrs = mins / 60;
  if (hrs < 24) return `${hrs.toFixed(1)} hrs`;
  return `${(hrs / 24).toFixed(1)} days`;
};

const summarize = (reports, days) => {
  const cutoff = Date.now() - days * DAY_MS;
  const rows = (reports || []).filter(r => {
    const t = when(r);
    return Number.isFinite(t) && t >= cutoff;
  });

  const resolved = rows.filter(r => r.status === 'resolved');
  // Approx resolution time: created_at -> last update on resolved reports.
  // Durations beyond 30 days are treated as stale edits, not resolution lag.
  const durations = resolved
    .map(r => new Date(r.updated_at).getTime() - when(r))
    .filter(ms => ms > 0 && ms < 30 * DAY_MS);
  const avgMs = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : null;

  return {
    total: rows.length,
    resolved: resolved.length,
    open: rows.length - resolved.length,
    resolutionRate: rows.length ? Math.round((resolved.length / rows.length) * 100) : 0,
    avgResolution: avgMs,
    byType: groupCount(rows, typeOf),
    byStatus: groupCount(rows, r => r.status || 'unknown'),
    byPriority: groupCount(rows, r => r.priority || 'unspecified'),
    byDept: groupCount(rows, r => r.assigned_department?.name || 'Unassigned'),
  };
};

const Breakdown = ({ title, icon, rows }) => {
  const max = rows.length ? rows[0][1] : 0;
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
        <Icon name={icon} size={13} className="text-slate-400" />
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {rows.length === 0 && <li className="text-xs text-slate-400">No incidents in this period</li>}
        {rows.slice(0, 6).map(([label, count]) => (
          <li key={label}>
            <div className="flex items-center justify-between text-xs">
              <span className="capitalize text-slate-600">{label}</span>
              <span className="font-semibold tabular-nums text-slate-800">{count}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
              <div
                className="h-full rounded-full bg-taste-500"
                style={{ width: `${max ? Math.max((count / max) * 100, 6) : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const CommandAnalytics = ({ reports }) => {
  const [period, setPeriod] = useState('week'); // 'week' | 'month'
  const stats = useMemo(
    () => summarize(reports, period === 'week' ? 7 : 30),
    [reports, period]
  );

  const headline = [
    ['Total incidents', stats.total, 'Siren'],
    ['Resolved', stats.resolved, 'CheckCircle2'],
    ['Open', stats.open, 'Clock'],
    ['Resolution rate', `${stats.resolutionRate}%`, 'TrendingUp'],
    ['Avg resolution time', fmtDuration(stats.avgResolution), 'Timer'],
  ];

  return (
    <section className="rounded-lg border border-slate-200/70 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-bold">Incident reports</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {period === 'week' ? 'Last 7 days' : 'Last 30 days'} — all reported incidents
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold">
          {[['week', 'Weekly'], ['month', 'Monthly']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`rounded-md px-3 py-1.5 transition ${period === key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">
        {headline.map(([label, value, icon]) => (
          <div key={label} className="rounded-xl border border-slate-200/70 p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Icon name={icon} size={13} className="text-slate-400" />
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 border-t border-slate-100 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <Breakdown title="By incident type" icon="Flame" rows={stats.byType} />
        <Breakdown title="By status" icon="Activity" rows={stats.byStatus} />
        <Breakdown title="By priority" icon="AlertTriangle" rows={stats.byPriority} />
        <Breakdown title="By assigned department" icon="Building2" rows={stats.byDept} />
      </div>
    </section>
  );
};

export default CommandAnalytics;
