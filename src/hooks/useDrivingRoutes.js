import { useEffect, useRef, useState } from 'react';

// Public OSRM demo server — free, no key, fair-use only (fine for a capstone
// demo; a production deployment should run its own OSRM/Valhalla instance).
const OSRM = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Street-following route geometries for a set of responder→incident pairs.
 *
 * Input:  [{ id, from: [lat, lng], to: [lat, lng], color? }]
 * Output: [{ id, positions: [[lat, lng], ...], color? }]
 *
 * While OSRM geometry is loading — or if it fails — the pair falls back to a
 * straight two-point line so the map always shows something.
 */
export default function useDrivingRoutes(pairs) {
  const [geometries, setGeometries] = useState({});
  const cache = useRef({}); // signature -> positions

  // A compact signature of all endpoints; only refetches when a responder or
  // incident actually moved (write throttle already limits churn to ~20 s).
  const signature = JSON.stringify(pairs);

  useEffect(() => {
    if (!pairs.length) {
      setGeometries({});
      return undefined;
    }
    let alive = true;
    pairs.forEach((p) => {
      const sig = JSON.stringify([p.from, p.to]);
      if (cache.current[sig]) {
        setGeometries(prev => (prev[p.id] === cache.current[sig] ? prev : { ...prev, [p.id]: cache.current[sig] }));
        return;
      }
      fetch(`${OSRM}/${p.from[1]},${p.from[0]};${p.to[1]},${p.to[0]}?overview=full&geometries=geojson`)
        .then(r => r.json())
        .then(json => {
          const coords = json?.routes?.[0]?.geometry?.coordinates;
          if (!alive || !coords?.length) return;
          const positions = coords.map(([lng, lat]) => [lat, lng]);
          cache.current[sig] = positions;
          setGeometries(prev => ({ ...prev, [p.id]: positions }));
        })
        .catch(() => { /* straight-line fallback stays */ });
    });
    return () => { alive = false; };
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  return pairs.map(p => ({
    id: p.id,
    color: p.color,
    positions: geometries[p.id] || [p.from, p.to],
  }));
}
