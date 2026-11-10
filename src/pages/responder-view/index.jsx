import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import { supabase } from '../../lib/supabase';
import NotificationBell from '../../components/NotificationBell';
import SidebarProfile from '../../components/SidebarProfile';
import BoundaryMap from '../../components/BoundaryMap';
import IncidentChat from '../../components/IncidentChat';
import { RESPONDER_ICON, responderDeptIcon } from '../../utils/leafletIcon';
import useDrivingRoutes from '../../hooks/useDrivingRoutes';
import { reportCoords } from '../../utils/reportCoords';
import AppSidebar from '../../components/AppSidebar';
import ServiceAreaBadge from '../../components/ServiceAreaBadge';
import IncidentTimeline from '../../components/IncidentTimeline';
import useIncidentHistory from '../../hooks/useIncidentHistory';
import { haversineMeters } from '../../utils/distance';
import useEscapeKey from '../../hooks/useEscapeKey';

// Extra pages appear only when granted in Access control — canAccessPage
// filters this list so the sidebar mirrors page_permissions.
const RESPONDER_LINKS = [
  { key: 'command', label: 'Response board', icon: 'Ambulance', path: '/' },
  { key: 'queue', label: 'Incident queue', icon: 'ListChecks', path: '/report-management' },
  { key: 'new', label: 'New incident', icon: 'PlusCircle', path: '/emergency-report' },
  { key: 'departments', label: 'Departments', icon: 'Building2', path: '/department-management' },
  { key: 'profile', label: 'Profile', icon: 'User', path: '/profile' }
];

