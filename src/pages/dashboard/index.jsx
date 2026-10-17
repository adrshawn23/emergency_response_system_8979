import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import { mockServiceBoundary } from '../../data/mockData';
import { isPointInBoundary } from '../../utils/geofence';
import { supabase } from '../../lib/supabase';
import ResidentHome from '../resident-home';
import ResponderView from '../responder-view';

const priorityStyles = {
  critical: 'bg-rose-100 text-rose-700 ring-rose-200',
  high: 'bg-orange-100 text-orange-700 ring-orange-200',
  medium: 'bg-amber-100 text-amber-700 ring-amber-200',
  low: 'bg-sky-100 text-sky-700 ring-sky-200'
};

const statusStyles = {
  pending: 'bg-rose-50 text-rose-700',
  assigned: 'bg-blue-50 text-blue-700',
  'in-progress': 'bg-violet-50 text-violet-700',
  resolved: 'bg-emerald-50 text-emerald-700'
};

const formatStatus = (value) => value?.replace('-', ' ');

const sectionCopy = {
  queue: { eyebrow: 'Live operations', title: 'Incident queue', description: 'Review, prioritize, and assign incoming emergency reports.' },
  new: { eyebrow: 'Live operations', title: 'New incident report', description: 'Create a report now. Dispatch sees urgent reports immediately, even while verification is pending.' },
  residents: { eyebrow: 'Administration', title: 'Residents & ID review', description: 'Review registrations, account status, and ID review outcomes.' },
  departments: { eyebrow: 'Administration', title: 'Departments & memberships', description: 'Only administrators can change department access, roles, and memberships.' },
  settings: { eyebrow: 'Administration', title: 'System settings', description: 'Configure service boundaries, data retention, and notification providers.' },
  profile: { eyebrow: 'Account', title: 'Your profile', description: 'Review your command-center account and operational availability.' }
};

