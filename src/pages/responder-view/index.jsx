import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import { supabase } from '../../lib/supabase';
import NotificationBell from '../../components/NotificationBell';
import SidebarProfile from '../../components/SidebarProfile';
import BoundaryMap from '../../components/BoundaryMap';
import AppSidebar from '../../components/AppSidebar';

const RESPONDER_LINKS = [
  { label: 'Response board', icon: 'Ambulance', path: '/' },
  { label: 'New incident', icon: 'PlusCircle', path: '/emergency-report' },
  { label: 'Profile', icon: 'User', path: '/profile' }
];

export default function ResponderView() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { reports: allReports, setReports } = useMockData();
  const [assignedReports, setAssignedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [resolutionPhoto, setResolutionPhoto] = useState(null);
  const [resolving, setResolving] = useState(false);

  // Fresh proof requirement per incident — clear any staged photo when the
  // modal opens, closes, or switches to a different report.
  useEffect(() => {
    setResolutionPhoto(null);
  }, [selectedReport?.id]);

  useEffect(() => {
    if (!profile?.id) return; // skip the eq.undefined 400 + broken subscription before profile loads
    const fetchAssignedReports = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('emergency_reports')
        .select('*')
        .eq('assigned_to', profile.id)
        .order('created_at', { ascending: false });
      
      if (data && !error) {
        setAssignedReports(data);
      }
      setLoading(false);
    };

    fetchAssignedReports();

    // Real-time subscription for assigned reports
    const subscription = supabase
      .channel('assigned_reports_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'emergency_reports', filter: `assigned_to=eq.${profile.id}` }, (payload) => {
        setAssignedReports(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile?.id]);

  const updateStatus = async (reportId, newStatus) => {
    const { error } = await supabase
      .from('emergency_reports')
      .update({ status: newStatus })
      .eq('id', reportId);

    if (error) {
      console.error('Status update failed:', error);
      return;
    }
    setAssignedReports(prev => prev.map(r =>
      r.id === reportId ? { ...r, status: newStatus } : r
    ));
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleProofChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResolutionPhoto(await readFileAsDataUrl(file));
  };

  // Resolve requires photo proof — stored on attachments.resolution_proof so
  // dispatch can verify the closure, alongside the reporter's evidence images.
  const resolveWithProof = async (report) => {
    if (!resolutionPhoto || resolving) return;
    setResolving(true);
    const attachments = { ...(report.attachments || {}), resolution_proof: resolutionPhoto };
    const { error } = await supabase
      .from('emergency_reports')
      .update({ status: 'resolved', attachments })
      .eq('id', report.id);
    setResolving(false);
    if (error) {
      console.error('Resolve failed:', error);
      return;
    }
    setAssignedReports(prev => prev.map(r =>
      r.id === report.id ? { ...r, status: 'resolved', attachments } : r
    ));
    setResolutionPhoto(null);
    setSelectedReport(null);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar links={RESPONDER_LINKS} profile={profile} signOut={signOut} />
      <div className="min-w-0 flex-1 pb-24 sm:pb-0">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-taste-500 text-white">
              <Icon name="Ambulance" size={21}/>
            </div>
            <div>
              <p className="font-bold">Responder workspace</p>
              <p className="text-xs text-slate-500">On duty</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell userId={profile?.id} onOpenIncident={(id) => { const r = allReports.find(x => x.id === id); if (r) setSelectedReport(r); }}/>
            <button onClick={() => navigate('/report-management')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Incident queue</button>
            <SidebarProfile profile={profile} signOut={signOut} compact/>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold  text-taste-600">Live assignments</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Response board</h1>
            <p className="mt-2 text-sm text-slate-500">Acknowledge and update your assigned incidents. Dispatch receives every status update.</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            <span className="mr-2 inline-block h-2 w-2  rounded-full bg-emerald-500"/>
            Available for dispatch
          </div>
        </div>
        
        {loading ? (
          <div className="text-center text-slate-500">Loading assignments...</div>
        ) : assignedReports.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <Icon name="CheckCircle" size={48} className="text-slate-400 mx-auto mb-4"/>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No active assignments</h3>
            <p className="text-sm text-slate-500">You have no incidents assigned to you at this time.</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {assignedReports.map((report) => (
              <article
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white p-5  transition hover:border-taste-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600">
                    <Icon name={report.report_type === 'medical' ? 'HeartPulse' : 'Siren'} size={20}/>
                  </div>
                  <span className="rounded-full bg-taste-50 px-2 py-1 text-[10px] font-bold uppercase text-taste-600">
                    {report.status || 'pending'}
                  </span>
                </div>
                <h3 className="mt-3 font-semibold capitalize">{report.report_type || report.incident_type}</h3>
                <p className="mt-1 text-sm text-slate-600">{report.content || report.description}</p>
                <p className="mt-2 text-xs text-slate-500">{report.attachments?.location || report.location}</p>
                <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {report.status === 'assigned' && (
                    <button 
                      onClick={() => updateStatus(report.id, 'in-progress')}
                      className="flex-1 rounded-lg bg-taste-500 px-3 py-2 text-xs font-semibold text-white hover:bg-taste-600"
                    >
                      Acknowledge
                    </button>
                  )}
                  {report.status === 'in-progress' && (
                    <button 
                      onClick={() => setSelectedReport(report)}
                      className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {selectedReport && (
        <div className="fixed inset-0 z-1030 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" onClick={() => setSelectedReport(null)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white " onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600">
                  <Icon name={selectedReport.report_type === 'medical' ? 'HeartPulse' : 'Siren'} size={20}/>
                </div>
                <div>
                  <p className="font-semibold capitalize">{selectedReport.report_type || selectedReport.incident_type} emergency</p>
                  <p className="font-mono text-xs text-slate-400">{selectedReport.report_id || selectedReport.id?.slice(0, 8)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-taste-50 px-2 py-1 text-[10px] font-bold uppercase text-taste-600">
                  {selectedReport.status || 'pending'}
                </span>
                <button onClick={() => setSelectedReport(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                  <Icon name="X" size={18}/>
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <p className="text-xs font-bold  text-slate-400">Description</p>
                <p className="mt-1 text-sm text-slate-700">{selectedReport.content || selectedReport.description}</p>
              </div>

              <div>
                <p className="text-xs font-bold  text-slate-400">Location</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Icon name="MapPin" size={14} className="shrink-0 text-taste-500"/>
                  <p className="text-sm text-slate-700">{selectedReport.attachments?.location || selectedReport.location || 'No location recorded'}</p>
                </div>
                {selectedReport.attachments?.latitude && selectedReport.attachments?.longitude ? (
                  <>
                    <div className="mt-2 h-56 overflow-hidden rounded-lg border border-slate-200">
                      <BoundaryMap
                        marker={[selectedReport.attachments.latitude, selectedReport.attachments.longitude]}
                      />
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedReport.attachments.latitude},${selectedReport.attachments.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      <Icon name="Navigation" size={13}/> Navigate to scene
                    </a>
                  </>
                ) : (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">No GPS coordinates were captured for this incident — map unavailable.</p>
                )}
              </div>

              {selectedReport.attachments?.resolution_proof && (
                <div>
                  <p className="text-xs font-bold  text-slate-400">Resolution proof</p>
                  <img
                    src={selectedReport.attachments.resolution_proof}
                    alt="Resolution proof"
                    className="mt-1 h-28 w-40 rounded-lg border border-slate-200 object-cover"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold  text-slate-400">Priority</p>
                  <p className="mt-1 text-sm font-semibold capitalize">{selectedReport.priority || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold  text-slate-400">Reported</p>
                  <p className="mt-1 text-sm text-slate-700">{selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleString() : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold  text-slate-400">Reporter contact</p>
                  <p className="mt-1 text-sm text-slate-700">{selectedReport.attachments?.contact_name || 'N/A'}</p>
                  <p className="text-xs text-slate-500">{selectedReport.attachments?.contact_phone || ''}</p>
                </div>
                {selectedReport.attachments?.service_area_status && (
                  <div>
                    <p className="text-xs font-bold  text-slate-400">Service area</p>
                    <p className="mt-1 text-sm capitalize text-slate-700">{selectedReport.attachments.service_area_status}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-6 py-4">
              {selectedReport.status === 'assigned' && (
                <button
                  onClick={() => { updateStatus(selectedReport.id, 'in-progress'); setSelectedReport(null); }}
                  className="flex-1 rounded-lg bg-taste-500 px-3 py-2 text-sm font-semibold text-white hover:bg-taste-600"
                >
                  Acknowledge
                </button>
              )}
              {selectedReport.status === 'in-progress' && (
                <div className="flex-1 space-y-2">
                  <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm font-semibold transition ${resolutionPhoto ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                    <Icon name="Camera" size={15}/>
                    {resolutionPhoto ? 'Proof photo attached' : 'Attach photo proof'}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleProofChange}/>
                  </label>
                  {resolutionPhoto && (
                    <img src={resolutionPhoto} alt="Resolution proof preview" className="h-20 w-full rounded-lg border border-slate-200 object-cover"/>
                  )}
                  <button
                    onClick={() => resolveWithProof(selectedReport)}
                    disabled={!resolutionPhoto || resolving}
                    className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resolving ? 'Resolving...' : resolutionPhoto ? 'Resolve' : 'Resolve (photo required)'}
                  </button>
                </div>
              )}
              <button onClick={() => setSelectedReport(null)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
