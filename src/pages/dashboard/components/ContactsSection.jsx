import React, { useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * Contacts directory (specs/004 US1) — everyone reads active entries, admins
 * get an inline editor (create / edit / deactivate / reorder). Entries with
 * no department are "general" hotlines. Realtime pushes edits to every
 * session without a deploy.
 */

const CHANNEL_ICON = { phone: 'Phone', radio: 'Radio', email: 'Mail', other: 'Info' };
const EMPTY = { label: '', channel: 'phone', value: '', description: '', department_id: '', sort_order: 0, active: true };

const ContactsSection = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [entries, setEntries] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [{ data: contacts }, { data: depts }] = await Promise.all([
      supabase.from('department_contacts').select('*, dept:departments!department_id(name)').order('sort_order').order('created_at'),
      supabase.from('departments').select('id, name').order('name'),
    ]);
    setEntries(contacts ?? []);
    setDepartments(depts ?? []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('contacts_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'department_contacts' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!form.label.trim() || !form.value.trim() || saving) return;
    setSaving(true);
    setMsg('');
    const payload = {
      label: form.label.trim(),
      channel: form.channel,
      value: form.value.trim(),
      description: form.description.trim() || null,
      department_id: form.department_id || null,
      sort_order: Number(form.sort_order) || 0,
      active: form.active,
    };
    const { error } = editingId
      ? await supabase.from('department_contacts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId)
      : await supabase.from('department_contacts').insert(payload);
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    setForm(EMPTY);
    setEditingId(null);
    setMsg(editingId ? 'Entry updated.' : 'Entry added.');
    load();
  };

  const toggleActive = async (entry) => {
    await supabase.from('department_contacts').update({ active: !entry.active, updated_at: new Date().toISOString() }).eq('id', entry.id);
    load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this contact entry?')) return;
    await supabase.from('department_contacts').delete().eq('id', id);
    load();
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setForm({
      label: entry.label, channel: entry.channel, value: entry.value,
      description: entry.description || '', department_id: entry.department_id || '',
      sort_order: entry.sort_order, active: entry.active,
    });
  };

  const grouped = entries.reduce((acc, e) => {
    const key = e.dept?.name || 'General hotlines';
    (acc[key] = acc[key] || []).push(e);
    return acc;
  }, {});

  return (
    <div className="mt-7 space-y-6">
      {isAdmin && (
        <form onSubmit={save} className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="Phone" size={18} className="text-primary" />
              <h3 className="font-semibold text-foreground">{editingId ? 'Edit contact' : 'Add contact'}</h3>
            </div>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); }} className="text-sm text-muted-foreground hover:underline">
                Cancel edit
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Label (e.g. Desk line, Duty officer)" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} required />
            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
              <option value="">General hotline (no department)</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>
              <option value="phone">Phone</option>
              <option value="radio">Radio</option>
              <option value="email">Email</option>
              <option value="other">Other</option>
            </select>
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Number / address / frequency" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} required />
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" placeholder="Description (optional — when to call)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Sort order
              <input type="number" className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
              Visible to residents
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-taste-500 px-4 py-2 text-sm font-semibold text-white hover:bg-taste-600 disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add contact'}
            </button>
            {msg && <span className="text-sm text-taste-600">{msg}</span>}
          </div>
        </form>
      )}

      {Object.keys(grouped).length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No contact entries yet{isAdmin ? ' — add the first one above.' : '.'}
        </p>
      ) : (
        Object.entries(grouped).map(([dept, list]) => (
          <section key={dept}>
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
              <Icon name="Building2" size={16} className="text-primary" /> {dept}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map(entry => (
                <div key={entry.id} className={`rounded-lg border border-border bg-card p-4 ${entry.active ? '' : 'opacity-50'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Icon name={CHANNEL_ICON[entry.channel] || 'Info'} size={18} className="mt-1 text-primary" />
                      <div>
                        <p className="font-medium text-foreground text-sm">{entry.label}</p>
                        {entry.description && <p className="mt-0.5 text-xs text-muted-foreground">{entry.description}</p>}
                        <p className="mt-1 text-lg font-bold text-foreground">{entry.value}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {entry.channel === 'phone' && (
                        <a href={`tel:${entry.value}`} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-foreground hover:bg-slate-50">Call</a>
                      )}
                      {isAdmin && (
                        <>
                          <button onClick={() => startEdit(entry)} className="p-1 text-slate-400 hover:text-foreground" title="Edit">
                            <Icon name="Pencil" size={14} />
                          </button>
                          <button onClick={() => toggleActive(entry)} className="p-1 text-slate-400 hover:text-foreground" title={entry.active ? 'Hide' : 'Show'}>
                            <Icon name={entry.active ? 'EyeOff' : 'Eye'} size={14} />
                          </button>
                          <button onClick={() => remove(entry.id)} className="p-1 text-slate-400 hover:text-red-600" title="Delete">
                            <Icon name="Trash2" size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {!entry.active && isAdmin && <p className="mt-2 text-xs font-semibold text-amber-700">Hidden from residents</p>}
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
        <p className="text-sm font-medium text-foreground">Important</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This directory supplements but does not replace direct emergency calls. For life-threatening situations, call 911 first.
        </p>
      </div>
    </div>
  );
};

export default ContactsSection;
