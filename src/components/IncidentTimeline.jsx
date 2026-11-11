import React, { useEffect, useState } from 'react';
import Icon from './AppIcon';
import useIncidentHistory from '../hooks/useIncidentHistory';
import { supabase } from '../lib/supabase';

/**
 * Parcel-tracking-style incident timeline shared by every role's detail view.
 * Canonical chain: Reported → Assigned → Responding → Arrived → Resolved,
 * with a terminal Declined branch. Steps come from incident_status_history
 * (realtime) — 'arrived' is an event row, not an incident status. Legacy
 * reports with no history rows synthesize from created_at/resolved_at/status;
 * timestamps only render where real data exists (never fabricated).
 *
 * Usage: <IncidentTimeline report={selectedReport} />
 */

const CHAIN = [
  { key: 'pending',     label: 'Reported',   icon: 'FileText' },
  { key: 'assigned',    label: 'Assigned',   icon: 'UserCheck' },
  { key: 'in-progress', label: 'Responding', icon: 'Navigation' },
  { key: 'arrived',     label: 'Arrived',    icon: 'MapPin' },
  { key: 'resolved',    label: 'Resolved',   icon: 'CheckCircle' },
];

const ORDER = CHAIN.map((s) => s.key);
const TERMINAL = new Set(['resolved', 'declined']);
const rank = (s) => ORDER.indexOf(s);

const fmtTime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
};

