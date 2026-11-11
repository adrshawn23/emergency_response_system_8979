import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Read one numeric app_settings key (admin-tunable knobs like
 * arrival_radius_m / incident_radius_m). Returns `fallback` until the row
 * loads or if it's missing/invalid — the app must work before the
 * migration that seeds the key is applied.
 */
export default function useAppSetting(key, fallback) {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    let alive = true;
    supabase.from('app_settings').select('value').eq('key', key).maybeSingle()
      .then(({ data }) => {
        const v = Number(data?.value);
        if (alive && Number.isFinite(v) && v > 0) setValue(v);
      });
    return () => { alive = false; };
  }, [key]);

  return value;
}
