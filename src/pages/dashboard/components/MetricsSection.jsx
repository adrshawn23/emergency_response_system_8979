import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

/**
 * Response-time metrics (specs/004 US4) — per-department respond/arrive
 * durations over a selectable window, computed from existing clocks only:
 *   main unit → incident_status_history (assigned → in-progress → arrived)
 *   assisting units → CDA assigned_at → acknowledged_at → arrived_at
 * FR-011 averages per department; FR-012 per-incident breakdown incl.
 * units with missing steps (counted as "no arrival recorded", never
 * averaged in).
 */

const RANGES = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: 'all', label: 'All time' },
];

const fmtDur = (ms) => {
  if (ms == null) return '—';
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const avg = (vals) => vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

const MetricsSection = () => {
  const [range, setRange] = useState('30');
  const [history, setHistory] = useState([]);
  const [units, setUnits] = useState([]);
  const [reports, setReports] = useState([]);
  const [departments, setDepartments] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = range === 'all' ? null : new Date(Date.now() - Number(range) * 86400000).toISOString();
    const load = async () => {
      setLoading(true);
      let hq = supabase.from('incident_status_history')
        .select('report_id, to_status, created_at')
        .in('to_status', ['assigned', 'in-progress', 'arrived']);
      let cq = supabase.from('cross_department_assistance')
        .select('report_id, assigned_at, acknowledged_at, arrived_at, status, dept:departments!assisting_department_id(name)');
      let rq = supabase.from('emergency_reports_list')
        .select('id, report_type, created_at, assigned_department_id, dept:departments!assigned_department_id(name)')
        .order('created_at', { ascending: false }).limit(300);
      if (since) { hq = hq.gte('created_at', since); cq = cq.gte('assigned_at', since); rq = rq.gte('created_at', since); }
      const [{ data: h }, { data: c }, { data: r }] = await Promise.all([hq, cq, rq]);
      setHistory(h ?? []);
      setUnits(c ?? []);
      setReports(r ?? []);
      const { data: depts } = await supabase.from('departments').select('id, name');
      setDepartments(Object.fromEntries((depts ?? []).map(d => [d.id, d.name])));
      setLoading(false);
    };
    load();
  }, [range]);

  // Per-incident main-unit durations from history.
  const mainUnits = useMemo(() => {
    const byReport = {};
    history.forEach(row => {
      const b = (byReport[row.report_id] = byReport[row.report_id] || {});
      if (!b[row.to_status]) b[row.to_status] = row.created_at;
    });
    return Object.entries(byReport).map(([reportId, b]) => {
      const rep = reports.find?.(x => x.id === reportId) || reports[reportId];
      const t = (k) => b[k] ? new Date(b[k]).getTime() : null;
      return {
        reportId,
        dept: rep?.dept?.name || departments[rep?.assigned_department_id] || 'Unassigned',
        report: rep,
        respondMs: t('assigned') != null && t('in-progress') != null ? t('in-progress') - t('assigned') : null,
        arriveMs: t('in-progress') != null && t('arrived') != null ? t('arrived') - t('in-progress') : null,
      };
    });
  }, [history, reports, departments]);

  const unitRows = useMemo(() => [
    ...mainUnits.map(u => ({ ...u, unit: 'Main unit' })),
    ...units.map(u => ({
      reportId: u.report_id,
      unit: u.dept?.name || 'Assisting unit',
      dept: u.dept?.name || 'Assisting unit',
      respondMs: u.assigned_at && u.acknowledged_at ? new Date(u.acknowledged_at) - new Date(u.assigned_at) : null,
      arriveMs: u.acknowledged_at && u.arrived_at ? new Date(u.arrived_at) - new Date(u.acknowledged_at) : null,
      noArrival: !u.arrived_at,
    })),
  ], [mainUnits, units]);

  const deptStats = useMemo(() => {
    const groups = {};
    unitRows.forEach(u => {
      const g = (groups[u.dept] = groups[u.dept] || { respond: [], arrive: [], noArrival: 0, count: 0 });
      g.count++;
      if (u.respondMs != null && u.respondMs >= 0) g.respond.push(u.respondMs);
      if (u.arriveMs != null && u.arriveMs >= 0) g.arrive.push(u.arriveMs);
      else if (u.unit !== 'Main unit' ? u.noArrival : u.arriveMs == null) g.noArrival++;
    });
    return Object.entries(groups)
      .map(([dept, g]) => ({ dept, avgRespond: avg(g.respond), avgArrive: avg(g.arrive), noArrival: g.noArrival, count: g.count }))
      .sort((a, b) => a.dept.localeCompare(b.dept));
  }, [unitRows]);

  const byIncident = useMemo(() => {
    const map = {};
    unitRows.forEach(u => { (map[u.reportId] = map[u.reportId] || []).push(u); });
    const repOf = (id) => (reports.find?.(x => x.id === id) || reports[id]);
    return Object.entries(map)
      .map(([reportId, rows]) => ({ reportId, rows, report: repOf(reportId) }))
      .sort((a, b) => new Date(b.report?.created_at || 0) - new Date(a.report?.created_at || 0));
  }, [unitRows, reports]);

  return (
    <div className="mt-7 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Gauge" size={18} className="text-primary" />
          <h3 className="font-semibold text-foreground">Response times by department</h3>
        </div>
        <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={range} onChange={e => setRange(e.target.value)}>
          {RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-lg border border-slate-200 bg-white" />
      ) : deptStats.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No assignments in this period.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deptStats.map(d => (
              <div key={d.dept} className="rounded-lg border border-border bg-card p-4">
                <p className="font-semibold text-foreground">{d.dept}</p>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Avg respond time</span><span className="font-semibold">{fmtDur(d.avgRespond)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Avg arrive time</span><span className="font-semibold">{fmtDur(d.avgArrive)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">{d.count} unit assignment{d.count === 1 ? '' : 's'}</span>{d.noArrival > 0 && <span className="text-amber-700">{d.noArrival} no arrival recorded</span>}</div>
                </div>
              </div>
            ))}
          </div>

          <section>
            <h4 className="mb-3 font-semibold text-foreground">Per-incident breakdown</h4>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Incident</th>
                    <th className="px-4 py-2">Unit</th>
                    <th className="px-4 py-2">Responded in</th>
                    <th className="px-4 py-2">Arrived in</th>
                  </tr>
                </thead>
                <tbody>
                  {byIncident.map(inc => inc.rows.map((u, i) => (
                    <tr key={`${inc.reportId}-${i}`} className="border-t border-border">
                      {i === 0 && (
                        <td className="px-4 py-2 capitalize" rowSpan={inc.rows.length}>
                          {inc.report?.report_type || 'incident'}
                          <div className="text-xs text-muted-foreground">{inc.report?.created_at ? new Date(inc.report.created_at).toLocaleDateString() : ''}</div>
                        </td>
                      )}
                      <td className="px-4 py-2">{u.unit}</td>
                      <td className="px-4 py-2 font-medium">{fmtDur(u.respondMs)}</td>
                      <td className="px-4 py-2 font-medium">
                        {u.arriveMs != null ? fmtDur(u.arriveMs) : <span className="text-amber-700">no arrival</span>}
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default MetricsSection;