// Actor names for step subtexts. Reports that come through supabaseService
// embed reporter/assigned_responder/assigned_department — slim-view callers
// don't, so fetch the ≤3 names once per report. Failures just mean a step
// renders without a name (never blocks the timeline).
function useIncidentActors(report) {
  const [actors, setActors] = useState({ reporterName: null, responderName: null, deptName: null });
  useEffect(() => {
    if (!report?.id) {
      setActors({ reporterName: null, responderName: null, deptName: null });
      return undefined;
    }
    let alive = true;
    const base = {
      reporterName: report.reporter?.full_name || report.reporter_name || null,
      responderName: report.assigned_responder?.full_name || report.responder_name || report.assigned_to_name || null,
      deptName: report.assigned_department?.name || report.department_name || null,
    };
    const jobs = [];
    if (!base.reporterName && report.reporter_id) {
      jobs.push(supabase.from('user_profiles').select('full_name').eq('id', report.reporter_id).maybeSingle()
        .then(({ data }) => ['reporterName', data?.full_name || null]));
    }
    if (!base.responderName && report.assigned_to) {
      jobs.push(supabase.from('user_profiles').select('full_name').eq('id', report.assigned_to).maybeSingle()
        .then(({ data }) => ['responderName', data?.full_name || null]));
    }
    if (!base.deptName && report.assigned_department_id) {
      jobs.push(supabase.from('departments').select('name').eq('id', report.assigned_department_id).maybeSingle()
        .then(({ data }) => ['deptName', data?.name || null]));
    }
    if (!jobs.length) setActors(base);
    else Promise.all(jobs).then((pairs) => {
      if (alive) setActors(pairs.reduce((acc, [k, v]) => ({ ...acc, [k]: v }), base));
    });
    return () => { alive = false; };
  // Keyed on report identity — refetch when a different incident opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id]);
  return actors;
}

function buildSteps(report, rows) {
  const status = report?.status || 'pending';
  const rowFor = (to) => rows.find((r) => r.to_status === to);
  const declined = status === 'declined' || !!rowFor('declined');
  const curRank = rank(status);

  // Reached = history row OR the incident progressed at least this far.
  // 'arrived' is the exception — only a real event row counts (FR-003).
  const steps = CHAIN.map((step, i) => {
    const row = rowFor(step.key);
    let state;
    let time = null;

    if (step.key === 'pending') {
      state = 'done';
      time = row?.created_at || report?.created_at;
    } else if (step.key === 'arrived') {
      if (row) {
        state = 'done';
        time = row.created_at;
      } else if (status === 'resolved' || rowFor('resolved') || declined) {
        state = 'skipped'; // resolved/declined without arrival
      } else {
        state = curRank >= i ? 'current' : 'upcoming';
      }
    } else if (row) {
      state = 'done';
      time = row.created_at;
    } else if (!declined && curRank >= i) {
      // Legacy/unsynthesized hop: report provably passed this step.
      state = curRank === i ? 'current' : 'done';
      if (step.key === 'resolved') time = report?.resolved_at;
    } else if (declined) {
      state = curRank > i ? 'done' : 'upcoming'; // before-decline steps only
    } else {
      state = 'upcoming';
    }

    return { ...step, state, time: fmtTime(time), row };
  });

  // Current-step highlight: the furthest non-skipped reached step.
  if (!declined) {
    let lastDone = -1;
    steps.forEach((s, i) => { if (s.state === 'done') lastDone = i; });
    steps.forEach((s) => { if (s.state === 'current') s.state = 'done'; });
    if (steps[lastDone]) steps[lastDone].state = status === 'resolved' ? 'done' : 'current';
  }

  if (declined) {
    const kept = steps.filter((s) => s.state === 'done' || s.state === 'skipped');
    kept.push({
      key: 'declined', label: 'Declined', icon: 'XCircle',
      state: 'declined', time: fmtTime(rowFor('declined')?.created_at || report?.resolved_at),
      row: rowFor('declined'),
    });
    return kept;
  }
  return steps;
}

function stepSubtext(step, actors) {
  const meta = step.row?.meta || {};
  const actor = step.row?.actor_name;
  if (step.key === 'pending') {
    const who = actors?.reporterName || actor;
    return who ? `by ${who}` : null;
  }
  if (step.key === 'assigned') {
    const who = meta.responder_name || actors?.responderName || actor;
    const dept = meta.dept || actors?.deptName;
    const parts = [dept, who].filter(Boolean);
    return parts.length ? `to ${parts.join(' · ')}` : null;
  }
  if (step.key === 'in-progress') {
    const who = actors?.responderName || actor || meta.responder_name;
    return who ? `by ${who}` : null;
  }
  if (step.key === 'arrived') {
    const who = actors?.responderName || meta.responder_name || actor;
    const method = meta.method === 'manual'
      ? (meta.marked_by_name ? `marked by ${meta.marked_by_name}` : 'marked by staff')
      : meta.method === 'gps' ? 'GPS-verified' : null;
    const parts = [who, method].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }
  if (step.key === 'resolved') {
    const who = actor || actors?.responderName;
    return who ? `by ${who}` : null;
  }
  if (step.key === 'declined' && meta.reason) return meta.reason;
  return null;
}

// Assisting units for this report — one row per department with its own
// step timestamps (assigned/ack/arrive/resolve on the CDA row). Realtime
// refetch keeps an open modal live. Reporters read via cda_reporter_select.
function useCdaUnits(reportId) {
  const [units, setUnits] = useState([]);
  useEffect(() => {
    if (!reportId) { setUnits([]); return undefined; }
    let alive = true;
    const fetchUnits = async () => {
      const { data } = await supabase
        .from('cross_department_assistance')
        .select('id, status, assigned_at, acknowledged_at, arrived_at, resolved_at, resolution_proof, responder:user_profiles!responder_id(full_name), dept:departments!assisting_department_id(name)')
        .eq('report_id', reportId);
      if (alive && data) setUnits(data);
    };
    fetchUnits();
    const ch = supabase
      .channel(`cda_units_${reportId}_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cross_department_assistance', filter: `report_id=eq.${reportId}` }, () => fetchUnits())
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [reportId]);
  return units;
}

const UNIT_STEPS = (u) => [
  { label: 'Assigned',   at: u.status === 'accepted' ? (u.assigned_at || true) : null },
  { label: 'Responding', at: u.acknowledged_at || null },
  { label: 'Arrived',    at: u.arrived_at || null },
  { label: 'Resolved',   at: u.resolved_at || null },
];

const TONES = {
  done:     { ring: 'bg-emerald-500 text-white', text: 'text-slate-900', sub: 'text-slate-500' },
  current:  { ring: 'bg-taste-500 text-white ring-4 ring-taste-100', text: 'text-taste-600 font-semibold', sub: 'text-slate-500' },
  upcoming: { ring: 'bg-slate-200 text-slate-400', text: 'text-slate-400', sub: 'text-slate-400' },
  skipped:  { ring: 'bg-slate-100 text-slate-400', text: 'text-slate-400', sub: 'text-slate-400' },
  declined: { ring: 'bg-red-500 text-white', text: 'text-red-600 font-semibold', sub: 'text-slate-500' },
};

export default function IncidentTimeline({ report }) {
  const { rows } = useIncidentHistory(report?.id, !!report?.id);
  const actors = useIncidentActors(report);
  const units = useCdaUnits(report?.id);
  const steps = report ? buildSteps(report, rows) : [];

  return (
    <div>
      <p className="text-xs font-bold text-slate-500">Tracking</p>
      <ol aria-live="polite" className="mt-2 space-y-0">
        {steps.map((step, i) => {
          const tone = TONES[step.state] || TONES.upcoming;
          const sub = stepSubtext(step, actors);
          const last = i === steps.length - 1;
          return (
            <li key={step.key} className="relative flex gap-3">
              {!last && (
                <span aria-hidden="true"
                  className={`absolute left-[15px] top-8 h-full w-0.5 ${step.state === 'done' || step.state === 'current' ? 'bg-emerald-200' : 'bg-slate-200'}`} />
              )}
              <span className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.ring}`}>
                <Icon name={step.state === 'skipped' ? 'Minus' : step.icon} size={14}/>
              </span>
              <div className="pb-4 pt-1">
                <p className={`text-sm ${tone.text}`}>{step.label}</p>
                {step.time && <p className={`text-xs ${tone.sub}`}>{step.time}</p>}
                {sub && <p className={`text-xs capitalize ${tone.sub}`}>{sub}</p>}
                {step.state === 'skipped' && <p className="text-xs text-slate-400">not recorded — resolved before arrival</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {units.length > 0 && (
        <div className="mt-1 border-t border-slate-100 pt-3">
          <p className="text-xs font-bold text-slate-500">Responding units</p>
          <ul className="mt-2 space-y-2.5">
            {units.map((u) => (
              <li key={u.id}>
                <p className="text-sm font-medium text-slate-700">
                  {u.dept?.name || 'Assisting department'}
                  {u.responder?.full_name ? ` · ${u.responder.full_name}` : ''}
                  {u.status === 'pending' && <span className="ml-1.5 text-xs font-normal text-amber-600">(awaiting responder)</span>}
                </p>
                <ol className="mt-1 flex flex-wrap gap-1">
                  {UNIT_STEPS(u).map((s) => (
                    <li
                      key={s.label}
                      title={s.at && s.at !== true ? fmtTime(s.at) : undefined}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.at ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                    >
                      {s.label}{s.at && s.at !== true ? ` · ${new Date(s.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                    </li>
                  ))}
                </ol>
                {u.resolution_proof && (
                  <a href={u.resolution_proof} target="_blank" rel="noreferrer">
                    <img src={u.resolution_proof} alt="Unit resolution proof" className="mt-1.5 h-16 w-24 rounded-md border border-slate-200 object-cover"/>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
