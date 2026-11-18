import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Polygon, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../../../utils/leafletIcon';
import { incidentIcon, INCIDENT_TYPE_STYLE } from '../../../utils/leafletIcon';
import { reportCoords } from '../../../utils/reportCoords';
import { haversineMeters } from '../../../utils/distance';
import { RESPONSE_GUIDE } from '../../../utils/incidentResponse';
import useServiceBoundary from '../../../hooks/useServiceBoundary';
import Icon from '../../../components/AppIcon';

// Kalubihan service-area center — same origin as the command map.
const CENTER = [10.3172, 123.8951];
const RADIUS_M = 100;   // hotspot circle radius, per spec
const HOTSPOT_MIN = 4;  // "more than 3" same-type incidents in the radius

const typeOf = r => (r.report_type || r.emergency_type || r.incident_type || 'other');
const typeLabel = t => RESPONSE_GUIDE[t]?.label || t.charAt(0).toUpperCase() + t.slice(1);

// Suggested barangay action per type — the "analysis" layer under the map.
const ACTIONS = {
  fire:       'recommend fire-watch patrols and early BFP coordination for this area',
  flood:      'recommend drainage clearing and early-warning advisories here',
  theft:      'recommend increased Tanod visibility patrols, especially at night',
  medical:    'recommend first-aid team readiness and health-post coverage here',
  accident:   'recommend traffic calming and signage review on this stretch',
  assault:    'recommend sustained Tanod presence and PNP coordination here',
  structural: 'recommend pre-emptive inspection and clearing operations here',
  other:      'recommend a barangay response review of this area',
};

// Same-type density scan: a "seed" is any incident with >= HOTSPOT_MIN
// same-type incidents inside RADIUS_M. Seeds within RADIUS_M of each other
// merge into one hotspot; the circle sits at the merged centroid and the
// count is all same-type points falling inside it.
const findHotspots = (pts) => {
  const byType = {};
  pts.forEach(p => { (byType[p.type] = byType[p.type] || []).push(p); });
  const spots = [];
  Object.entries(byType).forEach(([type, arr]) => {
    const seeds = arr.filter(p =>
      arr.filter(q => (haversineMeters(p.pos, q.pos) ?? Infinity) <= RADIUS_M).length >= HOTSPOT_MIN);
    const parent = seeds.map((_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    seeds.forEach((a, i) => seeds.forEach((b, j) => {
      if (i < j && (haversineMeters(a.pos, b.pos) ?? Infinity) <= RADIUS_M) parent[find(i)] = find(j);
    }));
    const groups = {};
    seeds.forEach((s, i) => { (groups[find(i)] = groups[find(i)] || []).push(s); });
    Object.values(groups).forEach(g => {
      const center = [
        g.reduce((s, p) => s + p.pos[0], 0) / g.length,
        g.reduce((s, p) => s + p.pos[1], 0) / g.length,
      ];
      const count = arr.filter(p => (haversineMeters(center, p.pos) ?? Infinity) <= RADIUS_M).length;
      spots.push({ type, center, count });
    });
  });
  return spots.sort((a, b) => b.count - a.count);
};

// The map always frames the barangay service boundary — incident spread
// inside it doesn't pull the zoom out. Falls back to incident extents when
// no boundary is configured.
const FitBounds = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds?.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
  }, [bounds, map]);
  return null;
};

