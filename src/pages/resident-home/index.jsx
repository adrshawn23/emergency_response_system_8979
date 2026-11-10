import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import NotificationBell from '../../components/NotificationBell';
import IncidentChat from '../../components/IncidentChat';
import SidebarProfile from '../../components/SidebarProfile';
import AppSidebar from '../../components/AppSidebar';
import ServiceAreaBadge from '../../components/ServiceAreaBadge';
import IncidentTimeline from '../../components/IncidentTimeline';
import BoundaryMap from '../../components/BoundaryMap';
import { RESPONDER_ICON, responderDeptIcon } from '../../utils/leafletIcon';
import useResponderLocation from '../../hooks/useResponderLocation';
import useResponderLocations from '../../hooks/useResponderLocations';
import useDrivingRoutes from '../../hooks/useDrivingRoutes';
import { reportCoords } from '../../utils/reportCoords';
import { supabase } from '../../lib/supabase';
import { submitIdForVerification } from '../../utils/verifyId';
import useEscapeKey from '../../hooks/useEscapeKey';

const VERIFICATION_COPY = {
  pending: { tone: 'amber', label: 'Under review', text: 'Your ID submission is waiting for an administrator review. This usually takes 1–2 business days.' },
  under_review: { tone: 'amber', label: 'Under review', text: 'Your ID submission is being reviewed by an administrator.' },
  correction_required: { tone: 'red', label: 'Correction needed', text: 'The information on your ID did not match your registration. See the reason below, then resubmit a matching document.' },
  needs_clarity: { tone: 'amber', label: 'Clearer photo needed', text: 'The reviewer could not read your ID clearly. Re-upload exactly what the note below asks for — usually a sharper, well-lit photo.' },
  rejected: { tone: 'red', label: 'Not approved', text: 'Your registration could not be approved. You may resubmit a different document or contact the barangay office to appeal.' },
};

// Extra pages appear only when granted in Access control — canAccessPage
// filters this list so the sidebar mirrors page_permissions.
const RESIDENT_LINKS = [
  { key: 'command', label: 'Home', icon: 'Home', path: '/' },
  { key: 'new', label: 'Report emergency', icon: 'Siren', path: '/emergency-report' },
  { key: 'queue', label: 'Incident queue', icon: 'ListChecks', path: '/report-management' },
  { key: 'residents', label: 'Residents & review', icon: 'Users', path: '/user-management' },
  { key: 'departments', label: 'Departments', icon: 'Building2', path: '/department-management' },
  { key: 'announcements', label: 'Announcements', icon: 'Megaphone', path: '/announcements' },
  { key: 'contacts', label: 'Contacts', icon: 'Phone', path: '/contacts' },
  { key: 'profile', label: 'Profile', icon: 'User', path: '/profile' }
];

