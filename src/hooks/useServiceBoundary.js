import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Single source for the administrator-managed service boundary.
 * Reads the active geofence_boundaries row from Supabase (the row LocationInput
 * already uses for resident inside/outside checks); falls back to the
 * legacy localStorage copy for mock/offline mode.
 *
 * Exposes points normalized to { lat, lng } for react-leaflet, plus a
 * save() that deactivates the previous DB boundary, inserts the new active
 * polygon, and mirrors to localStorage. If the DB write fails (RLS,
 * offline), the local copy still saves so mock mode keeps working.
 */
export default function useServiceBoundary() {
  const [points, setPoints] = useState([]);
  const [name, setName] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('geofence_boundaries')
          .select('name, points')
          .eq('is_active', true)
          .maybeSingle();
        if (!cancelled && data?.points?.length >= 3) {
          setPoints(data.points.map(p => ({
            lat: p.latitude ?? p.lat,
            lng: p.longitude ?? p.lng
          })));
          setName(data.name ?? 'configured service boundary');
          setLoaded(true);
          return;
        }
      } catch (e) {
        console.warn('Boundary load from Supabase failed, trying localStorage:', e?.message);
      }
      // Mock/offline fallback
      try {
        const saved = localStorage.getItem('service_boundary');
        const parsed = saved && JSON.parse(saved);
        if (!cancelled && parsed?.points?.length >= 3) {
          setPoints(parsed.points.map(p => ({
            lat: p.latitude ?? p.lat,
            lng: p.longitude ?? p.lng
          })));
          setName('local draft boundary');
        }
      } catch {}
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async (nextPoints, boundaryName = 'Barangay Kalubihan') => {
    const stored = nextPoints.map(p => ({
      latitude: p.lat ?? p.latitude,
      longitude: p.lng ?? p.longitude
    }));
    try {
      localStorage.setItem('service_boundary', JSON.stringify({ points: stored }));
    } catch {}
    setPoints(nextPoints);
    setName(boundaryName);
    try {
      await supabase
        .from('geofence_boundaries')
        .update({ is_active: false })
        .eq('is_active', true);
      const { error } = await supabase
        .from('geofence_boundaries')
        .insert({ name: boundaryName, points: stored, is_active: true });
      if (error) throw error;
      return { ok: true };
    } catch (e) {
      console.warn('Boundary saved locally; Supabase write failed:', e?.message);
      return { ok: false, error: e?.message };
    }
  }, []);

  return { points, name, loaded, setPoints, save };
}