const IncidentHotspotMap = ({ rows }) => {
  const { points: boundaryPoints } = useServiceBoundary();
  const pts = useMemo(() => (rows || [])
    .map(r => ({ r, type: typeOf(r), pos: reportCoords(r) }))
    .filter(p => p.pos), [rows]);

  const focusBounds = useMemo(() =>
    boundaryPoints.length > 2
      ? boundaryPoints.map(p => [p.lat, p.lng])
      : pts.map(p => p.pos),
    [boundaryPoints, pts]);

  const hotspots = useMemo(() => findHotspots(pts), [pts]);
  const presentTypes = useMemo(() => [...new Set(pts.map(p => p.type))].sort(), [pts]);

  return (
    <div className="border-t border-slate-100 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Incident hotspot map</p>
        <p className="text-xs text-slate-500">
          {pts.length
            ? <>{pts.length} located incident{pts.length === 1 ? '' : 's'} · red circles = {HOTSPOT_MIN}+ same-type reports within {RADIUS_M} m</>
            : 'No geolocated incidents in this period'}
        </p>
      </div>

      <div className="relative mt-3 h-[380px] overflow-hidden rounded-xl border border-slate-200">
        <MapContainer center={CENTER} zoom={15} zoomAnimation={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds bounds={focusBounds} />
          {boundaryPoints.length > 2 && (
            <Polygon
              positions={focusBounds}
              pathOptions={{ color: '#14335c', weight: 2, dashArray: '8 4', fillOpacity: 0.04 }}
            />
          )}
          {pts.map((p, i) => (
            <Marker key={p.r.id || p.r.report_id || i} position={p.pos} icon={incidentIcon(p.type)}>
              <Popup>
                <div className="text-xs">
                  <p className="font-bold capitalize">{typeLabel(p.type)}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">{p.r.report_id || ''}</p>
                  <p className="mt-1">{p.r.location || p.r.attachments?.location || '—'}</p>
                  <p className="mt-0.5 text-slate-500 capitalize">{p.r.status || ''} · {p.r.created_at ? new Date(p.r.created_at).toLocaleDateString() : ''}</p>
                </div>
              </Popup>
            </Marker>
          ))}
          {hotspots.map((h, i) => (
            <Circle
              key={`hot-${i}`}
              center={h.center}
              radius={RADIUS_M}
              pathOptions={{ color: '#dc2626', weight: 2, dashArray: '6 4', fillColor: '#dc2626', fillOpacity: 0.13 }}
            >
              <Tooltip permanent direction="center" className="hotspot-tip">
                <span style={{ fontWeight: 700 }}>{h.count}× {typeLabel(h.type)}</span>
              </Tooltip>
            </Circle>
          ))}
        </MapContainer>

        {/* Legend — sits above Leaflet panes (z-400-ish) */}
        {presentTypes.length > 0 && (
          <div className="absolute right-3 top-3 z-[500] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Legend</p>
            {presentTypes.map(t => {
              const s = INCIDENT_TYPE_STYLE[t] || INCIDENT_TYPE_STYLE.other;
              return (
                <div key={t} className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white shadow"
                    style={{ background: s.c }}
                  >{s.l}</span>
                  {typeLabel(t)}
                </div>
              );
            })}
            <div className="mt-1.5 flex items-center gap-1.5 border-t border-slate-100 pt-1.5 text-[11px] text-slate-600">
              <span className="h-4 w-4 rounded-full border-2 border-dashed border-red-600 bg-red-600/10" />
              Hotspot ({HOTSPOT_MIN}+ / {RADIUS_M} m)
            </div>
          </div>
        )}
      </div>

      {/* Rule-based insight lines — generated from the detected hotspots */}
      <div className="mt-3 space-y-1.5">
        {hotspots.map((h, i) => (
          <p key={i} className="flex items-start gap-2 text-xs text-slate-700">
            <Icon name="AlertTriangle" size={13} className="mt-0.5 shrink-0 text-red-600" />
            <span>
              <b className="capitalize">{typeLabel(h.type)} hotspot</b> — this {RADIUS_M} m radius has{' '}
              <b>{h.count} {typeLabel(h.type).toLowerCase()} incident{h.count === 1 ? '' : 's'}</b>, making it the
              top {typeLabel(h.type).toLowerCase()}-prone area this period; {ACTIONS[h.type] || ACTIONS.other}.
            </span>
          </p>
        ))}
        {pts.length > 0 && hotspots.length === 0 && (
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <Icon name="CheckCircle2" size={13} className="mt-0.5 shrink-0 text-emerald-600" />
            No hotspots this period — no incident type reached {HOTSPOT_MIN}+ reports within {RADIUS_M} m.
          </p>
        )}
        {pts.length === 0 && (
          <p className="text-xs text-slate-400">Incidents need GPS coordinates to appear on this map.</p>
        )}
      </div>
    </div>
  );
};

export default IncidentHotspotMap;
