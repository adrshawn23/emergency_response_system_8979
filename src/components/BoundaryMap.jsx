import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
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
const BoundaryMap = ({ marker = null, className = 'h-full w-full' }) => {
  const { points } = useServiceBoundary();
  const polygon = points.map(p => [p.lat, p.lng]);

  const fitPositions = polygon.length >= 3
    ? (marker ? [...polygon, marker] : polygon)
    : (marker ? [marker] : []);

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
        {marker && <Marker position={marker} />}
        <FitView positions={fitPositions} />
      </MapContainer>
    </div>
  );
};

export default BoundaryMap;
