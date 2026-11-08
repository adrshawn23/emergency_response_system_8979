import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Pending registrations (status='inactive' profiles awaiting admin approval)
// for the sidebar badge. Admin-only: fetches on mount and stays live via a
// realtime subscription — same pattern as the emergency_reports badge.
// Returns the list plus its setter so approve/reject handlers can drop rows
// locally without waiting for the next realtime refresh.
const usePendingRegistrations = (profile) => {
  const [pendingUsers, setPendingUsers] = useState([]);

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
      setPendingUsers([]);
      return undefined;
    }

    fetchPendingUsers();

    const channel = supabase
      .channel('pending-registrations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, fetchPendingUsers)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.role]);

  return [pendingUsers, setPendingUsers];
};

export default usePendingRegistrations;
