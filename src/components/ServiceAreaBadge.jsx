import React from 'react';
import useServiceBoundary from '../hooks/useServiceBoundary';
import { isPointInBoundary } from '../utils/geofence';
import { reportCoords } from '../utils/reportCoords';

/**
 * Service-area verdict for an incident: inside or outside the active
 * geofence. Order of truth:
 *  1. The status recorded at filing time ('inside'/'outside').
 *  2. A live re-check of the report's coordinates against the active
 *     boundary — covers reports filed as 'manual'/'staff'/pre-geofence.
 *  3. 'Unverified' when neither the stored status nor a live check is
 *     possible (no coordinates, no active boundary).
 *
 * Usage: <ServiceAreaBadge report={selectedReport} />
 */
export default function ServiceAreaBadge({ report }) {
  const { points, loaded } = useServiceBoundary();
  const stored = report?.attachments?.service_area_status;

  let verdict = null;
  let note = null;

  if (stored === 'inside' || stored === 'outside') {
    verdict = stored;
    note = 'recorded at filing';
  } else {
    const coords = reportCoords(report);
    if (loaded && coords && points.length >= 3) {
      const inside = isPointInBoundary(
        { latitude: coords[0], longitude: coords[1] },
        points
      );
      if (inside !== null) {
        verdict = inside ? 'inside' : 'outside';
        note = 'checked vs active boundary';
      }
    }
  }

  const label = verdict === 'inside'
    ? 'Inside service area'
    : verdict === 'outside'
      ? 'Outside service area'
      : 'Unverified';

  const tone = verdict === 'inside'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : verdict === 'outside'
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : 'bg-slate-50 text-slate-600 ring-slate-200';

  const detail = [
    note,
    stored && stored !== verdict ? `filed as ${stored}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div>
      <p className="text-xs font-bold text-slate-500">Service Area</p>
      <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}>
        {label}
      </span>
      {detail && <p className="mt-1 text-xs capitalize text-slate-500">{detail}</p>}
    </div>
  );
}
