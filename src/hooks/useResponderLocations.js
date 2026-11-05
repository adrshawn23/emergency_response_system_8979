import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Live positions of ALL broadcasting responders — staff-only read per RLS.
 * Returns a map { [responder_id]: { latitude, longitude, updated_at, name } }.
 * The name join depends on the caller's user_profiles read rights; falls
 * back to a null name if it cannot resolve.
 */
export default function useResponderLocations(active = true) {
  const [locations, setLocations] = useState({});

  useEffect(() => {
    if (!active) {
      setLocations({});
      return undefined;
    }
    let alive = true;

    const upsert = (row) => {
      if (!row?.responder_id) return;
      setLocations(prev => ({
        ...prev,
        [row.responder_id]: {
          latitude: row.latitude,
          longitude: row.longitude,
          updated_at: row.updated_at,
          name: row.user_profiles?.full_name || prev[row.responder_id]?.name || null,
          dept: row.user_profiles?.departments?.name || prev[row.responder_id]?.dept || null,
        },
      }));
    };

    supabase
      .from('responder_locations')
      .select('responder_id, latitude, longitude, updated_at, user_profiles!responder_id(full_name, departments(name))')
      .then(({ data }) => {
        if (!alive || !data) return;
        data.forEach(upsert);
      });

    const channel = supabase
      .channel('responder_locations_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responder_locations' },
        (payload) => {
          if (!alive) return;
          if (payload.eventType === 'DELETE') {
            setLocations(prev => {
              const next = { ...prev };
              delete next[payload.old?.responder_id];
              return next;
            });
          } else {
            upsert(payload.new);
          }
        })
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [active]);

  return locations;
}
