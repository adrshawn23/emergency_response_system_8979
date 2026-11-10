import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const OPEN_STATUSES = ['pending', 'assigned', 'in-progress', 'arrived'];
const SEEN_EVENT = 'announcement-seen';
const seenKey = (uid) => `ann-seen-${uid}`;

export const getSeenIds = (uid) => {
  try { return new Set(JSON.parse(localStorage.getItem(seenKey(uid)) || '[]')); }
  catch { return new Set(); }
};

// Called when the user opens an advisory or live-incident card — every hook
// instance hears the event and recomputes, so the nav badge drops by one.
export const markAnnouncementSeen = (uid, id) => {
  if (!uid || !id) return;
  const seen = getSeenIds(uid);
  if (seen.has(id)) return;
  seen.add(id);
  localStorage.setItem(seenKey(uid), JSON.stringify([...seen].slice(-500)));
  window.dispatchEvent(new Event(SEEN_EVENT));
};

/**
 * Unseen count for the Announcements nav badge:
 *   residents → advisories + open (live) incidents
 *   staff     → advisories only (live incidents aren't shown to them)
 * Items the user already opened are excluded via localStorage seen-ids.
 */
export default function useAnnouncementBadge(profile, enabled = true) {
  const [count, setCount] = useState(0);
  const uid = profile?.id;
  const role = profile?.role;

  useEffect(() => {
    if (!enabled || !uid) return undefined;
    let alive = true;

    const load = async () => {
      const { data: anns } = await supabase
        .from('announcements').select('id').order('created_at', { ascending: false }).limit(100);
      let ids = (anns ?? []).map(a => a.id);
      if (role === 'resident') {
        const { data: inc } = await supabase
          .from('emergency_reports_list').select('id').in('status', OPEN_STATUSES).limit(50);
        ids = ids.concat((inc ?? []).map(r => r.id));
      }
      if (!alive) return;
      const seen = getSeenIds(uid);
      setCount(ids.filter(id => !seen.has(id)).length);
    };

    load();
    const onSeen = () => load();
    window.addEventListener(SEEN_EVENT, onSeen);
    const channel = supabase
      .channel(`ann_badge_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, load)
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
      window.removeEventListener(SEEN_EVENT, onSeen);
    };
  }, [uid, role, enabled]);

  return count;
}