export default function ResidentHome() {
  const navigate = useNavigate();
  const { profile, signOut, canAccessPage } = useAuth();
  const { reports } = useMockData();
  const links = RESIDENT_LINKS.filter(l => canAccessPage(l.key, profile?.role));
  const myReports = reports.filter(r => r.reporter_id === profile?.id).slice(0, 3);

  const [selectedReport, setSelectedReport] = useState(null);
  const [verification, setVerification] = useState(null);
  const [verificationLoaded, setVerificationLoaded] = useState(false);
  const [resubmitFile, setResubmitFile] = useState(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitMsg, setResubmitMsg] = useState('');
  const [contactNotice, setContactNotice] = useState(false);

  // Esc closes the incident modal (audit U-05).
  useEscapeKey(() => setSelectedReport(null), !!selectedReport);

  // Live responder position for the open report — visible only while the
  // incident is unresolved (mirrors the reporter_read RLS policy).
  const responderLoc = useResponderLocation(
    selectedReport?.assigned_to,
    !!selectedReport && selectedReport.status !== 'resolved'
  );
  const incidentCoords = reportCoords(selectedReport);

  // Every responder the RLS policy exposes for this report: the assignee AND
  // any responder who accepted cross-department assistance on it.
  const allLocs = useResponderLocations(
    !!selectedReport && selectedReport.status !== 'resolved'
  );
  const liveMarkers = Object.entries(allLocs)
    .filter(([, loc]) => loc?.latitude && loc?.longitude)
    .map(([id, loc]) => ({ id, position: [loc.latitude, loc.longitude], icon: responderDeptIcon(loc.dept), dept: loc.dept }));
  const responderMarkers = liveMarkers.length
    ? liveMarkers
    : (responderLoc?.latitude
        ? [{ position: [responderLoc.latitude, responderLoc.longitude], icon: responderDeptIcon(responderLoc.dept) }]
        : []);
  // Street-following approach lines via OSRM (straight lines while loading).
  const routePairs = incidentCoords
    ? responderMarkers.map(m => ({ id: m.id || 'assignee', from: m.position, to: incidentCoords }))
    : [];
  const responderRoutes = useDrivingRoutes(routePairs).map(r => r.positions);
  const trackedTimes = Object.values(allLocs).map(l => l?.updated_at).filter(Boolean).sort();
  const lastUpdate = trackedTimes[trackedTimes.length - 1] || responderLoc?.updated_at;

  const loadVerification = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('id_verifications')
      .select('id, verification_status, decision_reason, review_notes, ocr_data, created_at')
      .eq('user_id', profile.id)
      .neq('verification_status', 'superseded')
      .order('created_at', { ascending: false })
      .limit(1);
    // The .neq('superseded') filter silently fails if the CHECK hasn't been
    // applied yet — fall back to an unfiltered latest row in that case.
    if (data && data.length) setVerification(data[0]);
    else {
      const { data: fallback } = await supabase
        .from('id_verifications')
        .select('id, verification_status, review_notes, ocr_data, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (fallback?.length) setVerification(fallback[0]);
    }
    setVerificationLoaded(true);
  }, [profile?.id]);

  useEffect(() => { loadVerification(); }, [loadVerification]);

  const handleResubmit = async () => {
    if (!resubmitFile || !profile?.id) return;
    setResubmitting(true);
    setResubmitMsg('');
    const note = await submitIdForVerification({
      file: resubmitFile,
      declared: {
        fullName: profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        birthdate: profile.birthdate,
        address: profile.address,
      },
      userId: profile.id,
    });
    setResubmitMsg(note || 'New submission received — it is now waiting for review.');
    setResubmitFile(null);
    setResubmitting(false);
    await loadVerification();
  };

  const isActiveResident = profile?.account_status === 'active';
  const vStatus = verification?.verification_status;
  const vCopy = VERIFICATION_COPY[vStatus];
  const needsResubmit = ['correction_required', 'needs_clarity', 'rejected'].includes(vStatus);
  const showVerificationCard = profile?.role === 'resident' && verificationLoaded
    && !isActiveResident;
  return <div className="flex min-h-screen bg-slate-50 text-slate-900">
    <AppSidebar links={links} profile={profile} signOut={signOut} />
    <div className="min-w-0 flex-1 pb-24 sm:pb-0">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-red-500 text-white"><Icon name="Siren" size={21}/></div><div><p className="font-bold">Kalubihan Emergency</p><p className="text-xs text-slate-500">Resident safety portal</p></div></div><div className="flex items-center gap-3"><NotificationBell userId={profile?.id} onOpenIncident={async (id) => { const r = reports.find(x => x.id === id); if (r) { setSelectedReport(r); return; } const { data } = await supabase.from('emergency_reports').select('*').eq('id', id).single(); if (data) setSelectedReport(data); }}/><SidebarProfile profile={profile} signOut={signOut} compact/></div></div></header>
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <section className="overflow-hidden rounded-2xl bg-slate-900 p-7 text-white sm:p-10"><p className="text-sm text-slate-300">Hello, {profile?.first_name || 'neighbor'}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Help is one report away.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Send an emergency report with a location, details, and optional evidence. You can always place a local emergency call if it is safe to do so.</p><button onClick={() => navigate('/emergency-report')} disabled={!isActiveResident} title={isActiveResident ? '' : 'Your account must be verified before filing reports'} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-bold  hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"><Icon name="Siren" size={18}/>{isActiveResident ? 'Report an emergency' : 'Verification required to report'}</button></section>

      {showVerificationCard && (
        <section className={`rounded-lg border bg-white p-6  ${vCopy?.tone === 'red' ? 'border-red-200' : 'border-amber-200'}`}>
          <div className="flex items-start gap-3">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${vCopy?.tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
              <Icon name={vCopy?.tone === 'red' ? 'AlertTriangle' : 'Clock'} size={20}/>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">Identity verification</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${vCopy?.tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{vCopy?.label || 'Action needed'}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{vCopy?.text || 'Submit a clear photo of a valid ID to finish registration.'}</p>
              {(verification?.decision_reason || verification?.review_notes) && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-semibold">{needsResubmit ? 'What to re-upload: ' : 'Reviewer note: '}</span>{verification.decision_reason || verification.review_notes}
                </p>
              )}
              {needsResubmit || !verification ? (
                <div className="mt-4">
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { setResubmitFile(e.target.files?.[0] || null); setResubmitMsg(''); }} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-taste-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-taste-600"/>
                  <button onClick={handleResubmit} disabled={!resubmitFile || resubmitting} className="mt-3 rounded-lg bg-taste-500 px-4 py-2 text-sm font-semibold text-white hover:bg-taste-600 disabled:cursor-not-allowed disabled:opacity-50">
                    {resubmitting ? 'Submitting…' : 'Submit ID for verification'}
                  </button>
                  {resubmitMsg && <p className="mt-2 text-sm text-slate-600">{resubmitMsg}</p>}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )}
      <section className="grid gap-5 md:grid-cols-[1.3fr_.7fr]"><div className="rounded-lg border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold">Your recent reports</h2><p className="mt-1 text-xs text-slate-500">Only you and authorized response staff can see report details.</p></div><button onClick={() => navigate('/report-management')} className="text-sm font-semibold text-taste-600">View updates</button></div>{myReports.length ? <div className="divide-y divide-slate-100">{myReports.map(r => <div key={r.report_id || r.id} onClick={() => setSelectedReport(r)} className="flex cursor-pointer items-center gap-3 p-5 hover:bg-slate-50"><div className="grid h-9 w-9 place-items-center rounded-xl bg-taste-50 text-taste-600"><Icon name="FileText" size={18}/></div><div className="min-w-0 flex-1"><p className="font-semibold capitalize">{r.emergency_type || r.report_type} <span className="ml-1 font-mono text-xs text-slate-500">{r.report_id || r.id?.slice(0, 8)}</span></p><p className="mt-1 truncate text-sm text-slate-500">{r.location || r.attachments?.location}</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium capitalize text-taste-600">{r.status?.replace('-', ' ')}</span></div>)}</div> : <div className="p-8 text-sm text-slate-500">You have no recent reports.</div>}</div><aside className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Icon name="MapPinned" size={18}/></div><h2 className="font-bold">Service area</h2></div><p className="mt-4 text-sm leading-6 text-slate-500">Barangay Kalubihan coverage is set by the administrator. Reports outside the boundary are still sent to dispatch for triage.</p><div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><Icon name="ShieldCheck" size={14} className="mr-1 inline text-emerald-600"/>Your exact location is never shown to other residents.</div></aside></section>
      <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-bold">Emergency contacts & guidance</h2><p className="mt-2 text-sm text-slate-500">Emergency phone services are the fastest fallback when network or app notifications are unavailable. Contact details are managed and verified by Barangay administrators.</p><div className="mt-4 flex flex-wrap gap-3"><button onClick={() => navigate('/emergency-report')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"><Icon name="MapPin" size={16} className="mr-2 inline"/>Submit with a manual pin</button><button onClick={() => setContactNotice(v => !v)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"><Icon name="Phone" size={16} className="mr-2 inline"/>View contacts</button></div>{contactNotice && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Emergency contacts are managed by the Barangay administrator — contact the front desk to add or update numbers.</p>}</section>
    </main>

    {selectedReport && (
      <div className="fixed inset-0 z-1050 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" onClick={() => setSelectedReport(null)}>
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white " onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <p className="font-semibold capitalize">{selectedReport.emergency_type || selectedReport.report_type || 'Incident'} report</p>
              <p className="font-mono text-xs text-slate-500">{selectedReport.report_id || selectedReport.id?.slice(0, 8)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-taste-50 px-2 py-1 text-[10px] font-bold uppercase text-taste-600">{selectedReport.status || 'pending'}</span>
              <button onClick={() => setSelectedReport(null)} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                <Icon name="X" size={18}/>
              </button>
            </div>
          </div>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
            <div>
              <p className="text-xs font-bold  text-slate-500">Description</p>
              <p className="mt-1 text-sm text-slate-700">{selectedReport.content || selectedReport.description || 'No description provided.'}</p>
            </div>
            <div>
              <p className="text-xs font-bold  text-slate-500">Location</p>
              <p className="mt-1 text-sm text-slate-700">{selectedReport.location || selectedReport.attachments?.location || 'No location recorded'}</p>
            </div>
            <ServiceAreaBadge report={selectedReport} />
            <IncidentTimeline report={selectedReport} />
            {(incidentCoords || responderMarkers.length > 0) && (
              <div>
                <p className="text-xs font-bold  text-slate-500">Map</p>
                <div className="mt-1 h-48 overflow-hidden rounded-lg border border-slate-200">
                  <BoundaryMap
                    marker={incidentCoords}
                    markers={responderMarkers}
                    route={responderRoutes.length ? responderRoutes : null}
                  />
                </div>
                {lastUpdate && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <Icon name="Navigation" size={12} className="text-blue-600"/>
                    {responderMarkers.length > 1 ? 'Responders' : 'Responder'} live — updated {new Date(lastUpdate).toLocaleTimeString()}
                  </p>
                )}
              </div>
            )}
            {selectedReport.status === 'resolved' && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <Icon name="CheckCircle" size={16}/> This incident was resolved by responders.
              </div>
            )}
            {selectedReport.attachments?.resolution_proof && (
              <div>
                <p className="text-xs font-bold  text-slate-500">Resolution proof</p>
                <img
                  src={selectedReport.attachments.resolution_proof}
                  alt="Resolution proof"
                  className="mt-1 h-32 w-48 rounded-lg border border-emerald-200 object-cover"
                />
              </div>
            )}
            <div>
              <p className="text-xs font-bold  text-slate-500">Reported</p>
              <p className="mt-1 text-sm text-slate-700">{selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleString() : 'N/A'}</p>
            </div>
            {selectedReport.assigned_to && (
              <IncidentChat reportId={selectedReport.id} title="Message the responder"/>
            )}
          </div>
          <div className="border-t border-slate-100 px-6 py-4">
            <button onClick={() => setSelectedReport(null)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  </div>;
}
