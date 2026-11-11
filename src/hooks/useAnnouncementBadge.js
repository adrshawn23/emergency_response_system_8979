import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// 'arrived' is a status-history event, not a report_status enum value —
// including it makes PostgREST reject the whole in() filter (400).
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

// Visiting the Announcements page marks every current item seen at once —
// Facebook semantics: the badge clears on view and only re-counts items
// that arrive afterwards.
export const markAllAnnouncementsSeen = (uid, ids) => {
  if (!uid || !ids?.length) return;
  const seen = getSeenIds(uid);
  ids.forEach(id => seen.add(id));
  localStorage.setItem(seenKey(uid), JSON.stringify([...seen].slice(-500)));
  window.dispatchEvent(new Event(SEEN_EVENT));
};

/**
 * Unseen count for the Announcements nav badge:
 *   residents → advisories + open (live) incidents
 *   staff     → advisories only (live incidents aren't shown to them)
 * Items the user already opened are excluded via localStorage seen-ids.
 */
// Route changes remount every nav list — seeding from the last count keeps
// the badge stable instead of flashing 0 → N on each page switch.
const countCache = {};

export default function useAnnouncementBadge(profile, enabled = true) {
  const uid = profile?.id;
  const role = profile?.role;
  const [count, setCount] = useState(() => countCache[uid] ?? 0);

  useEffect(() => {
    // Admins publish the advisories themselves — no unread badge for them.
    if (!enabled || !uid || role === 'admin') return undefined;
    let alive = true;

    // Signature guard: realtime fires on every row update (status changes,
    // responder writes), and consecutive refetches can briefly disagree on
    // the id list — comparing before setCount stops the visible flicker.
    let lastKey = null;
    const load = async () => {
      const { data: anns } = await supabase
        .from('announcements').select('id').order('created_at', { ascending: false }).limit(100);
      let ids = (anns ?? []).map(a => a.id);
      if (role === 'resident') {
        // Same feed as AnnouncementsSection — today's incidents (public_incidents).
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: inc } = await supabase
          .from('public_incidents').select('id').gte('created_at', today.toISOString())
          .order('created_at', { ascending: false }).limit(50);
        ids = ids.concat((inc ?? []).map(r => r.id));
      }
      if (!alive) return;
      const seen = getSeenIds(uid);
      const unseen = ids.filter(id => !seen.has(id));
      const key = unseen.join('|');
      if (key !== lastKey) {
        lastKey = key;
        countCache[uid] = unseen.length;
        setCount(unseen.length);
      }
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
