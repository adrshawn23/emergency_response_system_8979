import React, { useEffect, useState } from 'react';
import Icon from './AppIcon';
import { supabase } from '../lib/supabase';
import BoundaryMap from './BoundaryMap';
import ServiceAreaBadge from './ServiceAreaBadge';
import IncidentTimeline from './IncidentTimeline';
import IncidentChat from './IncidentChat';
import useEscapeKey from '../hooks/useEscapeKey';
import { reportCoords } from '../utils/reportCoords';

/**
 * One incident detail modal for every surface that opens a report —
 * resident home, live-incident feed, report history. Mirrors the staff
 * queue modal so residents and dispatch see the same layout.
 *
 * Props:
 *   report            — report row (slim-view or full; public feed rows
 *                       already have reporter PII stripped by the view)
 *   onClose           — dismiss handler
 *   markers           — extra map markers (live responder pins)
 *   route             — route polyline positions for the map
 *   mapNote           — caption under the map (e.g. "Responders live — …")
 *   chatTitle         — render IncidentChat with this title when set
 *                       (only for the reporter or assigned staff)
 *   showReporterContact — render the reporter name/phone block
 *                       (own report or staff view only)
 *   footer            — extra action buttons above the Close button
 */
export default function IncidentDetailModal({
  report,
  onClose,
  markers = null,
  route = null,
  mapNote = null,
  chatTitle = null,
  showReporterContact = false,
  footer = null,
}) {
  useEscapeKey(onClose, !!report);
  const [mediaAttachments, setMediaAttachments] = useState(null);

  // List feeds ship slim attachments (media >8KB stripped). Pull the full
  // row on open — succeeds for the reporter and staff; RLS quietly returns
  // nothing for other residents, which is the intended PII boundary.
  useEffect(() => {
    setMediaAttachments(null);
    if (!report?.id) return undefined;
    let alive = true;
    supabase
      .from('emergency_reports')
      .select('attachments')
      .eq('id', report.id)
      .maybeSingle()
      .then(({ data }) => { if (alive && data?.attachments) setMediaAttachments(data.attachments); });
    return () => { alive = false; };
  }, [report?.id]);

  if (!report) return null;

  const attachments = mediaAttachments || report.attachments || {};
  const coords = reportCoords(report);
  const type = report.report_type || report.incident_type || report.emergency_type || 'incident';
  const ref = report.report_id || report.id?.slice(0, 8);
  const contactName = attachments.contact_name;
  const contactPhone = attachments.contact_phone;

  return (
    <div
      className="fixed inset-0 z-1050 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600">
              <Icon name={type === 'medical' ? 'HeartPulse' : 'Siren'} size={20}/>
            </div>
            <div>
              <p className="font-semibold capitalize">{type} emergency</p>
              <p className="font-mono text-xs text-slate-500">{ref}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-taste-50 px-2 py-1 text-[10px] font-bold uppercase text-taste-600">
              {report.status || 'pending'}
            </span>
            <button onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
              <Icon name="X" size={18}/>
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <p className="text-xs font-bold text-slate-500">Description</p>
            <p className="mt-1 text-sm text-slate-700">{report.content || report.description || 'No description provided.'}</p>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500">Location</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Icon name="MapPin" size={14} className="shrink-0 text-taste-500"/>
              <p className="text-sm text-slate-700">{attachments.location || report.location || 'No location recorded'}</p>
            </div>
            {coords && (
              <p className="mt-0.5 pl-5 font-mono text-xs text-slate-400">GPS: {coords[0].toFixed(6)}, {coords[1].toFixed(6)}</p>
            )}
            {coords ? (
              <>
                <div className="mt-2 h-56 overflow-hidden rounded-lg border border-slate-200">
                  <BoundaryMap
                    marker={coords}
                    markers={markers}
                    route={route}
                    radius={150}
                  />
                </div>
                {mapNote && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <Icon name="Navigation" size={12} className="text-blue-600"/>
                    {mapNote}
                  </p>
                )}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  <Icon name="Navigation" size={13}/> Navigate to scene
                </a>
              </>
            ) : (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">No GPS coordinates were captured for this incident — map unavailable.</p>
            )}
          </div>

          {Array.isArray(attachments.images) && attachments.images.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500">Evidence photos</p>
              <div className="mt-1 grid max-h-48 grid-cols-3 gap-2 overflow-y-auto">
                {attachments.images.map((img, i) => (
                  <img
                    key={i}
                    src={img.url || img}
                    alt={`Evidence ${i + 1}`}
                    className="h-20 w-full rounded-lg border border-slate-200 object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          {attachments.resolution_proof && (
            <div>
              <p className="text-xs font-bold text-slate-500">Resolution proof</p>
              <img
                src={attachments.resolution_proof}
                alt="Resolution proof"
                className="mt-1 h-28 w-40 rounded-lg border border-slate-200 object-cover"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-slate-500">Priority</p>
              <p className="mt-1 text-sm font-semibold capitalize">{report.priority || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">Reported</p>
              <p className="mt-1 text-sm text-slate-700">{report.created_at ? new Date(report.created_at).toLocaleString() : 'N/A'}</p>
            </div>
            {showReporterContact && (
              <div>
                <p className="text-xs font-bold text-slate-500">Reporter contact</p>
                <p className="mt-1 text-sm text-slate-700">{contactName || 'N/A'}</p>
                <p className="text-xs text-slate-500">{contactPhone || ''}</p>
              </div>
            )}
            <ServiceAreaBadge report={report} />
          </div>

          <IncidentTimeline report={report} />

          {chatTitle && report.id && <IncidentChat reportId={report.id} title={chatTitle}/>}
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-6 py-4">
          {footer}
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
