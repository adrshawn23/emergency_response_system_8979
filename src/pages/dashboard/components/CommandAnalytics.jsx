import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import Icon from '../../../components/AppIcon';

const DAY_MS = 86400000;
const TYPE_COLORS = ['#0e7490', '#dc2626', '#d97706']; // cyan / red / amber for top-3 type lines

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

// ---- Time buckets -----------------------------------------------------------
// week  -> last 7 days, one bucket per day
// month -> last 35 days, one bucket per week (5 buckets)
// year  -> last 12 months, one bucket per month
const buildBuckets = (period) => {
  const now = new Date();
  const buckets = [];

  if (period === 'week') {
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      buckets.push({ start: start.getTime(), end: start.getTime() + DAY_MS, label: start.toLocaleDateString(undefined, { weekday: 'short' }) });
    }
  } else if (period === 'month') {
    for (let i = 4; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 7 * DAY_MS);
      const start = new Date(end.getTime() - 7 * DAY_MS);
      const lbl = i === 0 ? 'This wk' : `${i} wk ago`;
      buckets.push({ start: start.getTime(), end: end.getTime(), label: lbl });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      buckets.push({ start: d.getTime(), end: next.getTime(), label: d.toLocaleDateString(undefined, { month: 'short' }) });
    }
  }
  return buckets;
};

// Least-squares line over the totals -> endpoints only, so recharts can draw
// it as a straight dashed "trend" line.
const trendPoints = (points) => {
  const n = points.length;
  if (n < 2) return points.map(p => ({ ...p, trend: p.total }));
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  points.forEach((p, x) => { sx += x; sy += p.total; sxy += x * p.total; sxx += x * x; });
  const denom = n * sxx - sx * sx;
  const slope = denom ? (n * sxy - sx * sy) / denom : 0;
  const intercept = (sy - slope * sx) / n;
  return points.map((p, x) => ({ ...p, trend: Math.max(0, +(slope * x + intercept).toFixed(2)) }));
};

const summarize = (reports, period) => {
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
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

  // Per-bucket counts (total + top-3 types) for the trend chart.
  const buckets = buildBuckets(period);
  const topTypes = groupCount(rows, typeOf).slice(0, 3).map(([k]) => k);
  const points = buckets.map(b => {
    const inB = rows.filter(r => {
      const t = when(r);
      return t >= b.start && t < b.end;
    });
    const pt = { label: b.label, total: inB.length };
    topTypes.forEach(t => { pt[t] = inB.filter(r => typeOf(r) === t).length; });
    return pt;
  });

  const busiest = points.reduce((m, p) => (p.total > (m?.total ?? -1) ? p : m), null);
  const first = points[0]?.total ?? 0;
  const last = points[points.length - 1]?.total ?? 0;

  return {
    total: rows.length,
    resolved: resolved.length,
    open: rows.length - resolved.length,
    resolutionRate: rows.length ? Math.round((resolved.length / rows.length) * 100) : 0,
    avgResolution: avgMs,
    chart: trendPoints(points),
    topTypes,
    busiest,
    delta: first ? Math.round(((last - first) / first) * 100) : (last ? 100 : 0),
    byType: groupCount(rows, typeOf),
    byStatus: groupCount(rows, r => r.status || 'unknown'),
    byPriority: groupCount(rows, r => r.priority || 'unspecified'),
    byDept: groupCount(rows, r => r.assigned_department?.name || 'Unassigned'),
  };
};

const PERIODS = [
  ['week', 'Weekly'],
  ['month', 'Monthly'],
  ['year', 'Yearly'],
];
const PERIOD_LABEL = { week: 'Last 7 days, per day', month: 'Last 5 weeks, per week', year: 'Last 12 months, per month' };

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
  const [period, setPeriod] = useState('week'); // 'week' | 'month' | 'year'
  const stats = useMemo(() => summarize(reports, period), [reports, period]);

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
          <p className="mt-0.5 text-xs text-slate-500">{PERIOD_LABEL[period]}</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold">
          {PERIODS.map(([key, label]) => (
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

      {/* Occurrence trend — when do incidents usually happen? */}
      <div className="border-t border-slate-100 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Occurrence trend</p>
          <p className="text-xs text-slate-500">
            {stats.busiest?.total
              ? <>Busiest: <span className="font-semibold text-slate-800">{stats.busiest.label}</span> ({stats.busiest.total} incidents)</>
              : 'No incidents in this period'}
            {stats.delta !== 0 && (
              <span className={`ml-2 font-semibold ${stats.delta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {stats.delta > 0 ? '+' : ''}{stats.delta}% vs start
              </span>
            )}
          </p>
        </div>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={stats.chart} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
              <Bar dataKey="total" name="All incidents" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={period === 'year' ? 18 : 28} />
              {stats.topTypes.map((t, i) => (
                <Line
                  key={t}
                  type="monotone"
                  dataKey={t}
                  name={t.charAt(0).toUpperCase() + t.slice(1)}
                  stroke={TYPE_COLORS[i % TYPE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                />
              ))}
              <Line
                type="linear"
                dataKey="trend"
                name="Trendline"
                stroke="#334155"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
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
