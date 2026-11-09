import React from 'react';
import Icon from './AppIcon';
import useIncidentHistory from '../hooks/useIncidentHistory';

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

function stepSubtext(step) {
  const meta = step.row?.meta || {};
  if (step.key === 'assigned') {
    const who = meta.responder_name || step.row?.actor_name;
    return who ? `to ${who}${meta.dept ? ` · ${meta.dept}` : ''}` : null;
  }
  if (step.key === 'arrived') {
    if (meta.method === 'manual') return meta.marked_by_name ? `Marked by ${meta.marked_by_name}` : 'Marked by staff';
    if (meta.method === 'gps') return 'GPS-verified';
    return null;
  }
  if (step.key === 'declined' && meta.reason) return meta.reason;
  return null;
}

const TONES = {
  done:     { ring: 'bg-emerald-500 text-white', text: 'text-slate-900', sub: 'text-slate-500' },
  current:  { ring: 'bg-taste-500 text-white ring-4 ring-taste-100', text: 'text-taste-600 font-semibold', sub: 'text-slate-500' },
  upcoming: { ring: 'bg-slate-200 text-slate-400', text: 'text-slate-400', sub: 'text-slate-400' },
  skipped:  { ring: 'bg-slate-100 text-slate-400', text: 'text-slate-400 line-through', sub: 'text-slate-400' },
  declined: { ring: 'bg-red-500 text-white', text: 'text-red-600 font-semibold', sub: 'text-slate-500' },
};

export default function IncidentTimeline({ report }) {
  const { rows } = useIncidentHistory(report?.id, !!report?.id);
  const steps = report ? buildSteps(report, rows) : [];

  return (
    <div>
      <p className="text-xs font-bold text-slate-500">Tracking</p>
      <ol aria-live="polite" className="mt-2 space-y-0">
        {steps.map((step, i) => {
          const tone = TONES[step.state] || TONES.upcoming;
          const sub = stepSubtext(step);
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
                {step.state === 'skipped' && <p className="text-xs text-slate-400">skipped</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
