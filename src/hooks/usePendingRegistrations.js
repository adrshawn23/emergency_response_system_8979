import { useEffect, useId, useState } from 'react';
import { supabase } from '../lib/supabase';

// Pending registrations (status='inactive' profiles awaiting admin approval)
// for the sidebar badge. Admin-only: fetches on mount and stays live via a
// realtime subscription — same pattern as the emergency_reports badge.
// Returns the list plus its setter so approve/reject handlers can drop rows
// locally without waiting for the next realtime refresh.
// Module-level cache: route changes remount the consuming pages; seeding
// state from the last result keeps the badge visible while a fresh fetch
// runs, instead of flashing empty and reappearing.
let cachedPending = [];

const usePendingRegistrations = (profile) => {
  const [pendingUsers, setPendingUsersState] = useState(
    () => (profile?.role === 'admin' ? cachedPending : [])
  );
  const instanceId = useId();

  const setPendingUsers = (updater) => {
    setPendingUsersState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      cachedPending = next;
      return next;
    });
  };

  useEffect(() => {
    const fetchPendingUsers = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('status', 'inactive')
        .order('created_at', { ascending: false });

      if (data) setPendingUsers(data);
    };

    if (profile?.role !== 'admin') {
      cachedPending = [];
      setPendingUsersState([]);
      return undefined;
    }

    fetchPendingUsers();

    const channel = supabase
      // Unique per hook instance — Dashboard and WorkspacePage can both
      // subscribe; identical names throw "cannot add callbacks after
      // subscribe()" on the shared channel topic.
      .channel(`pending-registrations-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, fetchPendingUsers)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.role]);

  return [pendingUsers, setPendingUsers];
};

export default usePendingRegistrations;
