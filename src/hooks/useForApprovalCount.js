import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Accurate "For Approval" count for the Residents & review badge/stats.
 * Mirrors registrantViews.forApproval: inactive profiles whose LATEST
 * non-superseded verification is pending/under_review, or who have no
 * verification row at all. Returned (needs_clarity/correction_required)
 * and rejected users stay inactive but are NOT counted — they only
 * re-enter the queue when they resubmit (new pending row).
 */
export default function useForApprovalCount(profile) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (profile?.role !== 'admin') { setCount(0); return undefined; }
    let alive = true;

    const load = async () => {
      const [{ data: inactive }, { data: vers }] = await Promise.all([
        supabase.from('user_profiles').select('id').eq('status', 'inactive'),
        supabase.from('id_verifications').select('user_id, verification_status, created_at'),
      ]);
      if (!alive) return;
      const latest = new Map();
      (vers ?? []).forEach(v => {
        if (v.verification_status === 'superseded') return;
        const prev = latest.get(v.user_id);
        if (!prev || new Date(v.created_at) > new Date(prev.created_at)) latest.set(v.user_id, v);
      });
      setCount((inactive ?? []).filter(u => {
        const s = latest.get(u.id)?.verification_status;
        return !s || s === 'pending' || s === 'under_review';
      }).length);
    };

    load();
    const channel = supabase
      .channel(`for-approval-count-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'id_verifications' }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [profile?.role]);

  return count;
}
