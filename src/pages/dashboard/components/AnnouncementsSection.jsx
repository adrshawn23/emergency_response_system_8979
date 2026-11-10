import React, { useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import BoundaryMap from '../../../components/BoundaryMap';
import IncidentTimeline from '../../../components/IncidentTimeline';

/**
 * Announcements (specs/004 US2) — advisories broadcast by admins plus a live
 * feed of open incidents with map + full progress timeline. Realtime on
 * announcements / emergency_reports / incident_status_history / CDA keeps it
 * current without refresh (FR-006). Reporter PII is not rendered — only what
 * the tracking views already expose (type, location, status, unit progress).
 */

const SEVERITY = {
  info:     { chip: 'bg-blue-100 text-blue-700',    bar: 'border-l-blue-500',    label: 'Info' },
  warning:  { chip: 'bg-amber-100 text-amber-800',  bar: 'border-l-amber-500',   label: 'Warning' },
  critical: { chip: 'bg-red-100 text-red-700',      bar: 'border-l-red-500',     label: 'Critical' },
};

const OPEN_STATUSES = ['pending', 'assigned', 'in-progress', 'arrived'];

const reportCoords = (r) => {
  const a = r?.attachments ?? {};
  const lat = a.latitude ?? r.latitude;
  const lng = a.longitude ?? r.longitude;
  return (typeof lat === 'number' && typeof lng === 'number') ? [lat, lng] : null;
};

const IncidentCard = ({ report }) => {
  const marker = reportCoords(report);
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="Siren" size={16} className="text-red-600" />
          <span className="font-semibold text-foreground capitalize">{report.report_type || 'incident'} emergency</span>
          <span className="text-xs text-muted-foreground capitalize">{report.priority || 'standard'} priority</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(report.created_at).toLocaleString()}
        </span>
      </div>
      {marker && (
        <div className="h-44 border-b border-border">
          <BoundaryMap marker={marker} />
        </div>
      )}
      <div className="px-4 py-3">
        <p className="text-sm text-muted-foreground mb-3">{report.attachments?.location || 'Location pending'}</p>
        <IncidentTimeline report={report} />
      </div>
    </div>
  );
};

const AnnouncementsSection = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  // Live incident cards (maps + unit progress) are a resident-facing view;
  // staff track the same data on their own queue/command pages.
  const showLiveIncidents = profile?.role === 'resident';

  const [announcements, setAnnouncements] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', severity: 'info', audience: 'residents' });
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [{ data: anns }, { data: reps }] = await Promise.all([
      supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(30),
      showLiveIncidents
        ? supabase.from('emergency_reports_list').select('*').in('status', OPEN_STATUSES).order('created_at', { ascending: false }).limit(10)
        : Promise.resolve({ data: [] }),
    ]);
    setAnnouncements(anns ?? []);
    setIncidents(reps ?? []);
  };

  useEffect(() => {
    load();
    // Realtime: advisories + every step of incident progress (FR-006).
    const channel = supabase
      .channel('announcements_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_status_history' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cross_department_assistance' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const publish = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim() || posting) return;
    setPosting(true);
    setMsg('');
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title: form.title.trim(),
        body: form.body.trim(),
        severity: form.severity,
        created_by: profile.id,
      })
      .select('id')
      .single();
    setPosting(false);
    if (error) { setMsg(error.message); return; }
    // Advisory email to the chosen audience — fire-and-forget (FR-009/010).
    supabase.functions.invoke('broadcast-incident', { body: { kind: 'announcement', announcement_id: data.id, audience: form.audience } })
      .catch(err => console.warn('broadcast-incident failed:', err?.message ?? err));
    const label = { residents: 'all residents', staff: 'staff', everyone: 'residents and staff' }[form.audience] || 'all residents';
    setForm({ title: '', body: '', severity: 'info', audience: form.audience });
    setMsg(`Advisory published and emailed to ${label}.`);
    load();
  };

  return (
    <div className="mt-7 space-y-6">
      {isAdmin && (
        <form onSubmit={publish} className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Icon name="Megaphone" size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">Broadcast advisory</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Advisory title"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
            />
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.severity}
              onChange={e => setForm({ ...form, severity: e.target.value })}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={3}
            placeholder="Advisory details — hazards, areas to avoid, instructions…"
            value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })}
            required
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-slate-500">
              Email to
              <select
                className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.audience}
                onChange={e => setForm({ ...form, audience: e.target.value })}
              >
                <option value="residents">All residents</option>
                <option value="staff">Staff only</option>
                <option value="everyone">Residents + staff</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={posting}
              className="rounded-lg bg-taste-500 px-4 py-2 text-sm font-semibold text-white hover:bg-taste-600 disabled:opacity-50"
            >
              {posting ? 'Publishing…' : 'Publish + email'}
            </button>
            {msg && <span className="text-sm text-taste-600">{msg}</span>}
          </div>
        </form>
      )}

      <section>
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
          <Icon name="Megaphone" size={16} className="text-primary" /> Advisories
        </h3>
        {announcements.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No advisories posted yet.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map(a => {
              const sev = SEVERITY[a.severity] || SEVERITY.info;
              return (
                <div key={a.id} className={`rounded-lg border border-border border-l-4 ${sev.bar} bg-card p-4`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{a.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sev.chip}`}>{sev.label}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showLiveIncidents && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <Icon name="Activity" size={16} className="text-primary" /> Live incidents
          </h3>
          {incidents.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No open incidents right now.</p>
          ) : (
            <div className="space-y-4">
              {incidents.map(r => <IncidentCard key={r.id} report={r} />)}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default AnnouncementsSection;
