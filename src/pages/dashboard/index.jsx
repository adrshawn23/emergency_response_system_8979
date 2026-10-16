import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { mockEmergencyReports, mockDepartments } from '../../data/mockData';
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [reports, setReports] = useState(mockEmergencyReports);
  const [activeReport, setActiveReport] = useState(mockEmergencyReports[0]);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState(['dept-3']);
  const [sent, setSent] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (profile?.role === 'resident') return <ResidentHome />;
  if (profile?.role === 'responder') return <ResponderView />;

  const openCount = useMemo(() => reports.filter(r => r.status !== 'resolved').length, [reports]);
  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const updateStatus = (report, status) => {
    setReports(current => current.map(item => item.report_id === report.report_id ? { ...item, status } : item));
    setActiveReport(current => current?.report_id === report.report_id ? { ...current, status } : current);
  };
  const toggleDepartment = id => setSelectedDepartments(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);

  const sidebarLinks = [
    { label: 'Command center', icon: 'LayoutDashboard', path: '/' },
    { label: 'Incident queue', icon: 'Siren', path: '/report-management', badge: pendingCount },
    { label: 'New incident', icon: 'PlusCircle', path: '/emergency-report' },
    { label: 'Residents & review', icon: 'Users', path: '/user-management' },
    { label: 'Departments', icon: 'Building2', path: '/department-management' },
    { label: 'System settings', icon: 'Settings', path: '/settings' }
  ];

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <div className="flex min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-950 text-slate-300 transition-transform lg:static lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-7">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-500 text-white shadow-lg shadow-red-950/50"><Icon name="Siren" size={22}/></div>
          <div><p className="font-semibold tracking-tight text-white">Kalubihan</p><p className="text-xs text-slate-500">Emergency Command</p></div>
        </div>
        <div className="px-4 py-7">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Operations</p>
          <nav className="space-y-1">{sidebarLinks.map(link => <button key={link.label} onClick={() => { navigate(link.path); setMobileOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${link.path === '/' ? 'bg-white/10 font-medium text-white' : 'hover:bg-white/5 hover:text-white'}`}>
            <Icon name={link.icon} size={18}/><span className="flex-1">{link.label}</span>{link.badge ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{link.badge}</span> : null}
          </button>)}</nav>
        </div>
        <div className="absolute inset-x-4 bottom-5 rounded-2xl bg-slate-900 p-4">
          <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-sky-600 text-sm font-bold text-white">{profile?.first_name?.[0] || 'D'}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{profile?.full_name || 'Dispatcher'}</p><p className="text-xs capitalize text-slate-500">{profile?.role || 'Operations'}</p></div><button aria-label="Sign out" onClick={signOut} className="text-slate-500 hover:text-white"><Icon name="LogOut" size={17}/></button></div>
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"/> Dispatch online</div>
        </div>
      </aside>
      {mobileOpen && <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"/>}
      <main className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3"><button className="lg:hidden" onClick={() => setMobileOpen(true)}><Icon name="Menu"/></button><div><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Friday, March 20</p><h1 className="text-lg font-bold tracking-tight">Good morning, {profile?.first_name || 'Dispatcher'}</h1></div></div>
          <div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500"/>All systems operational</div><button className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500"><Icon name="Bell" size={19}/><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"/></button></div>
        </header>
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
