import { useEffect, useState, useId } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Ordered transition history for one incident — the timeline's data source.
 * Rows: { id, from_status, to_status, actor_id, meta, created_at, actor_name }
 * Realtime keeps an open modal current (unique channel per subscriber,
 * removeChannel on cleanup — realtime discipline).
 * RLS scopes reads: reporter sees own incidents, staff see all.
 */
export default function useIncidentHistory(reportId, active = true) {
  const uid = useId();
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!reportId || !active) {
      setRows([]);
      setLoaded(false);
      return undefined;
    }
    let alive = true;

    const upsert = (row) => {
      if (!row?.id) return;
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.id === row.id);
        const next = idx >= 0
          ? prev.map((r, i) => (i === idx ? { ...r, ...row } : r))
          : [...prev, row];
        return next.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });
    };

    supabase
      .from('incident_status_history')
      .select('id, report_id, from_status, to_status, actor_id, meta, created_at, actor:user_profiles!actor_id(full_name)')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!alive || !data) { if (alive) setLoaded(true); return; }
        setRows(data.map((r) => ({ ...r, actor_name: r.actor?.full_name || null })));
        setLoaded(true);
      });

    const channel = supabase
      .channel(`inc_history_${reportId}_${uid}_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'incident_status_history',
        filter: `report_id=eq.${reportId}`,
      }, (payload) => {
        if (!alive) return;
        if (payload.eventType === 'DELETE') {
          setRows((prev) => prev.filter((r) => r.id !== payload.old?.id));
        } else {
          upsert(payload.new);
        }
      })
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [reportId, active, uid]);

  return { rows, loaded };
}