function WorkspacePage({ section, profile, signOut, onSectionChange }) {
  const navigate = useNavigate();
  const { reports, setReports } = useMockData();
  const [status, setStatus] = useState('all');
  const [draft, setDraft] = useState({ type: 'fire', priority: 'high', location: '', description: '', callback: '', latitude: null, longitude: null, serviceAreaStatus: 'manual' });
  const [gpsStatus, setGpsStatus] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch reports from Supabase
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('emergency_reports')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log('Fetched reports:', data);
      console.log('Fetch error:', error);
      if (data && data.length > 0) {
        console.log('First report structure:', JSON.stringify(data[0], null, 2));
      }
      
      if (data && !error) {
        setReports(data);
      }
      setLoading(false);
    };

    fetchReports();

    // Set up real-time subscription for reports
    const subscription = supabase
      .channel('emergency_reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setReports(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setReports(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
        } else if (payload.eventType === 'DELETE') {
          setReports(prev => prev.filter(r => r.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const links = [
    { key: 'command', label: 'Command center', icon: 'LayoutDashboard', path: '/', roles: ['admin', 'dispatcher'] },
    { key: 'queue', label: 'Incident queue', icon: 'Siren', path: '/report-management', roles: ['admin', 'dispatcher'] },
    { key: 'new', label: 'New incident', icon: 'PlusCircle', path: '/emergency-report', roles: ['admin', 'dispatcher'] },
    { key: 'residents', label: 'Residents & review', icon: 'Users', path: '/user-management', roles: ['admin'] },
    { key: 'departments', label: 'Departments', icon: 'Building2', path: '/department-management', roles: ['admin'] },
    { key: 'settings', label: 'System settings', icon: 'Settings', path: '/settings', roles: ['admin'] }
  ].filter(link => link.roles.includes(profile?.role));
  const current = sectionCopy[section];
  const visibleReports = status === 'all' ? reports : reports.filter(report => (report.attachments?.status || report.status) === status);
  const handleNavigation = link => onSectionChange(link.key);
  const setReportStatus = (id, nextStatus) => {
    setReports(items => items.map(item => item.report_id === id ? { ...item, status: nextStatus } : item));
    // Update in Supabase
    supabase.from('emergency_reports').update({ status: nextStatus }).eq('report_id', id);
  };

  useEffect(() => {
    if (section !== 'new') return undefined;

    if (!navigator.geolocation) {
      setGpsStatus('GPS is unavailable in this browser. Enter a location manually.');
      return undefined;
    }

    setGpsStatus('Getting your current GPS location...');
    let isCurrent = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!isCurrent) return;
        const latitude = Number(coords.latitude.toFixed(6));
        const longitude = Number(coords.longitude.toFixed(6));
        const inServiceArea = isPointInBoundary({ latitude, longitude }, mockServiceBoundary.points);
        const serviceAreaStatus = inServiceArea ? 'inside' : 'outside';
        setDraft(value => ({
          ...value,
          location: value.location || `GPS: ${latitude}, ${longitude}`,
          latitude,
          longitude,
          serviceAreaStatus
        }));
        setGpsStatus(inServiceArea
          ? `Current GPS location captured (+/-${Math.round(coords.accuracy)} m). You can still edit the location.`
          : 'GPS location is outside the Barangay Kalubihan service area. Your emergency report will still be sent to dispatch for triage.');
      },
      () => {
        if (isCurrent) setGpsStatus('GPS permission was not granted. Enter a location manually.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );

    return () => { isCurrent = false; };
  }, [section]);

  const submitIncident = async event => {
    event.preventDefault();
    if (!draft.location.trim() || !draft.description.trim()) return;
    
    // Insert into Supabase - match actual database schema (old schema with attachments)
    const { data, error } = await supabase.from('emergency_reports').insert({
      incident_id: null,
      reporter_id: profile?.id,
      report_type: draft.type,
      content: draft.description,
      attachments: {
        status: 'pending',
        latitude: draft.latitude,
        longitude: draft.longitude,
        location: draft.location,
        priority: draft.priority,
        contact_name: profile?.full_name || 'Command user',
        contact_phone: draft.callback,
        service_area_status: draft.serviceAreaStatus
      }
    }).select().single();

    if (!error && data) {
      setSubmittedReportId(data.id);
      setSubmitted(true);
      setDraft({ type: 'fire', priority: 'high', location: '', description: '', callback: '', latitude: null, longitude: null, serviceAreaStatus: 'manual' });
    }
  };
  return <div className="min-h-screen bg-slate-50 text-slate-900"><div className="flex min-h-screen">
    <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col overflow-x-hidden bg-slate-950 text-slate-300 sm:w-72"><div className="flex h-20 items-center justify-center gap-3 border-b border-slate-800 px-3 sm:justify-start sm:px-7"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500 text-white"><Icon name="Siren" size={22}/></div><div className="hidden sm:block"><p className="font-semibold text-white">Kalubihan</p><p className="text-xs text-slate-500">Emergency Command</p></div></div><div className="flex-1 px-3 py-7 sm:px-4"><p className="mb-3 hidden px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500 sm:block">Operations</p><nav className="space-y-1">{links.map(link => <button key={link.key} onClick={() => handleNavigation(link)} title={link.label} className={`flex w-full items-center justify-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition sm:justify-start ${link.key === section ? 'bg-white/10 font-medium text-white' : 'hover:bg-white/5 hover:text-white'}`}><Icon name={link.icon} size={18}/><span className="hidden flex-1 sm:block">{link.label}</span>{link.key === 'queue' && <span className="hidden rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white sm:block">{reports.filter(r => r.status === 'pending').length}</span>}</button>)}</nav></div><div className="m-3 rounded-2xl bg-slate-900 p-3 sm:m-4 sm:p-4"><div className="flex items-center justify-center gap-3 sm:justify-start"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-700 text-sm font-bold text-white">{profile?.first_name?.[0] || 'A'}</div><div className="hidden min-w-0 flex-1 sm:block"><p className="truncate text-sm font-medium text-white">{profile?.full_name || 'Administrator'}</p><p className="text-xs capitalize text-slate-500">{profile?.role}</p></div><button onClick={signOut} className="hidden text-slate-500 hover:text-white sm:block"><Icon name="LogOut" size={17}/></button></div></div></aside>
    <main className="min-w-0 flex-1"><header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8"><div><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Kalubihan emergency command</p><h1 className="text-lg font-bold">{current.title}</h1></div><div className="flex items-center gap-3"><div className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500"/>All systems operational</div><button onClick={() => alert('Notifications feature coming soon')} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><Icon name="Bell" size={18}/></button></div></header><div className="mx-auto max-w-[1400px] p-5 sm:p-8"><p className="text-xs font-bold uppercase tracking-wider text-blue-700">{current.eyebrow}</p><h2 className="mt-1 text-3xl font-bold tracking-tight">{current.title}</h2><p className="mt-2 text-sm text-slate-500">{current.description}</p>
      {section === 'queue' && <>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">{['all','pending','assigned','in-progress','resolved'].map(item => <button key={item} onClick={() => setStatus(item)} className={`rounded-lg px-3 py-2 text-sm font-medium capitalize ${status === item ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{item === 'in-progress' ? 'in progress' : item}</button>)}</div>
          <button onClick={() => navigate('/emergency-report')} className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white"><Icon name="Plus" size={16} className="mr-1 inline"/>New incident</button>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(110px,.7fr)_minmax(170px,.8fr)] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400"><span>Incident</span><span>Location</span><span>Priority</span><span>Status / action</span></div>
          {visibleReports.map(report => <div key={report.id} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(110px,.7fr)_minmax(170px,.8fr)] items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
            <div className="min-w-0"><p className="font-semibold capitalize">{report.report_type || report.incident_type} <span className="font-mono text-xs text-slate-400">{report.report_id || report.id?.slice(0, 8)}</span></p><p className="mt-1 truncate text-xs text-slate-500">{report.content || report.description}</p></div>
            <p className="truncate text-sm text-slate-600">{report.attachments?.location || report.location}</p>
            <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-bold uppercase ${priorityStyles[report.attachments?.priority || report.priority]}`}>{report.attachments?.priority || report.priority}</span>
            <div className="flex min-w-0 items-center gap-2">
              <span className={`inline-flex h-8 min-w-[84px] items-center justify-center rounded-full px-2 text-xs font-medium capitalize ${statusStyles[report.attachments?.status || report.status] || 'bg-slate-100 text-slate-700'}`}>{formatStatus(report.attachments?.status || report.status)}</span>
              {profile?.role === 'dispatcher' && (report.attachments?.status || report.status) !== 'resolved' && <button onClick={() => setReportStatus(report.report_id || report.id, (report.attachments?.status || report.status) === 'pending' ? 'assigned' : 'resolved')} className="inline-flex h-8 min-w-[72px] items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">{(report.attachments?.status || report.status) === 'pending' ? 'Assign' : 'Resolve'}</button>}
            </div>
          </div>)}
        </div>
      </>}
      {section === 'new' && gpsStatus && <div className={`mt-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${draft.serviceAreaStatus === 'outside' ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200' : 'bg-blue-50 text-blue-800'}`}><Icon name={draft.serviceAreaStatus === 'outside' ? 'TriangleAlert' : 'Crosshair'} size={16}/>{gpsStatus}</div>}
      {section === 'new' && <form onSubmit={submitIncident} className="mt-7 grid gap-5 lg:grid-cols-[1.4fr_.6fr]"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Emergency type<select value={draft.type} onChange={e => setDraft(value => ({...value, type: e.target.value}))} className="mt-2 w-full rounded-xl border-slate-200 bg-white text-sm"><option value="fire">Fire</option><option value="medical">Medical</option><option value="accident">Accident</option><option value="police">Public safety</option><option value="natural">Natural hazard</option></select></label><label className="text-sm font-semibold">Priority<select value={draft.priority} onChange={e => setDraft(value => ({...value, priority: e.target.value}))} className="mt-2 w-full rounded-xl border-slate-200 bg-white text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label></div><label className="mt-5 block text-sm font-semibold">Incident location<input required value={draft.location} onChange={e => setDraft(value => ({...value, location: e.target.value}))} placeholder="Address, landmark, or selected map pin" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-800"><Icon name="MapPin" size={15}/>GPS and map provider are optional. A manual location is always accepted; outside-boundary reports go to dispatch for triage.</div><label className="mt-5 block text-sm font-semibold">What is happening?<textarea required value={draft.description} onChange={e => setDraft(value => ({...value, description: e.target.value}))} placeholder="Describe hazards, people involved, and immediate risks." rows="6" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><label className="mt-5 block text-sm font-semibold">Callback number <span className="font-normal text-slate-400">(optional)</span><input value={draft.callback} onChange={e => setDraft(value => ({...value, callback: e.target.value}))} placeholder="09XXXXXXXXX" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><div className="mt-6 flex justify-end"><button className="rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white hover:bg-red-600"><Icon name="Send" size={16} className="mr-2 inline"/>Submit incident report</button></div>{submitted && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800"><Icon name="CheckCircle2" size={16} className="mr-2 inline"/>Report created and placed in the live incident queue. ID: {submittedReportId}</div>}</div><aside className="space-y-5"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-2 font-bold text-amber-900"><Icon name="PhoneCall" size={18}/>Urgent safety guidance</div><p className="mt-3 text-sm leading-6 text-amber-800">This application does not replace local emergency phone services. Use the appropriate emergency call channel whenever it is safe to do so.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-bold">Evidence</h3><p className="mt-2 text-sm leading-6 text-slate-500">Photo and video uploads require private storage configuration. In this demo, evidence is not uploaded or shared publicly.</p></div></aside></form>}
      {section === 'residents' && <div className="mt-7 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><Icon name="FileSearch" size={20}/></div><div><h3 className="font-bold">ID verification queue</h3><p className="text-sm text-slate-500">No records awaiting review</p></div></div><p className="mt-5 text-xs leading-5 text-slate-500">OCR is assistive only. Approval, clearer-upload requests, and rejection decisions are made by an authorized administrator.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="font-bold">Account access</h3><p className="mt-1 text-sm text-slate-500">Department access cannot be self-granted.</p><div className="mt-5 text-sm text-slate-500">Manage departments via the Department Management page.</div></div></div>}
      {section === 'departments' && <div className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h3 className="font-bold">Department directory</h3><p className="text-sm text-slate-500">Administrator-controlled departments and access roles</p></div><button onClick={() => navigate('/department-management')} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Manage departments</button></div><div className="p-5 text-sm text-slate-500">Use the Department Management page to view and manage departments.</div></div>}
      {section === 'settings' && <div className="mt-7 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon name="Map" size={20}/></div><div><h3 className="font-bold">Service boundary</h3><p className="text-sm text-slate-500">Kalubihan demo boundary · version 1</p></div></div><p className="mt-5 text-sm leading-6 text-slate-500">Changes are versioned and never rewrite historical incident locations or statuses.</p><button className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Configure boundary</button></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="font-bold">Delivery providers</h3><p className="mt-2 text-sm text-slate-500">In-app notifications are available in mock mode. SMS, email, push, map GIS, and OCR require provider credentials.</p><button className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Provider settings</button></div></div>}
      {section === 'profile' && <div className="mt-7 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-full bg-blue-700 text-lg font-bold text-white">{profile?.first_name?.[0] || 'A'}</div><div><h3 className="text-lg font-bold">{profile?.full_name || 'Administrator'}</h3><p className="text-sm capitalize text-slate-500">{profile?.role || 'Administrator'} account</p></div></div><div className="mt-7 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</p><p className="mt-1 text-sm">{profile?.email}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</p><p className="mt-1 text-sm text-emerald-700">Active / on duty</p></div></div></div>}
    </div></main></div></div>;
}

export default function Dashboard({ section = 'command' }) {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { reports, setReports } = useMockData();
  const [activeReport, setActiveReport] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState(['dept-3']);
  const [sent, setSent] = useState(false);
  const [activeSection, setActiveSection] = useState(section);
  const [currentDate, setCurrentDate] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState(null);

  // Set current date and greeting
  useEffect(() => {
    const now = new Date();
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    setCurrentDate(now.toLocaleDateString('en-US', dateOptions));
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // React Router can reuse this component while changing its section prop.
  // Keep the command-center state in sync so each protected route shows the
  // correct role-specific workspace after navigation.
  useEffect(() => {
    setActiveSection(section);
  }, [section]);

  // Hooks must run in the same order when switching between command-center
  // sections. Keep this before the section-specific early returns below.
  const openCount = useMemo(() => reports.filter(r => r.status !== 'resolved').length, [reports]);

  if (profile?.role === 'resident' && activeSection === 'command') return <ResidentHome />;
  if (profile?.role === 'responder') return <ResponderView />;
  if (activeSection !== 'command') return <WorkspacePage section={activeSection} profile={profile} signOut={signOut} onSectionChange={setActiveSection} />;

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const updateStatus = (report, status) => {
    setReports(current => current.map(item => item.report_id === report.report_id ? { ...item, status } : item));
    setActiveReport(current => current?.report_id === report.report_id ? { ...current, status } : current);
  };
  const toggleDepartment = id => setSelectedDepartments(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);

  const sidebarLinks = [
    { label: 'Command center', icon: 'LayoutDashboard', path: '/', roles: ['admin', 'dispatcher'] },
    { label: 'Incident queue', icon: 'Siren', path: '/report-management', badge: pendingCount, roles: ['admin', 'dispatcher'] },
    { label: 'New incident', icon: 'PlusCircle', path: '/emergency-report', roles: ['admin', 'dispatcher'] },
    { label: 'Residents & review', icon: 'Users', path: '/user-management', roles: ['admin'] },
    { label: 'Departments', icon: 'Building2', path: '/department-management', roles: ['admin'] },
    { label: 'System settings', icon: 'Settings', path: '/settings', roles: ['admin'] }
  ].filter(link => link.roles.includes(profile?.role));

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col overflow-x-hidden bg-slate-950 text-slate-300 sm:w-72">
        <div className="flex h-20 items-center justify-center gap-3 border-b border-slate-800 px-3 sm:justify-start sm:px-7">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-500 text-white shadow-lg shadow-red-950/50"><Icon name="Siren" size={22}/></div>
          <div className="hidden sm:block"><p className="font-semibold tracking-tight text-white">Kalubihan</p><p className="text-xs text-slate-500">Emergency Command</p></div>
        </div>
        <div className="flex-1 px-3 py-7 sm:px-4">
          <p className="mb-3 hidden px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:block">Operations</p>
          <nav className="space-y-1">{sidebarLinks.map(link => <button key={link.label} title={link.label} onClick={() => { const nextSection = ({ '/report-management': 'queue', '/user-management': 'residents', '/department-management': 'departments', '/settings': 'settings' })[link.path]; if (nextSection) setActiveSection(nextSection); else navigate(link.path); }} className={`flex w-full items-center justify-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition sm:justify-start ${link.path === '/' ? 'bg-white/10 font-medium text-white' : 'hover:bg-white/5 hover:text-white'}`}>
            <Icon name={link.icon} size={18}/><span className="hidden flex-1 sm:block">{link.label}</span>{link.badge ? <span className="hidden rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white sm:block">{link.badge}</span> : null}
          </button>)}</nav>
        </div>
        <div className="m-3 rounded-2xl bg-slate-900 p-3 sm:m-4 sm:p-4">
          <div className="flex items-center justify-center gap-3 sm:justify-start"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-600 text-sm font-bold text-white">{profile?.first_name?.[0] || 'U'}</div><div className="hidden min-w-0 flex-1 sm:block"><p className="truncate text-sm font-medium text-white">{profile?.full_name || 'User'}</p><p className="text-xs capitalize text-slate-500">{profile?.role || 'Operations'}</p></div><button aria-label="Sign out" onClick={signOut} className="hidden text-slate-500 hover:text-white sm:block"><Icon name="LogOut" size={17}/></button></div>
          <div className="mt-3 hidden items-center gap-2 text-xs text-emerald-400 sm:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"/> Online</div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div><p className="text-xs font-medium uppercase tracking-wider text-slate-400">{currentDate}</p><h1 className="text-lg font-bold tracking-tight">{getGreeting()}, {profile?.full_name?.split(' ')[0] || 'User'}</h1></div>
          <div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500"/>All systems operational</div><button onClick={() => setShowNotifications(!showNotifications)} className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"><Icon name="Bell" size={19}/><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"/></button></div>
        </header>
        {showNotifications && (
          <div className="absolute right-0 top-20 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold">Notifications</h3>
              <button onClick={() => setShowNotifications(false)} className="text-slate-500 hover:text-slate-700">
                <Icon name="X" size={18}/>
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <div className="px-4 py-3 text-sm text-slate-500">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-red-500"/>
                  <p>No new notifications</p>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="mx-auto max-w-[1600px] space-y-6 p-5 sm:p-8">
          <section className="overflow-hidden rounded-2xl bg-slate-950 px-6 py-6 text-white shadow-xl sm:px-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center"><div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-300"><span className="h-2 w-2 animate-pulse rounded-full bg-red-400"/>Live response operations</div><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Barangay Kalubihan Command Center</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Coordinate incidents, monitor the official service boundary, and request only the assistance your response needs.</p></div><div className="flex flex-wrap gap-3"><button onClick={() => navigate('/emergency-report')} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold shadow-lg shadow-red-950/30 hover:bg-red-400"><Icon name="Siren" size={18}/>Report emergency</button><button onClick={() => setShowBroadcast(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold hover:bg-slate-800"><Icon name="Radio" size={18}/>Request assistance</button></div></div>
          </section>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[['Active incidents', openCount, 'Siren', 'text-red-600 bg-red-50'], ['Awaiting review', pendingCount, 'ClipboardCheck', 'text-amber-600 bg-amber-50'], ['Responders on duty', '12', 'UsersRound', 'text-blue-600 bg-blue-50'], ['Avg. acknowledgement', '2m 18s', 'Timer', 'text-emerald-600 bg-emerald-50']].map(([label, value, icon, style]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight">{value}</p></div><div className={`rounded-xl p-3 ${style}`}><Icon name={icon} size={20}/></div></div><p className="mt-4 text-xs text-slate-400">Updated just now</p></div>)}
          </section>
          <section className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold">Live incident queue</h3><p className="mt-0.5 text-xs text-slate-500">New reports appear immediately for triage.</p></div><button onClick={() => navigate('/report-management')} className="text-sm font-semibold text-blue-700 hover:text-blue-900">View all</button></div><div className="divide-y divide-slate-100">{reports.filter(r => r.status !== 'resolved').map(report => <button key={report.report_id} onClick={() => setActiveReport(report)} className={`w-full px-5 py-4 text-left transition hover:bg-slate-50 ${activeReport?.report_id === report.report_id ? 'bg-blue-50/70' : ''}`}><div className="flex gap-3"><div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${report.emergency_type === 'fire' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}><Icon name={report.emergency_type === 'fire' ? 'Flame' : report.emergency_type === 'medical' ? 'HeartPulse' : 'Car'} size={18}/></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="font-semibold capitalize">{report.emergency_type} <span className="font-mono text-xs font-medium text-slate-400">{report.report_id}</span></p><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ${priorityStyles[report.priority]}`}>{report.priority}</span></div><p className="mt-1 truncate text-sm text-slate-500">{report.location}</p><div className="mt-2 flex items-center gap-2 text-xs text-slate-400"><span className={`rounded-full px-2 py-0.5 font-medium capitalize ${statusStyles[report.status]}`}>{formatStatus(report.status)}</span><span>•</span><span>Reported moments ago</span></div></div></div></button>)}</div></div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold">Service area & active response</h3><p className="mt-0.5 text-xs text-slate-500">Configured Barangay Kalubihan boundary</p></div><button className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><Icon name="Maximize2" size={14}/>Expand</button></div><div className="relative h-[365px] overflow-hidden bg-[#e8f1e6] p-5"><div className="absolute inset-0 opacity-70" style={{backgroundImage:'linear-gradient(30deg, transparent 48%, #d4e1d5 49%, #d4e1d5 51%, transparent 52%), linear-gradient(-28deg, transparent 48%, #d4e1d5 49%, #d4e1d5 51%, transparent 52%)', backgroundSize:'150px 95px'}}/><div className="absolute left-[15%] top-[12%] h-[73%] w-[67%] rotate-[-8deg] rounded-[44%_50%_45%_40%] border-[3px] border-blue-600/80 bg-blue-400/10"><span className="absolute left-6 top-5 -rotate-[-2deg] rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-blue-700 shadow">KALUBIHAN SERVICE AREA</span></div><div className="absolute left-[48%] top-[45%] grid h-11 w-11 place-items-center rounded-full border-4 border-white bg-red-500 text-white shadow-lg shadow-red-500/40"><Icon name="Flame" size={19}/></div><div className="absolute bottom-5 left-5 rounded-xl bg-white/95 p-3 shadow-lg"><p className="text-xs font-bold">{activeReport?.report_id} · {activeReport?.priority} priority</p><p className="mt-1 max-w-[185px] text-xs text-slate-500">{activeReport?.location}</p></div><div className="absolute right-5 top-5 rounded-xl bg-white/95 p-3 text-xs shadow-lg"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500"/>Active incident</div><div className="mt-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border-2 border-blue-600"/>Service boundary</div></div></div></div>
          </section>
          {activeReport && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div className="flex gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600"><Icon name="Flame" size={23}/></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold capitalize">{activeReport.emergency_type} response · {activeReport.report_id}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ${priorityStyles[activeReport.priority]}`}>{activeReport.priority}</span></div><p className="mt-1 text-sm text-slate-500">{activeReport.description}</p><p className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400"><Icon name="MapPin" size={13}/>{activeReport.location} <span className="mx-1">•</span> GPS location captured</p></div></div><div className="flex flex-wrap gap-2"><button onClick={() => updateStatus(activeReport, 'assigned')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Assign team</button><button onClick={() => setShowBroadcast(true)} className="rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">Request assistance</button><button onClick={() => navigate('/report-management')} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="View incident details"><Icon name="ArrowUpRight" size={18}/></button></div></div></section>}
        </div>
      </main>
    </div>
    {showBroadcast && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-100 p-6"><div><div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon name="Radio" size={20}/></div><h2 className="text-lg font-bold">Request department assistance</h2><p className="mt-1 text-sm text-slate-500">Targeted only to selected, on-duty departments.</p></div><button onClick={() => {setShowBroadcast(false);setSent(false)}} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><Icon name="X"/></button></div><div className="space-y-5 p-6">{sent ? <div className="rounded-xl bg-emerald-50 p-5 text-center"><Icon name="CheckCircle2" size={32} className="mx-auto text-emerald-600"/><p className="mt-3 font-semibold text-emerald-900">Assistance request sent</p><p className="mt-1 text-sm text-emerald-700">The incident timeline now records this targeted request.</p><button onClick={() => {setShowBroadcast(false);setSent(false)}} className="mt-4 text-sm font-semibold text-emerald-700">Done</button></div> : <><div><div className="mb-2 flex items-center justify-between"><label className="text-sm font-semibold">Select departments</label><span className="text-xs text-slate-400">{selectedDepartments.length} selected</span></div><div className="grid gap-2 sm:grid-cols-2">{mockDepartments.filter(d => d.id !== 'dept-1').map(dept => <button key={dept.id} onClick={() => toggleDepartment(dept.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition ${selectedDepartments.includes(dept.id) ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 hover:border-slate-300'}`}><span className={`grid h-5 w-5 place-items-center rounded border ${selectedDepartments.includes(dept.id) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>{selectedDepartments.includes(dept.id) && <Icon name="Check" size={14}/>}</span>{dept.name}</button>)}</div></div><div><label className="text-sm font-semibold">Assistance requested</label><div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Support primary fire response at {activeReport?.location}. Establish medical standby and assist evacuation.</div></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><Icon name="ShieldAlert" size={14} className="mr-1 inline"/>Confirming will notify only selected departments. Delivery and acknowledgement will be tracked separately.</div><button disabled={!selectedDepartments.length} onClick={() => setSent(true)} className="w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white disabled:opacity-50">Confirm & send request</button></>}</div></div></div>}
  </div>;
}
