import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './AppIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Message thread between the incident reporter and the assigned responder.
// Requires the incident_messages table (20261104150000_incident_messages.sql);
// shows a quiet fallback if the migration has not been applied yet.
export default function IncidentChat({ reportId, title = 'Messages' }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    if (!reportId) return;
    const { data, error } = await supabase
      .from('incident_messages')
      .select('id, sender_id, body, created_at, sender:user_profiles!sender_id(full_name, role)')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });
    if (error) setError('Messaging is not available yet.');
    else setMessages(data || []);
  }, [reportId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`incident_messages_${reportId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incident_messages', filter: `report_id=eq.${reportId}` },
        async (payload) => {
          // Realtime payloads have no sender join — fetch the full row so the
          // sender's name renders instead of the 'Participant' fallback.
          const { data } = await supabase
            .from('incident_messages')
            .select('id, sender_id, body, created_at, sender:user_profiles!sender_id(full_name, role)')
            .eq('id', payload.new.id)
            .single();
          const row = data || payload.new;
          setMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev, row]);
        }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [reportId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !profile?.id || sending) return;
    setSending(true);
    setError('');
    const { error } = await supabase
      .from('incident_messages')
      .insert({ report_id: reportId, sender_id: profile.id, body });
    if (error) setError('Message could not be sent.');
    else setDraft('');
    setSending(false);
  };

  const senderName = (m) => {
    if (m.sender_id === profile?.id) return `You (${profile?.full_name || 'me'})`;
    return m.sender?.full_name || (m.sender?.role ? m.sender.role : 'Participant');
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
        <Icon name="MessageCircle" size={15} className="text-taste-600" />
        <p className="text-xs font-bold text-slate-500">{title}</p>
      </div>

      <div className="max-h-52 space-y-2 overflow-y-auto px-4 py-3">
        {error ? (
          <p className="py-2 text-center text-xs text-slate-500">{error}</p>
        ) : messages.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-400">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === profile?.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? 'bg-taste-500 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                  <p className={`text-[10px] font-bold ${mine ? 'text-white/80' : 'text-slate-400'}`}>{senderName(m)}</p>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-0.5 text-[10px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200 px-3 py-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Write a message…"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-taste-400"
        />
        <button
          onClick={send}
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-taste-500 text-white hover:bg-taste-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="Send" size={16} />
        </button>
      </div>
    </div>
  );
}
