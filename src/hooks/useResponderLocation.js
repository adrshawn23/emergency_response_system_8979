import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Live position of one responder from public.responder_locations.
 * Returns { latitude, longitude, updated_at } or null. RLS limits visibility:
 * staff see everyone, residents only the responder assigned to their own
 * open report — so callers just pass the report's assigned_to.
 */
export default function useResponderLocation(responderId, active = true) {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (!responderId || !active) {
      setLocation(null);
      return undefined;
    }
    let alive = true;

    supabase
      .from('responder_locations')
      .select('latitude, longitude, updated_at, user_profiles!responder_id(full_name, departments(name))')
      .eq('responder_id', responderId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) {
          setLocation({
            ...data,
            name: data.user_profiles?.full_name || null,
            dept: data.user_profiles?.departments?.name || null,
          });
        }
      });

    const channel = supabase
      .channel(`responder_loc_${responderId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'responder_locations',
        filter: `responder_id=eq.${responderId}`,
      }, (payload) => {
        if (alive) setLocation(prev => ({ ...payload.new, name: prev?.name, dept: prev?.dept }));
      })
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [responderId, active]);

  return location;
}
