import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const OPEN_STATUSES = ['pending', 'assigned', 'in-progress', 'arrived'];

/**
 * Count for the Announcements nav badge:
 *   residents → advisories + open (live) incidents
 *   staff     → advisories only (live incidents aren't shown to them)
 * Realtime on announcements + emergency_reports keeps it current.
 */
export default function useAnnouncementBadge(role, enabled = true) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;

    const load = async () => {
      const { count: anns } = await supabase
        .from('announcements')
        .select('id', { count: 'exact', head: true });
      let total = anns ?? 0;
      if (role === 'resident') {
        const { count: inc } = await supabase
          .from('emergency_reports_list')
          .select('id', { count: 'exact', head: true })
          .in('status', OPEN_STATUSES);
        total += inc ?? 0;
      }
      if (alive) setCount(total);
    };

    load();
    const channel = supabase
      .channel(`ann_badge_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, load)
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [role, enabled]);

  return count;
}
