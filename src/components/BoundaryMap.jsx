import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../utils/leafletIcon';
import useServiceBoundary from '../hooks/useServiceBoundary';

const KALUBIHAN_CENTER = [10.3172, 123.8951];

// Fits the map once per change of the boundary/marker set — a positions
// signature keeps re-renders from constantly yanking the user's view.
const FitView = ({ positions }) => {
  const map = useMap();
  const signature = JSON.stringify(positions);
  const last = useRef(null);
  useEffect(() => {
    if (positions.length && signature !== last.current) {
      last.current = signature;
      map.fitBounds(positions, { padding: [24, 24] });
    }
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

/**
 * Read-only map used for incident/location detail views. Always draws the
 * active service boundary (teal polygon) and optionally one marker.
 *
 *   <BoundaryMap marker={[lat, lng]} />
 *   <BoundaryMap />                       // boundary only
 *   <BoundaryMap marker={...} className="h-56" />
 */
const BoundaryMap = ({ marker = null, markers = [], route = null, className = 'h-full w-full' }) => {
  const { points } = useServiceBoundary();
  const polygon = points.map(p => [p.lat, p.lng]);
  // `route` may be one line ([[lat,lng],[lat,lng]]), a list of lines, or a
  // list of { positions, color } entries for differently colored routes.
  const routeList = route
    ? (typeof route[0]?.[0] === 'number'
        ? [{ positions: route }]
        : route
            .map(r => (Array.isArray(r) ? { positions: r } : r))
            .filter(r => Array.isArray(r?.positions) && r.positions.length > 1))
    : [];
  const extraPositions = [...markers.map(m => m.position), ...routeList.flatMap(r => r.positions)];

  const fitPositions = polygon.length >= 3
    ? (marker ? [...polygon, marker, ...extraPositions] : [...polygon, ...extraPositions])
    : (marker ? [marker, ...extraPositions] : extraPositions);

  return (
    <div className={className}>
      <MapContainer center={KALUBIHAN_CENTER} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {polygon.length >= 3 && (
          <Polygon positions={polygon} color="#1b6c80" fillColor="#1b6c80" fillOpacity={0.08} />
        )}
        {routeList.map((r, i) => (
          <Polyline key={i} positions={r.positions} color={r.color || '#2563eb'} weight={3} dashArray="6 8" opacity={0.75} />
        ))}
        {marker && <Marker position={marker} />}
        {markers.map((m, i) => (
          <Marker key={i} position={m.position} icon={m.icon || undefined} />
        ))}
        <FitView positions={fitPositions} />
      </MapContainer>
    </div>
  );
};

export default BoundaryMap;