export default function ResponderView() {
  const navigate = useNavigate();
  const { profile, signOut, canAccessPage } = useAuth();
  const { reports: allReports, setReports } = useMockData();
  const links = RESPONDER_LINKS.filter(l => canAccessPage(l.key, profile?.role));
  const [assignedReports, setAssignedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [resolutionPhoto, setResolutionPhoto] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [assistanceRequests, setAssistanceRequests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [myPosition, setMyPosition] = useState(null);
  // Same-dept backup: my requests + the reason modal state.
  const [backupRequests, setBackupRequests] = useState([]);
  const [backupFor, setBackupFor] = useState(null);
  const [backupReason, setBackupReason] = useState('');
  const [backupError, setBackupError] = useState('');

  // Fresh proof requirement per incident — clear any staged photo when the
  // modal opens, closes, or switches to a different report.
  useEffect(() => {
    setResolutionPhoto(null);
  }, [selectedReport?.id]);

  // Esc closes the incident modal (audit U-05).
  useEscapeKey(() => setSelectedReport(null), !!selectedReport);

  useEffect(() => {
    if (!profile?.id) return; // skip the eq.undefined 400 + broken subscription before profile loads
    supabase.from('departments').select('id, name').order('name')
      .then(({ data }) => setDepartments(data || []));
    const fetchAssignedReports = async () => {
      setLoading(true);
      // Slim view: attachments keeps location/coords/contact but drops
      // base64 media so the board loads fast. Full rows are fetched on
      // demand (resolve, notification open).
      const { data, error } = await supabase
        .from('emergency_reports_list')
        .select('*')
        // Primary assignments AND incidents where dept admin added me as backup
        .or(`assigned_to.eq.${profile.id},backup_responder_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });
      
      if (data && !error) {
        setAssignedReports(data);
      }
      setLoading(false);
    };

    fetchAssignedReports();

    // Real-time: a fresh dispatch arrives as an UPDATE that sets assigned_to
    // to me, so the row is NOT yet in state — upsert (prepend if new,
    // replace if known) instead of map-only, or the responder never sees
    // the assignment without a reload.
    const subscription = supabase
      .channel(`assigned_reports_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'emergency_reports', filter: `assigned_to=eq.${profile.id}` }, (payload) => {
        const row = payload.new;
        setAssignedReports(prev => {
          const known = prev.some(r => r.id === row.id);
          if (known) return prev.map(r => (r.id === row.id ? { ...r, ...row } : r));
          return [row, ...prev];
        });
      })
      // Same upsert for backup_responder_id — dept-admin approval lands here
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'emergency_reports', filter: `backup_responder_id=eq.${profile.id}` }, (payload) => {
        const row = payload.new;
        setAssignedReports(prev => {
          const known = prev.some(r => r.id === row.id);
          if (known) return prev.map(r => (r.id === row.id ? { ...r, ...row } : r));
          return [row, ...prev];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [profile?.id]);

  // Cross-department assistance requests aimed at this responder's department.
  useEffect(() => {
    if (!profile?.id || !profile?.department_id) return;
    const fetchAssistance = async () => {
      const { data, error } = await supabase
        .from('cross_department_assistance')
        .select('*, report:emergency_reports(*), requester:user_profiles!requested_by(full_name)')
        .eq('assisting_department_id', profile.department_id)
        // Unassigned requests broadcast to the whole dept; once the dept
        // admin picks a responder it is exclusive to them.
        .or(`responder_id.is.null,responder_id.eq.${profile.id}`)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false });
      if (!error && data) setAssistanceRequests(data);
    };

    fetchAssistance();

    const channel = supabase
      .channel(`assistance_requests_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cross_department_assistance', filter: `assisting_department_id=eq.${profile.department_id}` }, () => fetchAssistance())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, profile?.department_id]);

  // Same-dept backup requests: mine (status feedback + withdraw) and
  // approvals naming me as the backup responder.
  useEffect(() => {
    if (!profile?.id) return;
    const fetchBackups = async () => {
      const { data } = await supabase
        .from('responder_backup_requests')
        .select('*')
        .or(`requested_by.eq.${profile.id},backup_responder_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });
      if (data) setBackupRequests(data);
    };
    fetchBackups();
    const ch = supabase
      .channel(`backup_req_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responder_backup_requests' }, () => fetchBackups())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id]);

  const myBackupReq = (reportId) => backupRequests.find(b => b.report_id === reportId);

  const requestBackup = async () => {
    const reason = backupReason.trim();
    if (!backupFor || !reason) { setBackupError('A reason is required.'); return; }
    const { error } = await supabase.from('responder_backup_requests').insert({
      report_id: backupFor.id,
      department_id: profile?.department_id,
      requested_by: profile?.id,
      reason,
    });
    if (error) {
      setBackupError(error.code === '23505'
        ? 'A backup request for this incident is already pending.'
        : error.message);
      return;
    }
    setBackupFor(null); setBackupReason(''); setBackupError('');
  };

  const withdrawBackup = async (req) => {
    await supabase.from('responder_backup_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', req.id);
  };

  // Publish live GPS while carrying an open assignment OR an accepted
  // assistance request on a non-terminal incident — the reporter watches the
  // responder approach on the incident map. Writes are throttled to ≥20 m
  // movement or ≥10 s and stop entirely once every task is resolved/declined.
  const hasOpenAssignment =
    assignedReports.some(r => !['resolved', 'declined'].includes(r.status)) ||
    assistanceRequests.some(a =>
      a.status === 'accepted' &&
      a.responded_by === profile?.id &&
      !['resolved', 'declined'].includes(a.report?.status));

  // Selected incident coords + the responder's own live pin — the same two
  // markers the resident sees, plus a street-following dashed line.
  const incidentPos = reportCoords(selectedReport);
  const myDept = departments.find(d => d.id === profile?.department_id)?.name;
  const selfMarkers = myPosition ? [{ position: myPosition, icon: responderDeptIcon(myDept) }] : [];
  const approachPairs = myPosition && incidentPos ? [{ id: 'me', from: myPosition, to: incidentPos }] : [];
  const approachRoutes = useDrivingRoutes(approachPairs);
  const approachRoute = approachRoutes.length ? approachRoutes : null;

  // --- Arrived-on-scene gate (Spec 001 FR-011..013) -----------------------
  // Client-side distance is a UX preview only — the RPC re-verifies the
  // server's copy of our position before recording anything.
  const [arriving, setArriving] = useState(false);
  const [arriveMsg, setArriveMsg] = useState('');
  const [radiusM, setRadiusM] = useState(50);
  const { rows: selHistory } = useIncidentHistory(selectedReport?.id, !!selectedReport);
  const hasArrived = selHistory.some(r => r.to_status === 'arrived');

  useEffect(() => {
    // Table may not exist until the migration is applied — default 50 stays.
    supabase.from('app_settings').select('value').eq('key', 'arrival_radius_m').maybeSingle()
      .then(({ data }) => {
        const v = Number(data?.value);
        if (Number.isFinite(v) && v > 0) setRadiusM(v);
      });
  }, []);

  const distM = haversineMeters(incidentPos, myPosition);
  const arriveBlock =
    !myPosition ? 'Location unavailable — enable GPS to confirm arrival.'
    : !incidentPos ? 'Incident has no coordinates — arrival cannot be verified.'
    : distM == null ? 'Location unavailable — enable GPS to confirm arrival.'
    : distM > radiusM ? `You're ~${Math.round(distM)} m away — move within ${Math.round(radiusM)} m.`
    : null;

  const markArrived = async () => {
    if (arriving || !selectedReport) return;
    setArriving(true);
    setArriveMsg('');
    const { data, error } = await supabase.rpc('mark_incident_arrived', { p_report_id: selectedReport.id });
    setArriving(false);
    const code = data?.error || error?.code;
    if (error || !data?.ok) {
      setArriveMsg(
        code === 'too_far' ? `You're ~${Math.round(data.distance_m)} m away — move within ${Math.round(data.radius_m)} m.`
        : code === 'location_unavailable' ? 'Location unavailable — enable GPS.'
        : code === 'unauthorized' ? 'Only the assigned responder can mark arrival.'
        : code === 'already_arrived' ? 'Arrival already recorded.'
        : 'Could not record arrival — try again.');
      return;
    }
    setArriveMsg(data?.already ? 'Arrival already recorded.' : 'Arrival recorded — the reporter can see it now.');
  };
  useEffect(() => {
    if (!profile?.id || !hasOpenAssignment || !navigator.geolocation) return undefined;
    let lastWrite = 0;
    let lastPos = null;
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const latitude = Number(coords.latitude.toFixed(6));
        const longitude = Number(coords.longitude.toFixed(6));
        setMyPosition([latitude, longitude]);
        const now = Date.now();
        const moved = !lastPos
          || Math.hypot(latitude - lastPos[0], longitude - lastPos[1]) > 0.0002;
        if (!moved && now - lastWrite < 10000) return;
        lastPos = [latitude, longitude];
        lastWrite = now;
        supabase.from('responder_locations').upsert({
          responder_id: profile.id,
          latitude,
          longitude,
          updated_at: new Date().toISOString(),
        }).then(({ error }) => {
          if (error) console.error('Location share failed:', error);
        });
      },
      (err) => console.warn('Location watch:', err.message),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [profile?.id, hasOpenAssignment]);

  const respondAssistance = async (request, nextStatus) => {
    const { error } = await supabase
      .from('cross_department_assistance')
      .update({ status: nextStatus, responded_by: profile?.id, updated_at: new Date().toISOString() })
      .eq('id', request.id);
    if (error) {
      console.error('Assistance response failed:', error);
      return;
    }
    setAssistanceRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: nextStatus } : r));
  };

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
    // Board rows come from the slim view (evidence images stripped). Merge
    // onto the FULL attachments so resolving never erases the reporter's
    // photos.
    const { data: full } = await supabase
      .from('emergency_reports')
      .select('attachments')
      .eq('id', report.id)
      .single();
    const attachments = { ...(full?.attachments || report.attachments || {}), resolution_proof: resolutionPhoto };
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
      <AppSidebar links={links} profile={profile} signOut={signOut} />
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
            <NotificationBell userId={profile?.id} onOpenIncident={async (id) => {
              const { data } = await supabase.from('emergency_reports').select('*').eq('id', id).single();
              if (data) { setSelectedReport(data); return; }
              // Assistance-only assignments may sit outside the responder's
              // direct report scope — the inbound list already joins the row.
              const viaCda = assistanceRequests.find(a => a.report?.id === id)?.report;
              if (viaCda) setSelectedReport(viaCda);
            }}/>
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
        
        {assistanceRequests.length > 0 && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="Users" size={18} className="text-amber-600"/>
              <h2 className="font-bold">Assistance requested for your department</h2>
            </div>
            <div className="space-y-3">
              {assistanceRequests.map((req) => {
                const r = req.report || {};
                return (
                  <div key={req.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold capitalize">{r.report_type || r.incident_type || 'incident'} <span className="font-mono text-xs text-slate-500">{r.report_id || r.id?.slice(0, 8)}</span></p>
                      <p className="mt-0.5 truncate text-sm text-slate-600">{r.content || r.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {r.attachments?.location || r.location || 'No location'}
                        {req.requester?.full_name ? ` — requested by ${req.requester.full_name}` : ''}
                      </p>
                    </div>
                    {req.status === 'pending' ? (
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => respondAssistance(req, 'declined')}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => respondAssistance(req, 'accepted')}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Accept
                        </button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">Accepted</span>
                        <button
                          onClick={() => setSelectedReport(r)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          View incident
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
        <div className="fixed inset-0 z-1050 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" onClick={() => setSelectedReport(null)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white " onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600">
                  <Icon name={selectedReport.report_type === 'medical' ? 'HeartPulse' : 'Siren'} size={20}/>
                </div>
                <div>
                  <p className="font-semibold capitalize">{selectedReport.report_type || selectedReport.incident_type} emergency</p>
                  <p className="font-mono text-xs text-slate-500">{selectedReport.report_id || selectedReport.id?.slice(0, 8)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-taste-50 px-2 py-1 text-[10px] font-bold uppercase text-taste-600">
                  {selectedReport.status || 'pending'}
                </span>
                <button onClick={() => setSelectedReport(null)} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                  <Icon name="X" size={18}/>
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <p className="text-xs font-bold  text-slate-500">Description</p>
                <p className="mt-1 text-sm text-slate-700">{selectedReport.content || selectedReport.description}</p>
              </div>

              <div>
                <p className="text-xs font-bold  text-slate-500">Location</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Icon name="MapPin" size={14} className="shrink-0 text-taste-500"/>
                  <p className="text-sm text-slate-700">{selectedReport.attachments?.location || selectedReport.location || 'No location recorded'}</p>
                </div>
                {incidentPos ? (
                  <>
                    <div className="mt-2 h-56 overflow-hidden rounded-lg border border-slate-200">
                      <BoundaryMap
                        marker={incidentPos}
                        markers={selfMarkers}
                        route={approachRoute}
                      />
                    </div>
                    {myPosition && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <Icon name="Navigation" size={12} className="text-blue-600"/>
                        Blue pin is your live location — the resident sees you approach too.
                      </p>
                    )}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${incidentPos[0]},${incidentPos[1]}`}
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
                  <p className="text-xs font-bold  text-slate-500">Resolution proof</p>
                  <img
                    src={selectedReport.attachments.resolution_proof}
                    alt="Resolution proof"
                    className="mt-1 h-28 w-40 rounded-lg border border-slate-200 object-cover"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold  text-slate-500">Priority</p>
                  <p className="mt-1 text-sm font-semibold capitalize">{selectedReport.priority || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold  text-slate-500">Reported</p>
                  <p className="mt-1 text-sm text-slate-700">{selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleString() : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold  text-slate-500">Reporter contact</p>
                  <p className="mt-1 text-sm text-slate-700">{selectedReport.attachments?.contact_name || 'N/A'}</p>
                  <p className="text-xs text-slate-500">{selectedReport.attachments?.contact_phone || ''}</p>
                </div>
                <ServiceAreaBadge report={selectedReport} />
              </div>

              <IncidentTimeline report={selectedReport} />

              {/* My same-dept backup request for this incident — status,
                  the dept admin's decline remark, and withdraw */}
              {(() => {
                const req = myBackupReq(selectedReport.id);
                if (!req) return null;
                return (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sky-800">Backup request <span className="ml-1 rounded-full bg-sky-200/70 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-900">{req.status}</span></p>
                      {req.status === 'pending' && req.requested_by === profile?.id && (
                        <button onClick={() => withdrawBackup(req)} className="text-xs font-semibold text-sky-700 underline">Withdraw</button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-sky-800">"{req.reason}"</p>
                    {req.status === 'declined' && req.review_notes && (
                      <p className="mt-1.5 text-xs text-red-700">Declined — {req.review_notes}</p>
                    )}
                    {req.status === 'approved' && (
                      <p className="mt-1.5 text-xs text-emerald-700">Approved — a second responder is on the way.</p>
                    )}
                  </div>
                );
              })()}

              {selectedReport.assigned_to === profile?.id && (
                <IncidentChat reportId={selectedReport.id} title="Message the reporter"/>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-6 py-4">
              {selectedReport.status === 'assigned' && selectedReport.assigned_to === profile?.id && (
                <button
                  onClick={() => { updateStatus(selectedReport.id, 'in-progress'); setSelectedReport(null); }}
                  className="flex-1 rounded-lg bg-taste-500 px-3 py-2 text-sm font-semibold text-white hover:bg-taste-600"
                >
                  Acknowledge
                </button>
              )}
              {selectedReport.status === 'in-progress' && selectedReport.assigned_to === profile?.id && !hasArrived && (
                <div className="flex-1 space-y-1">
                  <button
                    onClick={markArrived}
                    disabled={arriving || !!arriveBlock}
                    className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {arriving ? 'Recording…' : 'Arrived on scene'}
                  </button>
                  {(arriveBlock || arriveMsg) && (
                    <p className={`text-center text-xs ${arriveMsg && !arriveBlock ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {arriveBlock || arriveMsg}
                    </p>
                  )}
                </div>
              )}
              {selectedReport.status === 'in-progress' && selectedReport.assigned_to === profile?.id && (
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
              {(selectedReport.assigned_to === profile?.id || selectedReport.backup_responder_id === profile?.id)
                && ['assigned', 'in-progress'].includes(selectedReport.status) && (
                <button
                  onClick={() => { setBackupFor(selectedReport); setBackupReason(''); setBackupError(''); }}
                  disabled={myBackupReq(selectedReport.id)?.status === 'pending'}
                  className="flex-1 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {myBackupReq(selectedReport.id)?.status === 'pending' ? 'Backup requested' : 'Request backup'}
                </button>
              )}
              <button onClick={() => setSelectedReport(null)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Same-dept backup — reason is required; the department admin
          approves and picks the second responder */}
      {backupFor && (
        <div className="fixed inset-0 z-1050 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-bold">Request backup</h3>
              <button onClick={() => setBackupFor(null)} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                <Icon name="X" size={18}/>
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600">
                Your department admin reviews this and assigns a second responder. Tell them why you can't handle
                <span className="font-mono text-xs"> {backupFor.report_id || backupFor.id?.slice(0, 8)} </span>alone.
              </p>
              <label className="mt-4 block text-sm font-semibold">Reason <span className="text-red-500">*</span></label>
              <textarea
                value={backupReason}
                onChange={e => { setBackupReason(e.target.value); setBackupError(''); }}
                placeholder="e.g. Two casualties on scene — need a second unit for extrication..."
                rows={4}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {backupError && (
                <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">{backupError}</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setBackupFor(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
                <button onClick={requestBackup} disabled={!backupReason.trim()} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">Send request</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
