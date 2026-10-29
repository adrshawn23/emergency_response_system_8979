import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';

export default function ResidentHome() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { reports } = useMockData();
  const myReports = reports.filter(r => r.reporter_id === profile?.id).slice(0, 3);
  const [selectedReport, setSelectedReport] = useState(null);
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-red-500 text-white"><Icon name="Siren" size={21}/></div><div><p className="font-bold">Kalubihan Emergency</p><p className="text-xs text-slate-500">Resident safety portal</p></div></div><div className="flex items-center gap-3"><button className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100"><Icon name="Bell" size={19}/><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"/></button><button onClick={signOut} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" title="Sign out"><Icon name="LogOut" size={19}/></button></div></div></header>
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <section className="overflow-hidden rounded-3xl bg-slate-900 p-7 text-white sm:p-10"><p className="text-sm text-slate-300">Hello, {profile?.first_name || 'neighbor'}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Help is one report away.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Send an emergency report with a location, details, and optional evidence. You can always place a local emergency call if it is safe to do so.</p><button onClick={() => navigate('/emergency-report')} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-bold shadow-lg shadow-red-950/40 hover:bg-red-400"><Icon name="Siren" size={18}/>Report an emergency</button></section>
      <section className="grid gap-5 md:grid-cols-[1.3fr_.7fr]"><div className="rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold">Your recent reports</h2><p className="mt-1 text-xs text-slate-500">Only you and authorized response staff can see report details.</p></div><button onClick={() => navigate('/report-management')} className="text-sm font-semibold text-indigo-700">View updates</button></div>{myReports.length ? <div className="divide-y divide-slate-100">{myReports.map(r => <div key={r.report_id || r.id} onClick={() => setSelectedReport(r)} className="flex cursor-pointer items-center gap-3 p-5 hover:bg-slate-50"><div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Icon name="FileText" size={18}/></div><div className="min-w-0 flex-1"><p className="font-semibold capitalize">{r.emergency_type || r.report_type} <span className="ml-1 font-mono text-xs text-slate-400">{r.report_id || r.id?.slice(0, 8)}</span></p><p className="mt-1 truncate text-sm text-slate-500">{r.location || r.attachments?.location}</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium capitalize text-indigo-700">{r.status?.replace('-', ' ')}</span></div>)}</div> : <div className="p-8 text-sm text-slate-500">You have no recent reports.</div>}</div><aside className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Icon name="MapPinned" size={18}/></div><h2 className="font-bold">Service area</h2></div><p className="mt-4 text-sm leading-6 text-slate-500">Barangay Kalubihan coverage is set by the administrator. Reports outside the boundary are still sent to dispatch for triage.</p><div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><Icon name="ShieldCheck" size={14} className="mr-1 inline text-emerald-600"/>Your exact location is never shown to other residents.</div></aside></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Emergency contacts & guidance</h2><p className="mt-2 text-sm text-slate-500">Emergency phone services are the fastest fallback when network or app notifications are unavailable. Contact details are managed and verified by Barangay administrators.</p><div className="mt-4 flex flex-wrap gap-3"><button onClick={() => navigate('/emergency-report')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"><Icon name="MapPin" size={16} className="mr-2 inline"/>Submit with a manual pin</button><button onClick={() => alert('Emergency contacts are configured by the Barangay administrator.')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"><Icon name="Phone" size={16} className="mr-2 inline"/>View contacts</button></div></section>
    </main>

    {selectedReport && (
      <div className="fixed inset-0 z-1030 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" onClick={() => setSelectedReport(null)}>
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <p className="font-semibold capitalize">{selectedReport.emergency_type || selectedReport.report_type || 'Incident'} report</p>
              <p className="font-mono text-xs text-slate-400">{selectedReport.report_id || selectedReport.id?.slice(0, 8)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase text-indigo-700">{selectedReport.status || 'pending'}</span>
              <button onClick={() => setSelectedReport(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <Icon name="X" size={18}/>
              </button>
            </div>
          </div>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</p>
              <p className="mt-1 text-sm text-slate-700">{selectedReport.content || selectedReport.description || 'No description provided.'}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Location</p>
              <p className="mt-1 text-sm text-slate-700">{selectedReport.location || selectedReport.attachments?.location || 'No location recorded'}</p>
            </div>
            {selectedReport.status === 'resolved' && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <Icon name="CheckCircle" size={16}/> This incident was resolved by responders.
              </div>
            )}
            {selectedReport.attachments?.resolution_proof && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Resolution proof</p>
                <img
                  src={selectedReport.attachments.resolution_proof}
                  alt="Resolution proof"
                  className="mt-1 h-32 w-48 rounded-lg border border-emerald-200 object-cover"
                />
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Reported</p>
              <p className="mt-1 text-sm text-slate-700">{selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleString() : 'N/A'}</p>
            </div>
          </div>
          <div className="border-t border-slate-100 px-6 py-4">
            <button onClick={() => setSelectedReport(null)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Close
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;
}
