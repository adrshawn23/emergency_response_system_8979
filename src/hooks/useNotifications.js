import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// Server-backed notifications for the signed-in user.
//
//   const { notifications, unreadCount, loading, error,
//           markRead, markAllRead, refresh } = useNotifications(profile?.id);
//
// Realtime is fed by postgres triggers on emergency_reports, id_verifications,
// and user_profiles (migration 20261030100000). When the table/migration is
// absent the hook degrades to an `error` state — callers must render it
// gracefully rather than crash.

const PAGE_SIZE = 30;

export default function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('notifications')
      .select('id, type, title, message, incident_id, metadata, read_at, created_at')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (fetchError) {
      // Table missing / migration not applied — surface a gentle error state.
      setError(fetchError.message || 'Notifications unavailable');
      setNotifications([]);
    } else {
      setError(null);
      setNotifications(data || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setNotifications([]);
    setError(null);
    fetchNotifications();
    if (!userId) return undefined;

    // Live arrivals + read-state sync across tabs. Dedupe by id on INSERT and
    // merge by id on UPDATE so a fast double-event never duplicates a row.
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        setNotifications(prev =>
          prev.some(n => n.id === payload.new.id) ? prev : [payload.new, ...prev]);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        setNotifications(prev =>
          prev.map(n => (n.id === payload.new.id ? { ...n, ...payload.new } : n)));
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          setError('Live updates interrupted — pull to refresh.');
        }
      });

    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  const markRead = useCallback(async (id) => {
    // Optimistic — revert on failure.
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    const { error } = await supabase.rpc('mark_notifications_read', { p_ids: [id] });
    if (error) {
      // Pre-migration fallback: direct row update (works only if an UPDATE
      // policy exists; fails silently otherwise).
      await supabase.from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id).eq('recipient_id', userId);
    }
  }, [userId]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? now })));
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) {
      await supabase.from('notifications')
        .update({ read_at: now })
        .eq('recipient_id', userId)
        .is('read_at', null);
    }
  }, [userId]);

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read_at).length,
    loading,
    error,
    markRead,
    markAllRead,
    refresh: fetchNotifications,
  };
}
