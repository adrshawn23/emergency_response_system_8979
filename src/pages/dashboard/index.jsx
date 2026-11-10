import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import NotificationBell from '../../components/NotificationBell';
import { supabase } from '../../lib/supabase';
import DepartmentManagementSection from './components/DepartmentManagementSection';
import CommandOps from './components/CommandOps';
import UserAccessManager from './components/UserAccessManager';
import PageAccessMatrix from './components/PageAccessMatrix';
// Reports pulls in recharts via CommandAnalytics — lazy like the analytics card.
const ReportsSection = lazy(() => import('./components/ReportsSection'));
import useIncidentAlarm from '../../hooks/useIncidentAlarm';
import { isPointInBoundary } from '../../utils/geofence';
import ResidentHome from '../resident-home';
import ResponderView from '../responder-view';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../../utils/leafletIcon';
import BoundaryMap from '../../components/BoundaryMap';
import ServiceAreaBadge from '../../components/ServiceAreaBadge';
import IncidentTimeline from '../../components/IncidentTimeline';
import useIncidentHistory from '../../hooks/useIncidentHistory';
import AppSidebar from '../../components/AppSidebar';
import useServiceBoundary from '../../hooks/useServiceBoundary';
import useResponderLocation from '../../hooks/useResponderLocation';
import useResponderLocations from '../../hooks/useResponderLocations';
import usePendingRegistrations from '../../hooks/usePendingRegistrations';
import useEscapeKey from '../../hooks/useEscapeKey';
import { RESPONDER_ICON, responderDeptIcon, incidentIcon } from '../../utils/leafletIcon';
import useDrivingRoutes from '../../hooks/useDrivingRoutes';
import { reportCoords } from '../../utils/reportCoords';
import { compareBirthdates } from '../../utils/verificationRules';

const priorityStyles = {
  critical: 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-600/25',
  high: 'bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-600/25',
  medium: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/25',
  low: 'bg-sky-100 text-taste-600 ring-1 ring-inset ring-sky-600/25'
};

const statusStyles = {
  pending: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
  assigned: 'bg-taste-50 text-taste-600 ring-1 ring-inset ring-taste-500/20',
  'in-progress': 'bg-taste-50 text-taste-600 ring-1 ring-inset ring-sky-600/20',
  resolved: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
};

const formatStatus = (value) => value?.replace('-', ' ');

const BoundaryEditor = ({ boundaryPoints, setBoundaryPoints }) => {
  useMapEvents({
    click(e) {
      setBoundaryPoints([...boundaryPoints, { lat: e.latlng.lat, lng: e.latlng.lng }]);
    }
  });
  return null;
};

// Fits the map once per change of the loaded boundary — a signature
// keeps re-renders from resetting the user's view.
const FitToBoundary = ({ positions }) => {
  const map = useMap();
  const signature = JSON.stringify(positions);
  const last = useRef(null);
  useEffect(() => {
    if (positions.length && signature !== last.current) {
      last.current = signature;
      map.fitBounds(positions, { padding: [24, 24] });
    }
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

const CommandCenterMap = ({ boundaryPoints, activeReport, responderMarkers = [], incidentMarkers = [], routes = [] }) => {
  return (
    <MapContainer center={[10.3172, 123.8951]} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      {boundaryPoints.length > 2 && (
        <Polygon 
          positions={boundaryPoints.map(p => [p.lat, p.lng])}
          color="#1b6c80"
          fillColor="#1b6c80"
          fillOpacity={0.08}
        />
      )}
      <FitToBoundary positions={boundaryPoints.length > 2 ? boundaryPoints.map(p => [p.lat, p.lng]) : []} />
      {routes.map((r) => (
        <Polyline key={r.id} positions={r.positions} color={r.color || '#2563eb'} weight={3} dashArray="6 8" opacity={0.75}/>
      ))}
      {activeReport?.latitude && activeReport?.longitude && (
        <Marker position={[activeReport.latitude, activeReport.longitude]}/>
      )}
      {incidentMarkers.map((m) => (
        <Marker key={m.id} position={m.position} icon={incidentIcon(m.type)}>
          <Popup>
            <div style={{ fontSize: 12 }}>
              <strong className="capitalize">{m.type || 'incident'}</strong> — {m.reportId}<br/>
              <span className="capitalize">{m.status}</span>{m.location ? ` · ${m.location}` : ''}
            </div>
          </Popup>
        </Marker>
      ))}
      {responderMarkers.map((m) => (
        <Marker key={m.id} position={m.position} icon={RESPONDER_ICON}>
          <Popup>
            <div style={{ fontSize: 12 }}>
              <strong>{m.name || 'Responder'}</strong><br/>
              Updated {m.updatedAt ? new Date(m.updatedAt).toLocaleTimeString() : '—'}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return 'Unknown time';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

// Normalizes free-text comparisons (case/whitespace-insensitive) for the
// OCR-vs-registration auto-check and the review modal's match chips.
const normText = s => (s ?? '').toString().toLowerCase().replace(/\s+/g, ' ').trim();

// Stale-assignment flag: still 'assigned' and untouched past 10m —
// updated_at is the last write, i.e. roughly when it was assigned.
const STALE_ASSIGNED_MS = 10 * 60 * 1000;
const staleAssignedMinutes = (report) => {
  if (report?.status !== 'assigned') return null;
  const t = new Date(report?.updated_at || report?.created_at || 0).getTime();
  const age = Date.now() - t;
  return t && age > STALE_ASSIGNED_MS ? Math.floor(age / 60000) : null;
};
const sectionCopy = {
  queue: { eyebrow: 'Live operations', title: 'Incident queue', description: 'Review, prioritize, and assign incoming emergency reports.' },
  new: { eyebrow: 'Live operations', title: 'New incident report', description: 'Create a report now. Dispatch sees urgent reports immediately, even while verification is pending.' },
  residents: { eyebrow: 'Administration', title: 'Residents & ID review', description: 'Review registrations, account status, and ID review outcomes.' },
  access: { eyebrow: 'Administration', title: 'Access control', description: 'Change user roles and suspend or reactivate accounts. Changes apply to live sessions immediately.' },
  departments: { eyebrow: 'Administration', title: 'Departments & memberships', description: 'Only administrators can change department access, roles, and memberships.' },
  reports: { eyebrow: 'Monitoring', title: 'Reports & system activity', description: 'Review incident records, export data, and audit operational activity.' },
  profile: { eyebrow: 'Account', title: 'Your profile', description: 'Review your command-center account and operational availability.' }
};

// Hard gate on top of canAccessPage — admins bypass the page_permissions
// matrix, so the "admin sees only 5 pages" rule must live here. Reporting
// and triage stay with dispatchers/responders/residents who own them.
const SECTION_ROLES = {
  queue: ['dispatcher', 'responder', 'department_admin'],
  new: ['dispatcher', 'responder', 'resident'],
  residents: ['admin'],
  access: ['admin'],
  departments: ['admin'],
  reports: ['admin', 'dispatcher'],
  profile: ['admin', 'dispatcher', 'responder', 'resident', 'department_admin'],
};
const sectionAllowed = (key, role) => !SECTION_ROLES[key] || SECTION_ROLES[key].includes(role);

function WorkspacePage({ section, profile, signOut, onSectionChange }) {
  const { refreshProfile, canAccessPage } = useAuth();
  const navigate = useNavigate();
  const { reports, setReports } = useMockData();
  const [status, setStatus] = useState('all');
  const [draft, setDraft] = useState({ type: 'fire', priority: 'high', location: '', description: '', latitude: null, longitude: null, serviceAreaStatus: 'manual' });
  const draftKey = `incident-draft-${profile?.id || 'anon'}`;
  const [gpsStatus, setGpsStatus] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState(null);
  // Nearby open incidents of the same type — set when the composer detects
  // a possible duplicate and needs the reporter to confirm it is different.
  const [dupMatches, setDupMatches] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [responders, setResponders] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedResponder, setSelectedResponder] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [pendingUsers, setPendingUsers] = usePendingRegistrations(profile);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactError, setContactError] = useState('');
  const [newContact, setNewContact] = useState({ name: '', relationship: '', phone_number: '', is_primary: false });
  // Active service boundary: Supabase geofence_boundaries first,
  // legacy localStorage copy as the mock/offline fallback.
  const { points: boundaryPoints, setPoints: setBoundaryPoints, save: saveServiceBoundary } = useServiceBoundary();

  // Restore an unsubmitted incident draft once the reporter's id is known
  useEffect(() => {
    if (!profile?.id) return;
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey));
      if (saved && typeof saved === 'object') {
        setDraft(prev => ({
          ...prev,
          type: saved.type || prev.type,
          priority: saved.priority || prev.priority,
          location: prev.location || saved.location || '',
          description: prev.description || saved.description || ''
        }));
      }
    } catch {}
  }, [profile?.id, draftKey]);

  // Persist the draft whenever text fields change; cleared on successful submit
  useEffect(() => {
    try {
      if (draft.location || draft.description) {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      }
    } catch {}
  }, [draft, draftKey]);

  const [isBoundaryModalOpen, setIsBoundaryModalOpen] = useState(false);
  const [cdaRequests, setCdaRequests] = useState([]);
  const [reassignRequests, setReassignRequests] = useState([]);
  const [isReassignRequestOpen, setIsReassignRequestOpen] = useState(false);
  const [reassignReason, setReassignReason] = useState('');
  const [reassignRequestError, setReassignRequestError] = useState('');
  const [assignError, setAssignError] = useState('');

  const [imageFiles, setImageFiles] = useState([]);
  const [idVerifications, setIdVerifications] = useState([]);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  // Required for Reject / Request clarity — stored as review_notes, shown
  // to the applicant on their verification card and inside the decision email.
  const [reviewRemark, setReviewRemark] = useState('');
  const [idDocSignedUrl, setIdDocSignedUrl] = useState(null);
  const [profileTab, setProfileTab] = useState('info');
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [profileFormInit, setProfileFormInit] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReportDetailModalOpen, setIsReportDetailModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Esc closes any open modal (audit U-05). Must sit below ALL modal state
  // declarations — referencing a useState value above its declaration is a
  // TDZ ReferenceError.
  useEscapeKey(() => setIsContactModalOpen(false), isContactModalOpen);
  useEscapeKey(() => setIsBoundaryModalOpen(false), isBoundaryModalOpen);
  useEscapeKey(() => setIsReassignRequestOpen(false), isReassignRequestOpen);
  useEscapeKey(() => setIsReviewModalOpen(false), isReviewModalOpen);
  useEscapeKey(() => setIsAssignModalOpen(false), isAssignModalOpen);
  useEscapeKey(() => setIsReportDetailModalOpen(false), isReportDetailModalOpen);
  useEscapeKey(() => setIsImageModalOpen(false), isImageModalOpen);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles([...imageFiles, ...files]);
  };

  const handleRemoveImage = (index) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index));
  };

  // Fetch reports from Supabase — gated on profile so the request always
  // carries a session; an unauthenticated call is silently RLS-filtered to []
  // and was previously never retried.
  useEffect(() => {
    if (!profile?.id) return undefined;
    const fetchReports = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('emergency_reports_list')
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
      .channel('workspace_emergency_reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setReports(prev => prev.some(r => r.id === payload.new.id) ? prev : [payload.new, ...prev]);
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
  }, [profile?.id]);

  // Staff-side visibility for ALL assistance requests — including ones a
  // responder initiated from their incident modal. Refetches on any cda row
  // change so requests surface live.
  useEffect(() => {
    const fetchAssistance = async () => {
      const { data } = await supabase
        .from('cross_department_assistance')
        .select('*, requester:user_profiles!requested_by(full_name), department:departments!assisting_department_id(name), responder:user_profiles!responder_id(full_name)')
        .in('status', ['pending', 'accepted', 'declined'])
        .order('created_at', { ascending: false });
      setCdaRequests(data || []);
    };
    fetchAssistance();
    const cdaChannel = supabase.channel(`workspace_cda_changes_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cross_department_assistance' }, () => fetchAssistance())
      .subscribe();
    return () => { supabase.removeChannel(cdaChannel); };
  }, []);

  // Reassignment requests — dept admins flag wrongly-assigned incidents for
  // the dispatcher to re-dispatch. Realtime so the queue updates live.
  useEffect(() => {
    const fetchReassign = async () => {
      const { data } = await supabase
        .from('reassignment_requests')
        .select('*, requester:user_profiles!requested_by(full_name), department:departments!department_id(name)')
        .in('status', ['pending', 'approved', 'denied', 'cancelled'])
        .order('created_at', { ascending: false });
      setReassignRequests(data || []);
    };
    fetchReassign();
    const rrChannel = supabase.channel(`workspace_rr_changes_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reassignment_requests' }, () => fetchReassign())
      .subscribe();
    return () => { supabase.removeChannel(rrChannel); };
  }, []);

  // Fetch departments and responders for assignment modal
  useEffect(() => {
    const fetchAssignmentData = async () => {
      if (!isAssignModalOpen) return;

      const { data: deptData } = await supabase
        .from('departments')
        .select('*');
      
      if (deptData) setDepartments(deptData);

      const { data: responderData, error: responderError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'responder')
        .eq('status', 'active');
      
      console.log('Fetched responders:', responderData);
      console.log('Responder error:', responderError);
      if (responderData) {
        responderData.forEach(r => {
          console.log(`Responder: ${r.full_name || r.email}, dept_id: ${r.department_id}, role: ${r.role}, status: ${r.status}`);
        });
        setResponders(responderData);
      }
    };

    fetchAssignmentData();
  }, [isAssignModalOpen]);

  // department_admin: load their department's responders once — used by the
  // assign modal and by the per-request responder select in the CDA list.
  useEffect(() => {
    if (profile?.role !== 'department_admin' || !profile?.department_id) return;
    supabase
      .from('user_profiles')
      .select('id, full_name, email, department_id, role')
      .eq('department_id', profile.department_id)
      .eq('role', 'responder')
      .eq('status', 'active')
      .then(({ data }) => { if (data) setResponders(data); });
  }, [profile?.role, profile?.department_id]);

  // Fetch emergency contacts
  useEffect(() => {
    const fetchContacts = async () => {
      if (!profile?.id) return; // skip the eq.undefined 400 before profile loads
      const { data } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', profile?.id);
      
      if (data) setEmergencyContacts(data);
    };

    fetchContacts();
  }, [profile?.id]);

  // Fetch ID verifications (admin only). Runs on mount so the Residents &
  // review nav badge + status tabs are accurate on any section; a realtime
  // channel re-derives them live (spec 003 FR-009 — needs the
  // 20261110140000 migration's publication add).
  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const fetchVerifications = async () => {
      const { data } = await supabase
        .from('id_verifications')
        .select('*, user_profiles!id_verifications_user_id_fkey(full_name, email, phone, address, residency_type, birthdate)')
        .order('created_at', { ascending: false });

      if (!data) return;

      // Rows are auto-approved only by the verify-id edge function (server
      // OCR >= 90% + all fields matched) and auto-rejected when no document
      // was received. Everything else waits for an administrator decision.
      setIdVerifications(data);
    };

    const load = async () => {
      // Auto-reject: pending submissions that never delivered a document.
      // 1h grace covers an in-flight registration upload; mirrored hourly by
      // pg_cron (supabase/auto_reject_missing_id.sql) when enabled.
      if (section === 'residents') {
        await supabase
          .from('id_verifications')
          .update({
            verification_status: 'rejected',
            review_notes: 'Auto-rejected: no ID document was submitted.',
          })
          .eq('verification_status', 'pending')
          .is('id_document_url', null)
          .is('document_storage_path', null)
          .lt('created_at', new Date(Date.now() - 3600_000).toISOString());
      }
      await fetchVerifications();
    };

    load();
    const ch = supabase
      .channel('id-verifications-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'id_verifications' }, fetchVerifications)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.role, section]);

  const [registrantTab, setRegistrantTab] = useState('forApproval');

  // Latest non-superseded verification per user — single source of truth for
  // the four registrant views (spec 003).
  const latestVerificationByUser = useMemo(() => {
    const map = new Map();
    (idVerifications || []).forEach(v => {
      if (v.verification_status === 'superseded') return;
      const prev = map.get(v.user_id);
      if (!prev || new Date(v.created_at) > new Date(prev.created_at)) map.set(v.user_id, v);
    });
    return map;
  }, [idVerifications]);

  const registrantViews = useMemo(() => {
    const views = { forApproval: [], returned: [], approved: [], rejected: [] };
    latestVerificationByUser.forEach(v => {
      const entry = { kind: 'verification', verification: v };
      if (v.verification_status === 'pending' || v.verification_status === 'under_review') views.forApproval.push(entry);
      else if (v.verification_status === 'needs_clarity' || v.verification_status === 'correction_required') views.returned.push(entry);
      else if (v.verification_status === 'approved') views.approved.push(entry);
      else if (v.verification_status === 'rejected') views.rejected.push(entry);
    });
    // Inactive profiles without any verification row are brand-new signups —
    // they belong in For Approval. Users with a row are bucketed by its status
    // above (returned/rejected users stay inactive, so this also dedupes them).
    (pendingUsers || []).forEach(u => {
      if (!latestVerificationByUser.has(u.id)) views.forApproval.push({ kind: 'pending', user: u });
    });
    return views;
  }, [latestVerificationByUser, pendingUsers]);

  // The reviewer's note on the previous revision — shown when a resubmitted
  // registration reopens in For Approval (spec 003 US2).
  const priorDecisionNote = useMemo(() => {
    if (!selectedVerification?.user_id || (selectedVerification.submission_revision || 1) <= 1) return null;
    const prev = (idVerifications || [])
      .filter(v => v.user_id === selectedVerification.user_id && v.id !== selectedVerification.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    return prev ? (prev.decision_reason || prev.review_notes || null) : null;
  }, [idVerifications, selectedVerification]);

  // review_verification() (migration 20261030101000) is the atomic server
  // path: decision + activation + audit in one transaction, with stale-
  // submission protection. Until it's applied remotely, fall back to the
  // direct updates so the admin UI keeps working.
  const callReviewVerification = async (verificationId, decision, reason) => {
    const { error } = await supabase.rpc('review_verification', {
      p_verification_id: verificationId,
      p_decision: decision,
      p_reason: reason,
    });
    if (error && (error.code === 'PGRST202' || /schema cache|could not find|does not exist/i.test(error.message || ''))) {
      return { unsupported: true };
    }
    return { error };
  };

  // Fire-and-forget: notify-decision emails the applicant the stored
  // decision (approve/reject/needs_clarity). Result is logged so failures
  // (missing secrets, unverified sender, not_found) stop being invisible.
  const notifyDecision = (verificationId) => {
    if (!verificationId) return;
    supabase.functions.invoke('notify-decision', { body: { verification_id: verificationId } })
      .then(({ data, error }) => {
        if (error || data?.error || data?.skipped) console.warn('notify-decision:', error || data);
      })
      .catch((e) => console.warn('notify-decision invoke failed:', e));
  };

  const findOpenVerification = (userId) =>
    idVerifications.find(v => v.user_id === userId && v.verification_status !== 'superseded');

  const handlePendingApprove = async (userId) => {
    const verification = findOpenVerification(userId);
    if (verification) {
      const { error, unsupported } = await callReviewVerification(verification.id, 'approved', 'Approved by administrator');
      if (error) { console.error('Approve user failed:', error); return; }
      if (!unsupported) {
        setPendingUsers(prev => prev.filter(u => u?.id !== userId));
        setIdVerifications(prev => prev.map(v =>
          v.id === verification.id ? { ...v, verification_status: 'approved', reviewed_by: profile?.id } : v));
        notifyDecision(verification.id);
        return;
      }
    }

    // Fallback (RPC absent or no verification row): direct activation.
    const { error } = await supabase
      .from('user_profiles')
      .update({ status: 'active', account_status: 'active' })
      .eq('id', userId);
    if (error) {
      console.error('Approve user failed:', error);
      return;
    }
    setPendingUsers(prev => prev.filter(u => u?.id !== userId));
    notifyDecision(verification?.id);
  };

  const handlePendingReject = async (userId, reason) => {
    const rejectionReason = reason || 'Registration rejected by administrator';
    const verification = findOpenVerification(userId);
    if (!verification) {
      // Nothing to decide on — never delete the applicant's profile.
      console.warn('Reject skipped: no verification submission exists for', userId);
      return;
    }

    const { error, unsupported } = await callReviewVerification(verification.id, 'rejected', rejectionReason);
    if (error) { console.error('Reject user failed:', error); return; }
    if (!unsupported) {
      setPendingUsers(prev => prev.filter(u => u?.id !== userId));
      setIdVerifications(prev => prev.map(v =>
        v.id === verification.id ? { ...v, verification_status: 'rejected', reviewed_by: profile?.id, review_notes: rejectionReason } : v));
      notifyDecision(verification.id);
      return;
    }

    // Fallback: mark the submission rejected; the account stays pending so
    // the applicant can resubmit or appeal. No profile is ever deleted.
    const { error: rejectError } = await supabase
      .from('id_verifications')
      .update({ verification_status: 'rejected', reviewed_by: profile?.id, review_notes: rejectionReason })
      .eq('id', verification.id);
    if (rejectError) {
      console.error('Reject user failed:', rejectError);
      return;
    }
    setPendingUsers(prev => prev.filter(u => u?.id !== userId));
    notifyDecision(verification.id);
  };

  // One canonical entry per page — the editable page_permissions matrix is
  // the single gate (canAccessPage). Responder/resident relabeling is kept
  // as per-role variants instead of duplicate entries.
  const linkVariants = {
    responder: {
      command: { label: 'Response board', icon: 'Ambulance' },
    },
    resident: {
      command: { label: 'Home', icon: 'Home' },
      new: { label: 'Report emergency', icon: 'Siren' },
    },
  };
  const links = [
    { key: 'command', label: 'Command center', icon: 'LayoutDashboard', path: '/' },
    { key: 'queue', label: 'Incident queue', icon: 'Siren', path: '/report-management' },
    { key: 'new', label: 'New incident', icon: 'PlusCircle', path: '/emergency-report' },
    { key: 'residents', label: 'Residents & review', icon: 'Users', path: '/user-management' },
    { key: 'access', label: 'Access control', icon: 'ShieldCheck', path: '/access-control' },
    { key: 'departments', label: 'Departments', icon: 'Building2', path: '/department-management' },
    { key: 'reports', label: 'Reports', icon: 'BarChart3', path: '/reports' },
    { key: 'profile', label: 'Profile', icon: 'User', path: '/profile' }
  ]
    .filter(link => sectionAllowed(link.key, profile?.role) && canAccessPage(link.key, profile?.role))
    .map(link => ({ ...link, ...(linkVariants[profile?.role]?.[link.key] || {}) }));
  const current = sectionCopy[section];
  const filteredReports = searchQuery 
    ? reports.filter(report => {
        const query = searchQuery.toLowerCase();
        return (
          (report.report_type || report.incident_type || '').toLowerCase().includes(query) ||
          (report.content || report.description || '').toLowerCase().includes(query) ||
          (report.attachments?.location || report.location || '').toLowerCase().includes(query) ||
          (report.attachments?.contact_name || '').toLowerCase().includes(query) ||
          (report.attachments?.contact_phone || '').toLowerCase().includes(query) ||
          (report.report_id || report.id || '').toLowerCase().includes(query) ||
          (report.priority || '').toLowerCase().includes(query) ||
          (report.status || '').toLowerCase().includes(query)
        );
      })
    : reports;
  const visibleReports = status === 'all' ? filteredReports : filteredReports.filter(report => report.status === status);
  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const setReportStatus = async (id, nextStatus) => {
    const { error } = await supabase
      .from('emergency_reports')
      .update({ status: nextStatus })
      .eq('report_id', id);
    if (error) {
      console.error('Status update failed:', error);
      return;
    }
    setReports(items => items.map(item => item.report_id === id ? { ...item, status: nextStatus } : item));
  };

  const handleAssignClick = (report) => {
    setSelectedReport(report);
    // department_admin only assigns inside their own department — the
    // RLS check enforces it server-side too; this pre-selects it for UX.
    setSelectedDepartment(profile?.role === 'department_admin' ? profile?.department_id : null);
    setSelectedResponder(null);
    setAssignError('');
    setIsAssignModalOpen(true);
    supabase
      .from('emergency_reports')
      .select('*')
      .eq('id', report.id)
      .single()
      .then(({ data }) => { if (data) setSelectedReport(prev => (prev?.id === data.id ? data : prev)); });
  };

  const handleReportClick = (report) => {
    setSelectedReport(report);
    setIsReportDetailModalOpen(true);
    // List rows come from the slim view (media stripped). Pull the full row
    // so evidence images / resolution proof still render in the modal.
    supabase
      .from('emergency_reports')
      .select('*')
      .eq('id', report.id)
      .single()
      .then(({ data }) => { if (data) setSelectedReport(prev => (prev?.id === data.id ? data : prev)); });
  };

  const handleAssignmentSubmit = async () => {
    if (!selectedReport || !selectedDepartment) return;

    // Dispatcher assigns the MAIN department only — that write fires the
    // auto-dispatch trigger (cross-dept requests) and hands responder
    // selection to each department's admin.
    const patch = profile?.role === 'dispatcher'
      ? { assigned_department_id: selectedDepartment, status: 'assigned' }
      : { assigned_to: selectedResponder, assigned_department_id: selectedDepartment, status: 'assigned' };
    if (profile?.role !== 'dispatcher' && !selectedResponder) return;

    const { error } = await supabase
      .from('emergency_reports')
      .update(patch)
      .eq('id', selectedReport.id);

    if (error) {
      console.error('Assignment error:', error);
      setAssignError(error.message || 'Assignment failed. Please try again.');
      return;
    }

    setReports(prev => prev.map(r =>
      r.id === selectedReport.id
        ? { ...r, ...patch }
        : r
    ));

    setIsAssignModalOpen(false);

    // A dispatcher reassigning fulfils any pending reassignment request on
    // this report — mark it approved so the banner stops showing it live.
    if (profile?.role === 'dispatcher') {
      supabase
        .from('reassignment_requests')
        .update({ status: 'approved', reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
        .eq('report_id', selectedReport.id)
        .eq('status', 'pending')
        .then(({ error: rrError }) => {
          if (rrError) console.warn('Could not close reassignment request:', rrError.message);
        });
    }

    setSelectedReport(null);
    setSelectedDepartment(null);
    setSelectedResponder(null);
  };

  // Department admin files a reassignment request — they can't move the
  // incident themselves, dispatch stays a dispatcher job; the reason is
  // required so the dispatcher knows why it was wrongly assigned.
  const handleReassignRequestSubmit = async () => {
    const reason = reassignReason.trim();
    if (!selectedReport || !reason) {
      setReassignRequestError('Please give the dispatcher a reason for the reassignment.');
      return;
    }
    const { error } = await supabase
      .from('reassignment_requests')
      .insert({
        report_id: selectedReport.id,
        department_id: profile?.department_id,
        requested_by: profile?.id,
        reason,
      });
    if (error) {
      setReassignRequestError(
        error.code === '23505'
          ? 'A reassignment request is already pending for this incident.'
          : error.message
      );
      return;
    }
    setIsReassignRequestOpen(false);
    setReassignReason('');
    setReassignRequestError('');
    setSelectedReport(null);
  };

  const handleReassignRequestReview = async (request, status) => {
    await supabase
      .from('reassignment_requests')
      .update({ status, reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
      .eq('id', request.id);
  };

  // department_admin assigns the responder for a CDA request targeted at
  // their department — picking a responder IS accepting the request.
  const handleCdaResponderAssign = async (cdaId, responderId) => {
    const { error } = await supabase
      .from('cross_department_assistance')
      .update({ responder_id: responderId, status: 'accepted', responded_by: profile?.id })
      .eq('id', cdaId);
    if (error) {
      console.error('CDA responder assign error:', error);
      return;
    }
    setCdaRequests(prev => prev.map(c =>
      c.id === cdaId ? { ...c, responder_id: responderId, status: 'accepted' } : c
    ));
  };

  const handleAddContact = async () => {
    if (!newContact.name || !newContact.relationship || !newContact.phone_number) return;
    // profile loads async — without profile.id the insert ships no user_id
    // and RLS rejects it. Guard + surface errors instead of failing silently.
    if (!profile?.id) {
      setContactError('Profile is still loading. Try again in a moment.');
      return;
    }

    const { error } = await supabase
      .from('emergency_contacts')
      .insert({
        user_id: profile.id,
        name: newContact.name,
        relationship: newContact.relationship,
        phone_number: newContact.phone_number,
        is_primary: newContact.is_primary
      });

    if (error) {
      setContactError(error.message || 'Could not add contact. Try again.');
      return;
    }

    const { data } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', profile.id);

    if (data) setEmergencyContacts(data);
    setNewContact({ name: '', relationship: '', phone_number: '', is_primary: false });
    setContactError('');
    setIsContactModalOpen(false);
  };

  const handleDeleteContact = async (contactId) => {
    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', contactId);

    if (error) {
      setContactError(error.message || 'Could not delete contact. Try again.');
      return;
    }
    setEmergencyContacts(prev => prev.filter(c => c.id !== contactId));
    setContactError('');
  };

  const handleSaveBoundary = async () => {
    const result = await saveServiceBoundary(boundaryPoints);
    if (!result.ok) {
      console.warn('Boundary saved locally; Supabase write failed:', result.error);
    }
    setIsBoundaryModalOpen(false);
  };

  const handleReviewClick = (verification) => {
    setReviewRemark('');
    setSelectedVerification(verification);
    setIsReviewModalOpen(true);
  };

  // Opened from Pending Registrations: reuse the open verification row when
  // one exists; otherwise synthesize a minimal pending object so the modal
  // still renders declared data (id === null routes its action buttons to
  // the pending approve/reject handlers instead of review_verification).
  const handleReviewPendingUser = async (user) => {
    // The cached list can predate the applicant's submission; refetch their
    // latest open row before falling back to the synthesized placeholder.
    let verification = findOpenVerification(user?.id);
    if (!verification && user?.id) {
      const { data } = await supabase
        .from('id_verifications')
        .select('*, user_profiles!id_verifications_user_id_fkey(full_name, email, phone, address, residency_type, birthdate)')
        .eq('user_id', user.id)
        .neq('verification_status', 'superseded')
        .order('created_at', { ascending: false })
        .limit(1);
      verification = data?.[0] || null;
      if (verification) setIdVerifications(prev => [verification, ...prev]);
    }
    setSelectedVerification(verification || {
      id: null,
      user_id: user?.id,
      verification_status: 'pending',
      user_profiles: user,
      ocr_data: null,
      ocr_confidence: null,
      id_document_url: null,
      document_storage_path: null,
    });
    setReviewRemark('');
    setIsReviewModalOpen(true);
  };

  // ---- Profile editing (all roles) ----------------------------------------
  // Seed the form once the real profile row arrives.
  useEffect(() => {
    if (profile && !profileFormInit) {
      setProfileForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
      });
      setProfileFormInit(true);
    }
  }, [profile, profileFormInit]);

  const handleProfileSave = async () => {
    if (!profile?.id) return;
    setProfileMsg('');
    const full_name = `${profileForm.first_name} ${profileForm.last_name}`.trim();
    const { error } = await supabase
      .from('user_profiles')
      .update({
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
        full_name,
        phone: profileForm.phone,
      })
      .eq('id', profile.id);
    if (error) { setProfileMsg('Could not save: ' + error.message); return; }
    await refreshProfile?.();
    setProfileMsg('Profile saved.');
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    setAvatarUploading(true);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${profile.id}/avatar.${ext}`;
    const { error: upError } = await supabase.storage.from('user-avatars').upload(path, file, { upsert: true });
    if (upError) {
      setProfileMsg('Avatar upload failed. Storage may need the user-avatars bucket.');
      setAvatarUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('user-avatars').getPublicUrl(path);
    const avatar_url = `${urlData?.publicUrl}?v=${Date.now()}`;
    const { error } = await supabase.from('user_profiles').update({ avatar_url }).eq('id', profile.id);
    if (!error) await refreshProfile?.();
    setProfileMsg(error ? 'Avatar saved to storage but profile update failed.' : 'Profile picture updated.');
    setAvatarUploading(false);
  };

  // Private storage paths need a short-lived signed URL before the browser
  // can render them; legacy rows stored data URLs that render directly.
  useEffect(() => {
    setIdDocSignedUrl(null);
    const raw = selectedVerification?.id_document_url;
    const path = selectedVerification?.document_storage_path
      || (raw && !/^(https?:|data:|blob:)/.test(raw) ? raw : null);
    if (!path) return;
    supabase.storage.from('id-documents').createSignedUrl(path, 300)
      .then(({ data }) => { if (data?.signedUrl) setIdDocSignedUrl(data.signedUrl); })
      .catch(() => {});
  }, [selectedVerification?.id]);

  const closeReviewWith = (status, extra = {}) => {
    setIdVerifications(prev => prev.map(v =>
      v.id === selectedVerification.id
        ? { ...v, verification_status: status, reviewed_by: profile?.id, ...extra }
        : v
    ));
    if (status === 'approved') {
      setPendingUsers(prev => prev.filter(u => u?.id !== selectedVerification.user_id));
    }
    setIsReviewModalOpen(false);
    setSelectedVerification(null);
    setReviewRemark('');
  };

  const handleApproveVerification = async () => {
    if (!selectedVerification) return;

    const { error, unsupported } = await callReviewVerification(
      selectedVerification.id, 'approved', 'Approved by administrator');
    if (error) { console.error('Review approve failed:', error); return; }

    if (unsupported) {
      const { error: e1 } = await supabase
        .from('id_verifications')
        .update({ verification_status: 'approved', reviewed_by: profile?.id, review_notes: 'Approved by administrator' })
        .eq('id', selectedVerification.id);
      if (e1) { console.error('Review approve failed:', e1); return; }
      const { error: e2 } = await supabase
        .from('user_profiles')
        .update({ status: 'active', account_status: 'active' })
        .eq('id', selectedVerification.user_id);
      if (e2) console.error('Account activation failed:', e2);
    }
    notifyDecision(selectedVerification.id);
    closeReviewWith('approved');
  };

  const handleRejectVerification = async (reason) => {
    if (!selectedVerification) return;

    const { error, unsupported } = await callReviewVerification(
      selectedVerification.id, 'rejected', reason);
    if (error) { console.error('Review reject failed:', error); return; }

    if (unsupported) {
      const { error: e1 } = await supabase
        .from('id_verifications')
        .update({ verification_status: 'rejected', reviewed_by: profile?.id, review_notes: reason })
        .eq('id', selectedVerification.id);
      if (e1) { console.error('Review reject failed:', e1); return; }
    }
    notifyDecision(selectedVerification.id);
    closeReviewWith('rejected', { review_notes: reason });
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordErrors({});
    setPasswordSuccess('');
    setIsSubmitting(true);

    const errors = {};
    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    if (!passwordForm.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters';
    }
    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password';
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      setIsSubmitting(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) {
        setPasswordErrors({ currentPassword: error.message || 'Failed to change password. Please try again.' });
      } else {
        setPasswordSuccess('Password changed successfully!');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setPasswordSuccess(''), 3000);
      }
    } catch (error) {
      setPasswordErrors({ currentPassword: 'Failed to change password. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestClarity = async (remark) => {
    if (!selectedVerification) return;
    const reason = remark?.trim() || 'Please upload a clearer image of your ID document';

    const { error, unsupported } = await callReviewVerification(
      selectedVerification.id, 'needs_clarity', reason);
    if (error) { console.error('Request-clarity failed:', error); return; }

    if (unsupported) {
      const { error: e1 } = await supabase
        .from('id_verifications')
        .update({ verification_status: 'needs_clarity', reviewed_by: profile?.id, review_notes: reason })
        .eq('id', selectedVerification.id);
      if (e1) { console.error('Request-clarity failed:', e1); return; }
    }
    closeReviewWith('needs_clarity');
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
        
        // Geofence applies to residents only — staff file reports without boundary checks
        const isResident = profile?.role === 'resident';
        let serviceAreaStatus = 'staff';
        let inServiceArea = null;
        if (isResident) {
          // Check against the active Supabase boundary (hook state);
          // 'manual' when no boundary is configured or still loading
          inServiceArea = isPointInBoundary({ latitude, longitude }, boundaryPoints);
          serviceAreaStatus = inServiceArea == null ? 'manual' : inServiceArea ? 'inside' : 'outside';
        }

        setDraft(value => ({
          ...value,
          location: value.location || `GPS: ${latitude}, ${longitude}`,
          latitude,
          longitude,
          serviceAreaStatus
        }));
        setGpsStatus(!isResident
          ? `Current GPS location captured (+/-${Math.round(coords.accuracy)} m). You can still edit the location.`
          : inServiceArea
            ? `Current GPS location captured (+/-${Math.round(coords.accuracy)} m). You can still edit the location.`
            : 'GPS location is outside the Barangay Kalubihan service area. Your emergency report will still be sent to dispatch for triage.');
      },
      () => {
        if (isCurrent) setGpsStatus('GPS permission was not granted. Enter a location manually.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );

    return () => { isCurrent = false; };
  // boundaryPoints arrives async — re-fire so serviceAreaStatus computes
  // against the loaded polygon instead of staying 'manual'.
  }, [section, profile?.role, boundaryPoints]);

  const submitIncident = async event => {
    event.preventDefault();
    if (!canReport) {
      setSubmitError('Your account is pending verification — reporting unlocks once an administrator approves your ID.');
      return;
    }
    if (!draft.location.trim() || !draft.description.trim()) return;
    if (!profile?.id) {
      setSubmitError('Profile is still loading. Try again in a moment.');
      return;
    }
    setSubmitError('');

    // Same-type open incident within ~150 m? Warn first instead of
    // silently duplicating — a responder may already be on the way.
    // Skip when we have no coords (manual text-only location).
    if (draft.latitude != null && draft.longitude != null) {
      const { data: matches, error: checkErr } = await supabase
        .rpc('check_duplicate_incidents', {
          p_lat: draft.latitude, p_lng: draft.longitude, p_report_type: draft.type,
        });
      if (!checkErr && matches?.length) {
        setDupMatches(matches);
        return;
      }
    }
    await insertReport();
  };

  const insertReport = async () => {
    setLoading(true);

    // Convert image files to base64 for storage
    const imagePromises = imageFiles.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });
    
    const imageDataUrls = await Promise.all(imagePromises);
    
    // Insert into Supabase - match actual database schema (new schema with status/priority columns)
    const { data, error } = await supabase.from('emergency_reports').insert({
      reporter_id: profile?.id,
      report_type: draft.type,
      content: draft.description,
      status: 'pending',
      priority: draft.priority || 'low',
      attachments: {
        latitude: draft.latitude,
        longitude: draft.longitude,
        location: draft.location,
        contact_name: profile?.full_name || 'Command user',
        contact_phone: profile?.phone,
        service_area_status: draft.serviceAreaStatus,
        images: imageDataUrls
      }
    }).select().single();

    setLoading(false);
    if (error || !data) {
      setSubmitError(error?.message || 'Could not submit the report. Try again.');
      return;
    }
    {
      setSubmittedReportId(data.id);
      setSubmitted(true);
      try { localStorage.removeItem(draftKey); } catch {}
      setDraft({ type: 'fire', priority: 'high', location: '', description: '', latitude: null, longitude: null, serviceAreaStatus: 'manual' });
      setImageFiles([]);
      
      // Refresh reports list to show the new incident
      const { data: refreshedReports } = await supabase
        .from('emergency_reports_list')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (refreshedReports) {
        setReports(refreshedReports);
      }
    }
  };
  const ocrName = normText(selectedVerification?.ocr_data?.extracted_name);
  const ocrDob = normText(selectedVerification?.ocr_data?.extracted_dob ?? selectedVerification?.ocr_data?.extracted_birthdate);
  const ocrNameMatch = selectedVerification?.ocr_data?.name_match
    ?? (!!ocrName && ocrName === normText(selectedVerification?.user_profiles?.full_name));
  const ocrDobMatch = selectedVerification?.ocr_data?.dob_match
    ?? (!!ocrDob && compareBirthdates(selectedVerification?.user_profiles?.birthdate, ocrDob).status === 'match');
  // Mirrors report_gate.sql's caller_can_report(): staff always may; a
  // resident must be verified (account_status='active'). The form renders
  // disabled with a lock notice so nothing is clickable while pending.
  const canReport = ['admin','dispatcher','responder'].includes(profile?.role) || profile?.account_status === 'active';
  // Live responder position on the open incident — staff-readable per RLS,
  // and only meaningful while the incident is non-terminal.
  const detailResponderLoc = useResponderLocation(
    isReportDetailModalOpen && !['resolved', 'declined'].includes(selectedReport?.status) ? selectedReport?.assigned_to : null
  );

  // --- Manual arrival fallback (Spec 001 FR-017) --------------------------
  // Staff mark arrival when the responder's GPS can't; audited via
  // meta.method='manual'. The RPC re-checks role + state server-side.
  const [manualArriving, setManualArriving] = useState(false);
  const [manualArriveMsg, setManualArriveMsg] = useState('');
  const { rows: selHistory } = useIncidentHistory(
    isReportDetailModalOpen ? selectedReport?.id : null
  );
  const hasArrived = selHistory.some(r => r.to_status === 'arrived');

  const markManualArrived = async () => {
    if (manualArriving || !selectedReport) return;
    setManualArriving(true);
    setManualArriveMsg('');
    const { data, error } = await supabase.rpc('mark_incident_arrived_manual', { p_report_id: selectedReport.id });
    setManualArriving(false);
    const code = data?.error || error?.code;
    if (error || !data?.ok) {
      setManualArriveMsg(
        code === 'unauthorized' ? 'Only dispatchers/admins can mark arrival.'
        : code === 'invalid_state' ? 'Incident is not in-progress.'
        : 'Could not record arrival — try again.');
      return;
    }
    setManualArriveMsg(data?.already ? 'Arrival already recorded.' : 'Arrival recorded — visible to the reporter.');
  };
  // Private storage paths resolve to short-lived signed URLs; legacy rows
  // hold data URLs that render directly.
  const idDocRaw = selectedVerification?.id_document_url;
  const idDocIsDirect = typeof idDocRaw === 'string' && /^(https?:|data:|blob:)/.test(idDocRaw);
  const idDocUrl = idDocIsDirect ? idDocRaw : idDocSignedUrl;

  return <div className="min-h-screen bg-slate-50 text-slate-900"><div className="flex min-h-screen">
    <AppSidebar links={links.map(l => ({ ...l, badge: l.key === 'queue' ? pendingCount : l.key === 'residents' ? registrantViews.forApproval.length : undefined }))} profile={profile} signOut={signOut} />
    <main className="min-w-0 flex-1 pb-24 sm:pb-0"><header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/70 bg-white px-5  sm:px-8"><div><p className="text-xs font-medium  text-slate-400">Kalubihan emergency command</p><h1 className="text-lg font-bold">{current.title}</h1></div><div className="flex items-center gap-3"><NotificationBell userId={profile?.id} onOpenIncident={(id) => { const report = reports.find(r => r.id === id); if (report) handleReportClick(report); }}/></div></header><div className="mx-auto max-w-[1400px] p-5 sm:p-8"><p className="text-xs font-bold  text-taste-600">{current.eyebrow}</p><h2 className="mt-1 text-3xl font-bold tracking-tight">{current.title}</h2><p className="mt-2 text-sm text-slate-500">{current.description}</p>
      {section === 'queue' && <>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">{['all','pending','assigned','in-progress','resolved'].map(item => <button key={item} onClick={() => setStatus(item)} className={`min-h-11 rounded-lg px-4 py-2.5 text-sm font-medium capitalize ${status === item ? 'bg-taste-500 text-white' : 'border border-slate-200/70 bg-white text-slate-600'}`}>{item === 'in-progress' ? 'in progress' : item}</button>)}</div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search incidents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 rounded-lg border border-slate-200 px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-taste-500"
              />
              <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <button onClick={() => navigate('/emergency-report')} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white  transition hover:brightness-110"><Icon name="Plus" size={16} className="mr-1 inline"/>New incident</button>
          </div>
        </div>
        {cdaRequests.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase text-amber-700">Assistance requests ({cdaRequests.length})</p>
            <ul className="mt-2 space-y-1.5">
              {cdaRequests.map(row => {
                const rep = reports.find(r => r.id === row.report_id);
                return (
                  <li key={row.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
                    <span className="font-mono text-xs text-slate-500">{rep?.report_id || '—'}</span>
                    <span className="font-semibold capitalize">{rep?.report_type || rep?.incident_type || 'Incident'}</span>
                    <span>→ {row.department?.name || 'department'}</span>
                    {row.notes === 'auto-dispatch'
                      ? <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">auto-dispatch</span>
                      : <span className="text-xs text-slate-500">requested by {row.requester?.full_name || 'staff'}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${row.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : row.status === 'declined' ? 'bg-red-100 text-red-700' : 'bg-amber-200 text-amber-800'}`}>{row.status}</span>
                    {profile?.role === 'department_admin' && row.assisting_department_id === profile?.department_id && row.status !== 'declined' && (
                      <select
                        value={row.responder_id || ''}
                        onClick={e => e.stopPropagation()}
                        onChange={e => e.target.value && e.target.value !== row.responder_id && handleCdaResponderAssign(row.id, e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs"
                      >
                        <option value="">Assign responder…</option>
                        {responders.map(r => <option key={r.id} value={r.id}>{r.full_name || r.email}</option>)}
                      </select>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {reassignRequests.length > 0 && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase text-blue-700">Reassignment requests ({reassignRequests.filter(r => r.status === 'pending').length})</p>
            <ul className="mt-2 space-y-1.5">
              {reassignRequests.map(row => {
                const rep = reports.find(r => r.id === row.report_id);
                return (
                  <li key={row.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
                    <span className="font-mono text-xs text-slate-500">{rep?.report_id || '—'}</span>
                    <span className="font-semibold capitalize">{rep?.report_type || rep?.incident_type || 'Incident'}</span>
                    <span>← {row.department?.name || 'department'}</span>
                    <span className="text-xs text-slate-500">by {row.requester?.full_name || 'staff'}</span>
                    <span className="max-w-[260px] truncate text-xs italic text-slate-600" title={row.reason}>"{row.reason}"</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${row.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : row.status === 'denied' ? 'bg-red-100 text-red-700' : row.status === 'cancelled' ? 'bg-slate-200 text-slate-600' : 'bg-blue-200 text-blue-800'}`}>{row.status}</span>
                    {profile?.role === 'dispatcher' && row.status === 'pending' && (
                      <span className="flex gap-1">
                        <button onClick={() => rep && handleAssignClick(rep)} className="rounded-lg border border-blue-300 bg-white px-2 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">Reassign</button>
                        <button onClick={() => handleReassignRequestReview(row, 'denied')} className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">Dismiss</button>
                      </span>
                    )}
                    {profile?.role === 'department_admin' && row.requested_by === profile?.id && row.status === 'pending' && (
                      <button onClick={() => handleReassignRequestReview(row, 'cancelled')} className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">Withdraw</button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {profile?.role === 'department_admin' && !profile?.department_id && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <Icon name="AlertTriangle" size={18} className="mt-0.5 shrink-0 text-red-700"/>
            <p className="text-sm text-red-800"><span className="font-semibold">No department linked to your account.</span> Ask an administrator to assign you to a department — until then you can't assign responders.</p>
          </div>
        )}
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200/70 bg-white">
          <div className="grid min-w-[640px] grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(110px,.7fr)_minmax(170px,.8fr)] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold  text-slate-400"><span>Incident</span><span>Location</span><span>Priority</span><span>Status / action</span></div>
          {visibleReports.map(report => <div key={report.id || report.report_id} onClick={() => handleReportClick(report)} className="grid min-w-[640px] grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(110px,.7fr)_minmax(170px,.8fr)] items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0 cursor-pointer hover:bg-slate-50 transition">
            <div className="min-w-0"><p className="font-semibold capitalize">{report.report_type || report.incident_type} <span className="font-mono text-xs text-slate-400">{report.report_id || report.id?.slice(0, 8)}</span></p><p className="mt-1 truncate text-xs text-slate-500">{report.content || report.description}</p>{staleAssignedMinutes(report) != null && (<p className="mt-1 flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700"><Icon name="ClockAlert" size={11}/> No response {staleAssignedMinutes(report)}m</p>)}</div>
            <p className="truncate text-sm text-slate-600">{report.attachments?.location || report.location}</p>
            <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-bold uppercase ${priorityStyles[report.priority]}`}>{report.priority}</span>
            <div className="flex min-w-0 items-center gap-2">
              <span className={`inline-flex h-8 min-w-[84px] items-center justify-center rounded-full px-2 text-xs font-medium capitalize ${statusStyles[report.status] || 'bg-slate-100 text-slate-700'}`}>{formatStatus(report.status)}</span>
              {(profile?.role === 'dispatcher' || profile?.role === 'admin') && (report.status) !== 'resolved' && <div className="flex gap-1">{(report.status) === 'pending' && <button onClick={(e) => { e.stopPropagation(); handleAssignClick(report); }} className="inline-flex h-8 min-w-[72px] items-center justify-center rounded-lg border border-taste-200 bg-taste-50 px-3 text-xs font-bold text-taste-600 transition hover:border-taste-300 hover:bg-taste-100 focus:outline-none focus:ring-2 focus:ring-taste-500 focus:ring-offset-2">Assign</button>}{['assigned','in-progress'].includes(report.status) && <button onClick={(e) => { e.stopPropagation(); handleAssignClick(report); }} className="inline-flex h-8 min-w-[72px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100">Reassign</button>}<button onClick={(e) => { e.stopPropagation(); setReportStatus(report.report_id || report.id, 'resolved'); }} className="inline-flex h-8 min-w-[72px] items-center justify-center rounded-lg border border-taste-200 bg-taste-50 px-3 text-xs font-bold text-taste-600 transition hover:border-taste-300 hover:bg-taste-100">Resolve</button></div>}
              {profile?.role === 'department_admin' && report.assigned_department_id === profile?.department_id && report.status !== 'resolved' && (
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); handleAssignClick(report); }} className="inline-flex h-8 items-center justify-center rounded-lg border border-taste-200 bg-taste-50 px-3 text-xs font-bold text-taste-600 transition hover:border-taste-300 hover:bg-taste-100">{report.assigned_to ? 'Reassign responder' : 'Assign responder'}</button>
                  {!reassignRequests.some(r => r.report_id === report.id && r.status === 'pending') && (
                    <button onClick={(e) => { e.stopPropagation(); setSelectedReport(report); setReassignReason(''); setReassignRequestError(''); setIsReassignRequestOpen(true); }} className="inline-flex h-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100">Request reassign</button>
                  )}
                </div>
              )}
            </div>
          </div>)}
        </div>
      </>}
      {section === 'new' && <>{!canReport && <div className="mt-7 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"><Icon name="Lock" size={18} className="mt-0.5 shrink-0 text-amber-700"/><div className="text-sm text-amber-800"><p className="font-semibold">Reporting is locked while your registration is pending.</p><p className="mt-0.5 text-amber-700">Once an administrator approves your ID, this form unlocks and your reports go straight to dispatch. Check your verification status from Home.</p></div></div>}<form onSubmit={submitIncident} className="mt-7 grid gap-5 lg:grid-cols-[1.4fr_.6fr]"><fieldset disabled={!canReport} className="contents"><div className="rounded-lg border border-slate-200/70 bg-white p-6 "><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Emergency type<select value={draft.type} onChange={e => setDraft(value => ({...value, type: e.target.value}))} className="mt-2 w-full rounded-xl border-slate-200/70 bg-white text-sm"><option value="fire">Fire</option><option value="medical">Medical</option><option value="accident">Accident</option><option value="police">Public safety</option><option value="natural">Natural hazard</option></select></label><label className="text-sm font-semibold">Priority<select value={draft.priority} onChange={e => setDraft(value => ({...value, priority: e.target.value}))} className="mt-2 w-full rounded-xl border-slate-200/70 bg-white text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label></div><label className="mt-5 block text-sm font-semibold">Incident location<input required value={draft.location} onChange={e => setDraft(value => ({...value, location: e.target.value}))} placeholder="Address, landmark, or selected map pin" className="mt-2 w-full rounded-xl border-slate-200 px-3 py-3 text-sm"/></label><div className="mt-3 flex items-center gap-2 rounded-xl bg-taste-50 p-3 text-xs text-taste-600"><Icon name="MapPin" size={15}/>GPS and map provider are optional. A manual location is always accepted; outside-boundary reports go to dispatch for triage.</div>{gpsStatus && <div className={`mt-2 rounded-xl p-3 text-xs ${gpsStatus.includes('outside') ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{gpsStatus}</div>}<label className="mt-5 block text-sm font-semibold">What is happening?<textarea required value={draft.description} onChange={e => setDraft(value => ({...value, description: e.target.value}))} placeholder="Describe hazards, people involved, and immediate risks." rows="6" className="mt-2 w-full rounded-xl border-slate-200 px-3 py-3 text-sm"/></label>
        <div className="mt-5">
          <label className="block text-sm font-semibold mb-2">Upload evidence {profile?.role === 'resident' ? '(required — at least 1 photo)' : '(optional)'}</label>
          <input 
            type="file" 
            multiple 
            accept="image/*"
            onChange={handleImageUpload}
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
          />
          {imageFiles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {imageFiles.map((file, index) => (
                <div key={index} className="relative">
                  <img src={URL.createObjectURL(file)} alt={file.name} className="h-20 w-20 rounded-lg object-cover border border-slate-200"/>
                  <button 
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-2 -right-2 rounded-full bg-red-600 p-1 text-white hover:bg-red-600"
                  >
                    <Icon name="X" size={12}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div><div className="space-y-5"><div className="rounded-lg border border-slate-200/70 bg-white p-6"><h3 className="font-bold">Report summary</h3><p className="mt-3 text-sm text-slate-600">Your report will be immediately visible to dispatch. Verification happens in parallel, so even unverified reports are triaged for response.</p></div>{submitError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{submitError}</div>}<button type="submit" disabled={loading || submitted || !profile?.id || !canReport} className="w-full rounded-xl bg-red-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Submitting...' : submitted ? 'Report submitted' : !canReport ? 'Verification required to report' : 'Submit report'}</button>{submitted && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center"><Icon name="CheckCircle" size={32} className="text-emerald-600 mx-auto mb-2"/><h3 className="font-semibold text-emerald-900">Report submitted</h3><p className="mt-1 text-sm text-emerald-700">Report ID: {submittedReportId?.slice(0, 8)}<br/>Dispatch is reviewing your report now.</p></div>}</div></fieldset></form></>}
      {section === 'residents' && <>
        <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Registration status">
          {[
            { key: 'forApproval', label: 'For Approval' },
            { key: 'returned', label: 'Returned' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
          ].map(t => (
            <button key={t.key} role="tab" aria-selected={registrantTab === t.key}
              onClick={() => setRegistrantTab(t.key)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${registrantTab === t.key ? 'border-taste-500 bg-taste-50 text-taste-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
              {t.label}
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${registrantTab === t.key ? 'bg-taste-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{registrantViews[t.key].length}</span>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200/70 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h3 className="font-bold">{{ forApproval: 'Registrations awaiting review', returned: 'Returned for clarification', approved: 'Approved registrations', rejected: 'Rejected registrations' }[registrantTab]}</h3>
            <p className="text-sm text-slate-500">{{ forApproval: 'Open a registration to review the ID and decide inside the modal.', returned: 'Waiting on the applicant to re-upload — resubmissions land back in For Approval automatically.', approved: 'Final approvals — read-only record.', rejected: 'Final rejections — archived record.' }[registrantTab]}</p>
          </div>
          {registrantViews[registrantTab].length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">{{ forApproval: 'No registrations for approval.', returned: 'Nothing returned for clarification.', approved: 'No approved registrations yet.', rejected: 'No rejected registrations.' }[registrantTab]}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {registrantViews[registrantTab].map(entry => {
                const v = entry.kind === 'verification' ? entry.verification : null;
                const u = entry.kind === 'pending' ? entry.user : null;
                const status = v ? v.verification_status : 'pending';
                const archived = status === 'rejected';
                return (
                  <button key={v ? v.id : u.id} type="button"
                    onClick={() => v ? handleReviewClick(v) : handleReviewPendingUser(u)}
                    className={`flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50 ${archived ? 'opacity-70' : ''}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{v ? (v.user_profiles?.full_name || 'Unknown') : (u?.full_name || u?.name || u?.email)}</p>
                        {v?.submission_revision > 1 && status === 'pending' && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Resubmitted</span>
                        )}
                        {archived && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">Archived</span>}
                      </div>
                      <p className="text-xs text-slate-500">{v ? v.user_profiles?.email : u?.email}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {status === 'approved' || status === 'rejected'
                          ? `Decided ${v?.decision_at ? new Date(v.decision_at).toLocaleDateString() : '—'}${(v?.decision_reason || v?.review_notes) ? ` — ${v.decision_reason || v.review_notes}` : ''}`
                          : `Submitted ${new Date(v ? v.created_at : u?.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <span className={`ml-3 shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${status === 'pending' || status === 'under_review' ? 'bg-amber-100 text-amber-700' : status === 'approved' ? 'bg-emerald-100 text-emerald-700' : status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{status === 'needs_clarity' || status === 'correction_required' ? 'returned' : status.replace('_', ' ')}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200/70 bg-white p-6">
            <h3 className="font-bold">Account access</h3>
            <p className="mt-1 text-sm text-slate-500">Department access cannot be self-granted.</p>
            <div className="mt-5 text-sm text-slate-500">Manage departments via the Department Management page.</div>
          </div>
          <div className="rounded-lg border border-slate-200/70 bg-white p-6">
            <div><h3 className="font-bold">Community verification</h3><p className="text-sm text-slate-500">Duplicate prevention enabled</p></div>
            <p className="mt-5 text-sm leading-6 text-slate-500">System automatically detects duplicate reports from the same location within a 5-minute window. Admins can merge or dismiss duplicates manually.</p>
            <button className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">View duplicates</button>
          </div>
        </div>
      </>}
      {section === 'departments' && <DepartmentManagementSection />}
      {section === 'reports' && <Suspense fallback={<div className="mt-7 h-40 animate-pulse rounded-lg border border-slate-200/70 bg-white" />}><ReportsSection /></Suspense>}
      {section === 'access' && <div className="mt-7 max-w-4xl space-y-5"><UserAccessManager /><PageAccessMatrix /></div>}
      {section === 'profile' && <div className="mt-7 max-w-3xl"><div className="mb-6 border-b border-slate-200"><nav className="-mb-px flex space-x-8" aria-label="Tabs"><button onClick={() => setProfileTab('info')} className={`py-2 px-1 border-b-2 font-medium text-sm transition ${profileTab === 'info' ? 'border-taste-500 text-taste-500' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-taste-500'}`}>Profile Information</button><button onClick={() => setProfileTab('security')} className={`py-2 px-1 border-b-2 font-medium text-sm transition ${profileTab === 'security' ? 'border-taste-500 text-taste-500' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-taste-500'}`}>Security</button></nav></div>{profileTab === 'info' && <div className="rounded-lg border border-slate-200/70 bg-white p-6 "><div className="flex items-center gap-4">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover"/> : <div className="grid h-14 w-14 place-items-center rounded-full bg-taste-500 text-lg font-bold text-white">{profile?.first_name?.[0] || 'U'}</div>}<div><h3 className="text-lg font-bold">{profile?.full_name || 'User'}</h3><p className="text-sm capitalize text-slate-500">{profile?.role || 'user'} account</p><label className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-taste-500 hover:underline"><Icon name="Camera" size={13}/>{avatarUploading ? 'Uploading…' : 'Change picture'}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading}/></label></div></div><div className="mt-7 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2"><div><label className="text-xs font-bold  text-slate-400">First name</label><input value={profileForm.first_name} onChange={e => setProfileForm({...profileForm, first_name: e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><div><label className="text-xs font-bold  text-slate-400">Last name</label><input value={profileForm.last_name} onChange={e => setProfileForm({...profileForm, last_name: e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><div><label className="text-xs font-bold  text-slate-400">Phone number</label><input value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><div><p className="text-xs font-bold  text-slate-400">Email</p><p className="mt-2.5 text-sm">{profile?.email}</p></div><div><p className="text-xs font-bold  text-slate-400">Account status</p><p className="mt-2.5 text-sm capitalize">{(profile?.account_status || 'active')}{profile?.status === 'active' ? ' · on duty' : ''}</p></div></div>{profileMsg && <p className="mt-3 text-sm text-taste-600">{profileMsg}</p>}<button onClick={handleProfileSave} className="mt-4 rounded-lg bg-taste-500 px-4 py-2 text-sm font-semibold text-white hover:bg-taste-600">Save profile</button><div className="mt-7 border-t border-slate-100 pt-5"><div className="flex items-center justify-between mb-4"><h4 className="font-bold">Emergency Contacts</h4><button onClick={() => setIsContactModalOpen(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Add Contact</button></div>{contactError && !isContactModalOpen && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{contactError}</div>}{emergencyContacts.length === 0 ? <p className="text-sm text-slate-500">No emergency contacts added.</p> : <div className="space-y-3">{emergencyContacts.map(contact => <div key={contact.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><div><p className="font-medium text-sm">{contact.name} {contact.is_primary && <span className="ml-2 rounded-full bg-taste-100 px-2 py-0.5 text-xs text-taste-600">Primary</span>}</p><p className="text-xs text-slate-500">{contact.relationship} · {contact.phone_number}</p></div><button onClick={() => handleDeleteContact(contact.id)} className="text-slate-400 hover:text-red-600"><Icon name="Trash2" size={16}/></button></div>)}</div>}</div></div>}{profileTab === 'security' && <div className="rounded-lg border border-slate-200/70 bg-white p-6 "><div className="mb-6"><h3 className="font-bold">Change password</h3><p className="text-sm text-slate-500">Update your account password</p></div>{passwordSuccess && <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{passwordSuccess}</div>}{Object.keys(passwordErrors).length > 0 && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{Object.values(passwordErrors).join('. ')}</div>}<form onSubmit={handlePasswordChange} className="space-y-4"><div><label className="block text-sm font-medium mb-2">Current Password</label><input type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><div><label className="block text-sm font-medium mb-2">New Password</label><input type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><div><label className="block text-sm font-medium mb-2">Confirm New Password</label><input type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><div className="flex gap-2"><button type="submit" disabled={isSubmitting} className="rounded-lg bg-taste-500 px-4 py-2 text-sm font-semibold text-white hover:bg-taste-600 disabled:opacity-50">Change Password</button><button type="button" onClick={() => {setPasswordForm({currentPassword: '', newPassword: '', confirmPassword: ''}); setPasswordErrors({}); setPasswordSuccess('');}} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button></div></form></div>}</div>}
      
      {/* Emergency Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Add Emergency Contact</h3>
              <button onClick={() => setIsContactModalOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {contactError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {contactError}
                </div>
              )}
              <div>
                <label htmlFor="contact-name" className="block text-sm font-semibold mb-2">Name</label>
                <input 
                  id="contact-name"
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Contact name"
                />
              </div>
              <div>
                <label htmlFor="contact-relationship" className="block text-sm font-semibold mb-2">Relationship</label>
                <input 
                  id="contact-relationship"
                  type="text"
                  value={newContact.relationship}
                  onChange={(e) => setNewContact({...newContact, relationship: e.target.value})}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g., Spouse, Parent, Friend"
                />
              </div>
              <div>
                <label htmlFor="contact-phone" className="block text-sm font-semibold mb-2">Phone Number</label>
                <input 
                  id="contact-phone"
                  type="text"
                  value={newContact.phone_number}
                  onChange={(e) => setNewContact({...newContact, phone_number: e.target.value})}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Phone number"
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="isPrimary"
                  checked={newContact.is_primary}
                  onChange={(e) => setNewContact({...newContact, is_primary: e.target.checked})}
                  className="rounded border-slate-200"
                />
                <label htmlFor="isPrimary" className="text-sm">Set as primary contact</label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button 
                  onClick={() => setIsContactModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddContact}
                  disabled={!profile?.id}
                  className="rounded-lg bg-taste-500 px-4 py-2 text-sm font-semibold text-white hover:bg-taste-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      

      {/* Boundary Configuration Modal */}
      {isBoundaryModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Configure Service Boundary</h3>
              <button onClick={() => setIsBoundaryModalOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-4">Click on the map to add boundary points. The polygon defines your service area for automatic incident routing.</p>
              <div className="h-80 rounded-lg border border-slate-200 overflow-hidden mb-4">
                <MapContainer center={[10.3172, 123.8951]} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <BoundaryEditor 
                    boundaryPoints={boundaryPoints}
                    setBoundaryPoints={setBoundaryPoints}
                  />
                  <FitToBoundary positions={boundaryPoints.length > 2 ? boundaryPoints.map(p => [p.lat, p.lng]) : []} />
                  {boundaryPoints.length > 2 && (
                    <Polygon
                      positions={boundaryPoints.map(p => [p.lat, p.lng])}
                      color="#1b6c80"
                      fillColor="#1b6c80"
                      fillOpacity={0.2}
                    />
                  )}
                  {boundaryPoints.map((point, index) => (
                    <Marker
                      key={index}
                      position={[point.lat, point.lng]}
                      eventHandlers={{
                        click: (e) => {
                          e.originalEvent.stopPropagation();
                          setBoundaryPoints(boundaryPoints.filter((_, i) => i !== index));
                        }
                      }}
                    />
                  ))}
                </MapContainer>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">{boundaryPoints.length} points added (click a marker to remove it)</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setBoundaryPoints([])}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={handleSaveBoundary}
                    disabled={boundaryPoints.length < 3}
                    className="px-4 py-2 text-sm font-semibold bg-taste-500 text-white rounded-lg hover:bg-taste-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Boundary
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ID Verification Review Modal */}
      {isReviewModalOpen && selectedVerification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-4xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Review ID Verification</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-4">
                  <p className="text-xs font-bold  text-slate-400">Declared at registration</p>
                  <dl className="mt-3 space-y-2.5 text-sm">
                    <div className="flex gap-3"><dt className="w-24 shrink-0 text-slate-500">Name</dt><dd className="min-w-0 font-medium">{selectedVerification.user_profiles?.full_name || '—'}</dd></div>
                    <div className="flex gap-3"><dt className="w-24 shrink-0 text-slate-500">Email</dt><dd className="min-w-0 truncate">{selectedVerification.user_profiles?.email || '—'}</dd></div>
                    <div className="flex gap-3"><dt className="w-24 shrink-0 text-slate-500">Phone</dt><dd className="min-w-0">{selectedVerification.user_profiles?.phone || '—'}</dd></div>
                    <div className="flex gap-3"><dt className="w-24 shrink-0 text-slate-500">Address</dt><dd className="min-w-0">{selectedVerification.user_profiles?.address || '—'}</dd></div>
                    <div className="flex gap-3 items-center"><dt className="w-24 shrink-0 text-slate-500">Residency</dt><dd className="min-w-0"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${selectedVerification.user_profiles?.residency_type === 'boarder' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}><Icon name={selectedVerification.user_profiles?.residency_type === 'boarder' ? 'BedDouble' : 'Home'} size={11}/>{selectedVerification.user_profiles?.residency_type === 'boarder' ? 'Boarder' : 'Resident'}</span></dd></div>
                    <div className="flex gap-3"><dt className="w-24 shrink-0 text-slate-500">Birthdate</dt><dd className="min-w-0">{selectedVerification.user_profiles?.birthdate || '—'}</dd></div>
                  </dl>
                </div>
                <div className="rounded-xl border border-taste-100 bg-taste-50/60 p-4">
                  <p className="text-xs font-bold  text-taste-400">Read from ID (OCR)</p>
                  <div className="mt-3 space-y-2.5 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><span className="text-slate-500">Name</span><p className="truncate font-medium">{selectedVerification.ocr_data?.extracted_name || 'Not extracted'}</p></div>
                      {selectedVerification.ocr_data?.extracted_name && (ocrNameMatch
                        ? <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Match</span>
                        : <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Review</span>)}
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><span className="text-slate-500">Birthdate</span><p className="font-medium">{selectedVerification.ocr_data?.extracted_dob ?? selectedVerification.ocr_data?.extracted_birthdate ?? 'Not extracted'}</p></div>
                      {(selectedVerification.ocr_data?.extracted_dob ?? selectedVerification.ocr_data?.extracted_birthdate) && (ocrDobMatch
                        ? <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Match</span>
                        : <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Review</span>)}
                    </div>
                    <div className="flex items-start justify-between gap-3 border-t border-taste-100 pt-2.5">
                      <div><span className="text-slate-500">Status</span><p className="font-medium capitalize">{selectedVerification.verification_status}</p></div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedVerification.submission_revision > 1 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <Icon name="RotateCcw" size={16} className="mt-0.5 shrink-0 text-amber-600"/>
                  <div>
                    <p className="font-semibold">Resubmission — revision {selectedVerification.submission_revision}.</p>
                    {priorDecisionNote && <p className="mt-1">Previously requested: {priorDecisionNote}</p>}
                  </div>
                </div>
              )}
              {selectedVerification.user_profiles?.residency_type === 'boarder' && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 flex items-start gap-2">
                  <Icon name="BedDouble" size={16} className="mt-0.5 shrink-0 text-blue-600"/>
                  <p><span className="font-semibold">Boarder.</span> This applicant rents/rooms in Kalubihan — an ID address outside Kalubihan is expected. Verify that the declared boarding address above is genuine (e.g. barangay certification, lease, or landlord confirmation) instead of comparing it against the ID address.</p>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold  text-slate-400">ID Document</p>
                  {idDocUrl && <p className="text-xs text-taste-500">Click to enlarge</p>}
                </div>
                {idDocUrl ? (
                  <button type="button" onClick={() => { setSelectedImage(idDocUrl); setIsImageModalOpen(true); }} className="mt-2 block w-full cursor-pointer overflow-hidden rounded-lg border border-slate-200">
                    <img src={idDocUrl} alt="ID document" className="max-h-72 w-full bg-slate-50 object-contain" />
                  </button>
                ) : (
                  <div className="mt-2 rounded-lg bg-slate-100 p-8 text-center text-sm text-slate-500">
                    No ID document was uploaded for this registration.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400" htmlFor="reviewRemark">
                  Remark <span className="font-normal text-slate-400">— required for Reject / Request clarity; shown to the applicant and included in the email</span>
                </label>
                <textarea
                  id="reviewRemark"
                  rows={2}
                  value={reviewRemark}
                  onChange={(e) => setReviewRemark(e.target.value)}
                  placeholder="e.g. ID photo is too blurry — please re-upload in good lighting"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-taste-500"
                />
              </div>

              {['approved', 'rejected'].includes(selectedVerification.verification_status) ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-600">Decision recorded{selectedVerification.decision_at ? ` on ${new Date(selectedVerification.decision_at).toLocaleDateString()}` : ''} — terminal, read-only.</p>
                  <button onClick={() => setIsReviewModalOpen(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Done</button>
                </div>
              ) : (
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                {selectedVerification.id ? (
                  <>
                    <button
                      onClick={() => handleRequestClarity(reviewRemark)}
                      disabled={!reviewRemark.trim()}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Request Clarity
                    </button>
                    <button
                      onClick={() => handleRejectVerification(reviewRemark.trim())}
                      disabled={!reviewRemark.trim()}
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={handleApproveVerification}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Approve & Activate
                    </button>
                  </>
                ) : (
                  <>
                    {/* No id_verifications row exists — clarity/review RPCs need
                        one, so route to the registration-level handlers. */}
                    <button
                      onClick={async () => { await handlePendingReject(selectedVerification.user_id, reviewRemark.trim() || 'Registration rejected by administrator'); setIsReviewModalOpen(false); setSelectedVerification(null); setReviewRemark(''); }}
                      disabled={!reviewRemark.trim()}
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={async () => { await handlePendingApprove(selectedVerification.user_id); setIsReviewModalOpen(false); setSelectedVerification(null); }}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Approve & Activate
                    </button>
                  </>
                )}
              </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Assignment Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Assign Incident</h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Department</label>
                <select 
                  value={selectedDepartment || ''}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  disabled={profile?.role === 'department_admin'}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="">Select a department</option>
                  {departments
                    .filter(dept => profile?.role !== 'department_admin' || dept.id === profile?.department_id)
                    .map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              {profile?.role !== 'dispatcher' && (
              <div>
                <label className="block text-sm font-semibold mb-2">Responder</label>
                <select
                  value={selectedResponder || ''}
                  onChange={(e) => setSelectedResponder(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  disabled={!selectedDepartment}
                >
                  <option value="">Select a responder</option>
                  {responders
                    .filter(r => !selectedDepartment || r.department_id === selectedDepartment)
                    .map(responder => (
                      <option key={responder.id} value={responder.id}>{responder.full_name || responder.email}</option>
                    ))}
                </select>
              </div>
              )}
              {profile?.role === 'dispatcher' && (
                <p className="text-xs text-slate-500">The department's admin will pick which responder goes — including on any cross-department assists this triggers.</p>
              )}
              {assignError && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{assignError}</div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <button 
                  onClick={() => setIsAssignModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignmentSubmit}
                  disabled={!selectedDepartment || (profile?.role !== 'dispatcher' && !selectedResponder)}
                  className="rounded-lg bg-taste-500 px-4 py-2 text-sm font-semibold text-white hover:bg-taste-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {profile?.role === 'dispatcher' ? 'Assign department' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reassignment request — dept admin explains why dispatch picked the wrong dept */}
      {isReassignRequestOpen && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Request reassignment</h3>
              <button onClick={() => { setIsReassignRequestOpen(false); setSelectedReport(null); }} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-3">
                Only the dispatcher can move <span className="font-mono text-xs">{selectedReport.report_id || selectedReport.id?.slice(0,8)}</span> to another department — your request tells them why the current assignment is wrong.
              </p>
              <label className="block text-sm font-semibold mb-1.5">Reason <span className="text-red-500">*</span></label>
              <textarea
                id="reassignReason"
                value={reassignReason}
                onChange={e => { setReassignReason(e.target.value); setReassignRequestError(''); }}
                placeholder="e.g. This is a medical incident but it was dispatched to fire..."
                rows={4}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {reassignRequestError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{reassignRequestError}</div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => { setIsReassignRequestOpen(false); setSelectedReport(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
                <button onClick={handleReassignRequestSubmit} disabled={!reassignReason.trim()} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed">Send request</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate-incident warning — the same type of incident is already
          open nearby; the reporter confirms theirs is different */}
      {dupMatches && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">This incident may already be reported</h3>
              <button onClick={() => setDupMatches(null)} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600">
                An open <span className="capitalize font-semibold">{draft.type}</span> incident is already on record near your location — responders may already be on the way.
              </p>
              <ul className="mt-3 space-y-2">
                {dupMatches.map(m => (
                  <li key={m.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                    <span className="capitalize font-semibold text-amber-800">{m.report_type}</span>
                    {m.location ? <span className="text-amber-800"> · {m.location}</span> : null}
                    <span className="block text-xs text-amber-700 mt-0.5">
                      ~{Math.round(m.distance_m)} m away · reported {formatTimeAgo(m.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                If your incident is different, you can still submit it.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setDupMatches(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
                <button onClick={() => { setDupMatches(null); insertReport(); }} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Submit anyway</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {isReportDetailModalOpen && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
              <h3 className="font-bold text-lg">Incident Details</h3>
              <button onClick={() => setIsReportDetailModalOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold  text-slate-400">Incident ID</p>
                  <p className="font-mono text-sm">{selectedReport.report_id || selectedReport.id?.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold  text-slate-400">Type</p>
                  <p className="capitalize text-sm">{selectedReport.report_type || selectedReport.incident_type}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold  text-slate-400">Description</p>
                <p className="text-sm mt-1">{selectedReport.content || selectedReport.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-xs font-bold  text-slate-400">Location</p>
                  <p className="text-sm mb-2">{selectedReport.attachments?.location || selectedReport.location}</p>
                  {(selectedReport.attachments?.latitude && selectedReport.attachments?.longitude) || detailResponderLoc ? (
                    <div className="rounded-lg overflow-hidden border border-slate-200 h-48">
                      <BoundaryMap
                        marker={selectedReport.attachments?.latitude && selectedReport.attachments?.longitude
                          ? [selectedReport.attachments.latitude, selectedReport.attachments.longitude] : null}
                        markers={detailResponderLoc?.latitude
                          ? [{ position: [detailResponderLoc.latitude, detailResponderLoc.longitude], icon: RESPONDER_ICON }]
                          : []}
                      />
                    </div>
                  ) : null}
                  {detailResponderLoc && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <Icon name="Navigation" size={12} className="text-blue-600"/>
                      Responder location — updated {new Date(detailResponderLoc.updated_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold  text-slate-400">Priority</p>
                  <span className={`inline-block px-2 py-1 text-[10px] font-bold uppercase rounded-full ${priorityStyles[selectedReport.priority]}`}>{selectedReport.priority}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold  text-slate-400">Status</p>
                  <span className={`inline-block px-2 py-1 text-xs font-medium capitalize rounded-full ${statusStyles[selectedReport.status] || 'bg-slate-100 text-slate-700'}`}>{formatStatus(selectedReport.status)}</span>
                </div>
                <div>
                  <p className="text-xs font-bold  text-slate-400">Contact</p>
                  <p className="text-sm">{selectedReport.attachments?.contact_name || 'N/A'}</p>
                  <p className="text-xs text-slate-500">{selectedReport.attachments?.contact_phone || 'N/A'}</p>
                </div>
              </div>
              {selectedReport.attachments?.latitude && selectedReport.attachments?.longitude && (
                <div>
                  <p className="text-xs font-bold  text-slate-400">GPS Coordinates</p>
                  <p className="text-sm font-mono">{selectedReport.attachments.latitude}, {selectedReport.attachments.longitude}</p>
                </div>
              )}
              <ServiceAreaBadge report={selectedReport} />
              <IncidentTimeline report={selectedReport} />
              {selectedReport.attachments?.images && selectedReport.attachments.images.length > 0 && (
                <div>
                  <p className="text-xs font-bold  text-slate-400 mb-2">Evidence Images</p>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {selectedReport.attachments.images.map((image, index) => (
                      <img
                        key={index}
                        src={image.url || image}
                        alt={`Evidence ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 shrink-0"
                        onClick={() => {
                          setSelectedImage(image.url || image);
                          setIsImageModalOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {selectedReport.attachments?.resolution_proof && (
                <div>
                  <p className="text-xs font-bold  text-slate-400 mb-2">Resolution Proof</p>
                  <img
                    src={selectedReport.attachments.resolution_proof}
                    alt="Resolution proof"
                    className="h-32 w-48 rounded-lg border border-emerald-200 object-cover cursor-pointer hover:opacity-80"
                    onClick={() => {
                      setSelectedImage(selectedReport.attachments.resolution_proof);
                      setIsImageModalOpen(true);
                    }}
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button 
                  onClick={() => setIsReportDetailModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Close
                </button>
                {(profile?.role === 'dispatcher' || profile?.role === 'admin') && selectedReport.status === 'in-progress' && !hasArrived && (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={markManualArrived}
                      disabled={manualArriving}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {manualArriving ? 'Recording…' : 'Mark arrived'}
                    </button>
                    {manualArriveMsg && <p className="text-xs text-slate-500">{manualArriveMsg}</p>}
                  </div>
                )}
                {(profile?.role === 'dispatcher' || profile?.role === 'admin') && (selectedReport.status) !== 'resolved' && (
                  <button 
                    onClick={() => {
                      setIsReportDetailModalOpen(false);
                      if (selectedReport.status === 'pending') {
                        handleAssignClick(selectedReport);
                      } else {
                        setReportStatus(selectedReport.report_id || selectedReport.id, 'resolved');
                      }
                    }}
                    className="rounded-lg bg-taste-500 px-4 py-2 text-sm font-semibold text-white hover:bg-taste-600"
                  >
                    {(selectedReport.status) === 'pending' ? 'Assign' : 'Resolve'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Image Modal */}
      {isImageModalOpen && selectedImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-1060 p-4" onClick={() => setIsImageModalOpen(false)}>
          <div className="relative max-w-5xl max-h-[90vh]">
            <img
              src={selectedImage}
              alt="Full size evidence"
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="absolute top-4 right-4 rounded-full bg-white/20 hover:bg-white/30 p-2 text-white " aria-label="Close image"
            >
              <Icon name="X" size={24} />
            </button>
          </div>
        </div>
      )}
    </div></main></div></div>;

}

export default function Dashboard({ section = 'command' }) {
  const navigate = useNavigate();
  const { profile, signOut, canAccessPage } = useAuth();
  const { reports, setReports } = useMockData();
  const [pendingUsers] = usePendingRegistrations(profile);
  const [activeReport, setActiveReport] = useState(null);
  const [activeSection, setActiveSection] = useState(section);
  const [currentDate, setCurrentDate] = useState('');
  const [cdaRequests, setCdaRequests] = useState([]);
  const [reassignRequests, setReassignRequests] = useState([]);
  const [isBoundaryModalOpen, setIsBoundaryModalOpen] = useState(false);

  // Esc closes overlays (audit U-05).
  useEscapeKey(() => setIsBoundaryModalOpen(false), isBoundaryModalOpen);

  // Active service boundary: Supabase geofence_boundaries first,
  // legacy localStorage copy as the mock/offline fallback.
  const { points: boundaryPoints, setPoints: setBoundaryPoints, save: saveServiceBoundary } = useServiceBoundary();

  const handleSaveBoundary = async () => {
    const result = await saveServiceBoundary(boundaryPoints);
    if (!result.ok) {
      console.warn('Boundary saved locally; Supabase write failed:', result.error);
    }
    setIsBoundaryModalOpen(false);
  };

  // Set current date and greeting
  useEffect(() => {
    const now = new Date();
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    setCurrentDate(now.toLocaleDateString('en-US', dateOptions));
  }, []);

  // Fetch reports initially and set up real-time subscription
  useEffect(() => {
    const fetchReports = async () => {
      const { data, error } = await supabase
        .from('emergency_reports_list')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data && !error) {
        setReports(data);
      }
    };

    fetchReports();

    const channel = supabase.channel('dashboard_emergency_reports_changes');
    
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setReports(prev => prev.some(r => r.id === payload.new.id) ? prev : [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setReports(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
        } else if (payload.eventType === 'DELETE') {
          setReports(prev => prev.filter(r => r.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // Staff-side visibility for ALL assistance requests — including ones a
  // responder initiated from their incident modal. Refetches on any cda row
  // change so requests surface live.
  useEffect(() => {
    const fetchAssistance = async () => {
      const { data } = await supabase
        .from('cross_department_assistance')
        .select('*, requester:user_profiles!requested_by(full_name), department:departments!assisting_department_id(name), responder:user_profiles!responder_id(full_name)')
        .in('status', ['pending', 'accepted', 'declined'])
        .order('created_at', { ascending: false });
      setCdaRequests(data || []);
    };
    fetchAssistance();
    const cdaChannel = supabase.channel(`dashboard_cda_changes_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cross_department_assistance' }, () => fetchAssistance())
      .subscribe();
    return () => { supabase.removeChannel(cdaChannel); };
  }, []);

  // Reassignment requests — dept admins flag wrongly-assigned incidents
  // for the dispatcher to re-dispatch. Realtime so the board updates live.
  useEffect(() => {
    const fetchReassign = async () => {
      const { data } = await supabase
        .from('reassignment_requests')
        .select('*, requester:user_profiles!requested_by(full_name), department:departments!department_id(name)')
        .in('status', ['pending', 'approved', 'denied', 'cancelled'])
        .order('created_at', { ascending: false });
      setReassignRequests(data || []);
    };
    fetchReassign();
    const rrChannel = supabase.channel(`dashboard_rr_changes_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reassignment_requests' }, () => fetchReassign())
      .subscribe();
    return () => { supabase.removeChannel(rrChannel); };
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

  // Live responder positions on the command map — staff read all rows per
  // RLS. A pin shows only while that responder holds an open assignment.
  const allResponderLocs = useResponderLocations(
    !!profile && ['admin', 'dispatcher', 'responder'].includes(profile.role)
  );
  // Responders who accepted cross-department assistance — visible like the
  // assignee while the incident stays open.
  const [acceptedAssistance, setAcceptedAssistance] = useState([]);
  useEffect(() => {
    if (!profile?.id) return undefined;
    const fetchAssist = async () => {
      const { data } = await supabase
        .from('cross_department_assistance')
        .select('report_id, responded_by, report:emergency_reports(*)')
        .eq('status', 'accepted')
        .not('responded_by', 'is', null);
      if (data) setAcceptedAssistance(data);
    };
    fetchAssist();
    const ch = supabase
      .channel(`cmd_assistance_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cross_department_assistance' }, () => fetchAssist())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id]);
  const busyResponderIds = useMemo(
    () => new Set([
      ...reports.filter(r => r.assigned_to && r.status !== 'resolved').map(r => r.assigned_to),
      ...acceptedAssistance.filter(a => a.report?.status !== 'resolved').map(a => a.responded_by),
    ]),
    [reports, acceptedAssistance]
  );
  const responderMarkers = Object.entries(allResponderLocs)
    .filter(([id, loc]) => busyResponderIds.has(id) && loc?.latitude && loc?.longitude)
    .map(([id, loc]) => ({
      id,
      position: [loc.latitude, loc.longitude],
      name: loc.name,
      dept: loc.dept,
      icon: responderDeptIcon(loc.dept),
      updatedAt: loc.updated_at,
    }));

  // Every open incident gets a type-coded pin; the highlighted activeReport
  // keeps its larger red teardrop so the two don't stack.
  const incidentMarkers = useMemo(() => reports
    .filter(r => r.status !== 'resolved' && r.id !== activeReport?.id)
    .map(r => {
      const coords = reportCoords(r);
      return coords ? {
        id: r.id,
        position: coords,
        type: r.report_type || r.incident_type || r.emergency_type,
        reportId: r.report_id || r.id?.slice(0, 8),
        status: r.status,
        location: r.attachments?.location || r.location,
      } : null;
    })
    .filter(Boolean), [reports, activeReport?.id]);

  // Street-following lines from each broadcasting responder to their
  // incident via OSRM — assignee routes blue, assisting responders amber.
  const routePairs = useMemo(() => [
    ...reports
      .filter(r => r.status !== 'resolved' && r.assigned_to)
      .map(r => {
        const loc = allResponderLocs[r.assigned_to];
        const to = reportCoords(r);
        return (loc?.latitude && to)
          ? { id: r.id, from: [loc.latitude, loc.longitude], to }
          : null;
      })
      .filter(Boolean),
    ...acceptedAssistance
      .map(a => {
        const loc = allResponderLocs[a.responded_by];
        const to = reportCoords(a.report);
        return (loc?.latitude && a.report?.status !== 'resolved' && to)
          ? { id: `assist-${a.report_id}-${a.responded_by}`, from: [loc.latitude, loc.longitude], to, color: '#d97706' }
          : null;
      })
      .filter(Boolean),
  ], [reports, allResponderLocs, acceptedAssistance]);
  const responderRoutes = useDrivingRoutes(routePairs);

  // Hooks must run in the same order when switching between command-center
  // sections. Keep this before the section-specific early returns below.
  const openCount = useMemo(() => reports.filter(r => r.status !== 'resolved').length, [reports]);

  if (profile?.role === 'resident' && activeSection === 'command') return <ResidentHome />;
  if (profile?.role === 'responder' && activeSection === 'command') return <ResponderView />;
  // RBAC: role-gated sections must not render for other roles even if a
  // route guard is bypassed (direct URL, role change mid-session). The
  // editable page_permissions matrix overrides the built-in defaults.
  if (profile?.role && (!sectionAllowed(activeSection, profile.role) || !canAccessPage(activeSection, profile.role))) return <Navigate to="/" replace />;
  if (activeSection !== 'command') return <WorkspacePage section={activeSection} profile={profile} signOut={signOut} onSectionChange={setActiveSection} />;

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const updateStatus = (report, status) => {
    setReports(current => current.map(item => item.report_id === report.report_id ? { ...item, status } : item));
    setActiveReport(current => current?.report_id === report.report_id ? { ...current, status } : current);
  };

  const sidebarLinks = [
    { label: 'Command center', icon: 'LayoutDashboard', path: '/', roles: ['admin', 'dispatcher', 'department_admin'], key: 'command' },
    { label: 'Incident queue', icon: 'Siren', path: '/report-management', badge: pendingCount, roles: ['dispatcher', 'responder', 'department_admin'], key: 'queue' },
    { label: 'New incident', icon: 'PlusCircle', path: '/emergency-report', roles: ['dispatcher', 'responder', 'resident'], key: 'new' },
    { label: 'Residents & review', icon: 'Users', path: '/user-management', badge: pendingUsers.length, roles: ['admin'], key: 'residents' },
    { label: 'Access control', icon: 'ShieldCheck', path: '/access-control', roles: ['admin'], key: 'access' },
    { label: 'Departments', icon: 'Building2', path: '/department-management', roles: ['admin'], key: 'departments' },
    { label: 'Reports', icon: 'BarChart3', path: '/reports', roles: ['admin', 'dispatcher'], key: 'reports' },
    { label: 'Profile', icon: 'User', path: '/profile', roles: ['admin', 'dispatcher', 'department_admin'], key: 'profile' }
  ].filter(link => link.roles?.includes(profile?.role) && canAccessPage(link.key, profile?.role));

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <div className="flex min-h-screen">
      <AppSidebar links={sidebarLinks} profile={profile} signOut={signOut} />
      <main className="min-w-0 flex-1 pb-24 sm:pb-0">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/70 bg-white px-5  sm:px-8">
          <div><p className="text-xs font-medium  text-slate-400">{currentDate}</p><h1 className="text-lg font-bold tracking-tight">{getGreeting()}, {profile?.full_name?.split(' ')[0] || 'User'}</h1></div>
          <div className="flex items-center gap-3"><NotificationBell userId={profile?.id} onOpenIncident={(id) => { const report = reports.find(r => r.id === id); if (report) setActiveReport(report); }}/></div>
        </header>
        <div className="mx-auto max-w-[1600px] space-y-6 p-5 sm:p-8">
          <section className="overflow-hidden rounded-2xl bg-slate-900 px-6 py-6 text-white  sm:px-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center"><div><div className="mb-3 flex items-center gap-2 text-xs font-semibold  text-red-300"><span className="h-2 w-2  rounded-full bg-red-400"/>Live response operations</div><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Barangay Kalubihan Command Center</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Coordinate incidents, monitor the official service boundary, and request only the assistance your response needs.</p></div><div className="flex flex-wrap gap-3">{profile?.role !== 'admin' && <button onClick={() => navigate('/emergency-report')} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold hover:bg-red-700"><Icon name="Siren" size={18}/>Report emergency</button>}</div></div>
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            {[['Active incidents', openCount], ['Awaiting verification review', pendingCount]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200/70 bg-white p-5"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl tabular-nums">{value}</p></div>)}
          </section>
          <CommandOps reports={reports} />
          {cdaRequests.length > 0 && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase text-amber-700">Assistance requests ({cdaRequests.length})</p>
              <ul className="mt-2 space-y-1.5">
                {cdaRequests.map(row => {
                  const rep = reports.find(r => r.id === row.report_id);
                  return (
                    <li key={row.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
                      <span className="font-mono text-xs text-slate-500">{rep?.report_id || '—'}</span>
                      <span className="font-semibold capitalize">{rep?.report_type || rep?.incident_type || 'Incident'}</span>
                      <span>→ {row.department?.name || 'department'}</span>
                      {row.notes === 'auto-dispatch'
                      ? <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">auto-dispatch</span>
                      : <span className="text-xs text-slate-500">requested by {row.requester?.full_name || 'staff'}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${row.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : row.status === 'declined' ? 'bg-red-100 text-red-700' : 'bg-amber-200 text-amber-800'}`}>{row.status}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {reassignRequests.some(r => r.status === 'pending') && (
            <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-bold uppercase text-blue-700">Reassignment requests ({reassignRequests.filter(r => r.status === 'pending').length})</p>
              <ul className="mt-2 space-y-1.5">
                {reassignRequests.filter(r => r.status === 'pending').map(row => {
                  const rep = reports.find(r => r.id === row.report_id);
                  return (
                    <li key={row.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
                      <span className="font-mono text-xs text-slate-500">{rep?.report_id || '—'}</span>
                      <span className="font-semibold capitalize">{rep?.report_type || rep?.incident_type || 'Incident'}</span>
                      <span>← {row.department?.name || 'department'}</span>
                      <span className="text-xs text-slate-500">by {row.requester?.full_name || 'staff'}</span>
                      <span className="max-w-[300px] truncate text-xs italic text-slate-600" title={row.reason}>"{row.reason}"</span>
                      {profile?.role === 'dispatcher' && (
                        <button onClick={() => navigate('/report-management')} className="rounded-lg border border-blue-300 bg-white px-2 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">Review in queue</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <section className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
            <div className="overflow-hidden rounded-lg border border-slate-200/70 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold">Live incident queue</h3><p className="mt-0.5 text-xs text-slate-500">New reports appear immediately for triage.</p></div>{profile?.role !== 'admin' && <button onClick={() => navigate('/report-management')} className="text-sm font-semibold text-taste-600 hover:text-taste-700">View all</button>}</div><div className="divide-y divide-slate-100">{reports.filter(r => (r.attachments?.status || r.status) !== 'resolved').slice(0, 4).map(report => <button key={report.report_id || report.id} onClick={() => setActiveReport(report)} className={`w-full px-5 py-4 text-left transition hover:bg-slate-50 ${activeReport?.report_id === report.report_id ? 'bg-taste-50/70' : ''}`}><div className="flex gap-3"><div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${(report.report_type || report.emergency_type) === 'fire' ? 'bg-red-100 text-red-600' : 'bg-taste-100 text-taste-500'}`}><Icon name={(report.report_type || report.emergency_type) === 'fire' ? 'Flame' : (report.report_type || report.emergency_type) === 'medical' ? 'HeartPulse' : 'Car'} size={18}/></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="font-semibold capitalize">{report.report_type || report.emergency_type || report.incident_type} <span className="font-mono text-xs font-medium text-slate-400">{report.report_id || report.id?.slice(0, 8)}</span></p><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ${priorityStyles[report.priority]}`}>{report.priority}</span></div><p className="mt-1 truncate text-sm text-slate-500">{report.attachments?.location || report.location}</p><div className="mt-2 flex items-center gap-2 text-xs text-slate-400"><span className={`rounded-full px-2 py-0.5 font-medium capitalize ${statusStyles[report.status]}`}>{formatStatus(report.status)}</span><span>•</span><span>{formatTimeAgo(report.created_at)}</span></div></div></div></button>)}</div></div>
            <div className="overflow-hidden rounded-lg border border-slate-200/70 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h3 className="font-bold">Service area & active response</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Configured Barangay Kalubihan boundary</p>
                </div>
                {profile?.role === 'admin' && <button onClick={() => setIsBoundaryModalOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-taste-600 hover:text-taste-700">
                  <Icon name="Settings" size={14}/>Configure
                </button>}
              </div>
              <div className="relative h-[365px] overflow-hidden">
                <CommandCenterMap boundaryPoints={boundaryPoints} activeReport={activeReport} responderMarkers={responderMarkers} incidentMarkers={incidentMarkers} routes={responderRoutes} />
                <div className="absolute bottom-5 left-5 rounded-xl bg-white/95 p-3 shadow-lg">
                  <p className="text-xs font-bold">{activeReport?.report_id} · {activeReport?.priority} priority</p>
                  <p className="mt-1 max-w-[185px] text-xs text-slate-500">{activeReport?.attachments?.location || activeReport?.location}</p>
                </div>
                <div className="absolute right-5 top-5 rounded-xl bg-white/95 p-3 text-xs shadow-lg">
                  <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-600"/>Selected incident</div>
                  <div className="mt-2 flex items-center gap-2"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-[8px] font-bold text-white">T</span>Open incidents (letter = type)</div>
                  <div className="mt-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600"/>Responder (live)</div>
                  <div className="mt-2 flex items-center gap-2"><span className="h-0.5 w-4 border-t-2 border-dashed border-blue-500"/>Responder route</div>
                  <div className="mt-2 flex items-center gap-2"><span className="h-0.5 w-4 border-t-2 border-dashed border-amber-600"/>Assistance route</div>
                  <div className="mt-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border-2 border-taste-500"/>Service boundary</div>
                </div>
              </div>
            </div>
          </section>
          {activeReport && <section className="rounded-lg border border-slate-200/70 bg-white p-5 "><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div className="flex gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600"><Icon name="Flame" size={23}/></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold capitalize">{activeReport.report_type || activeReport.emergency_type || activeReport.incident_type} response · {activeReport.report_id}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ${priorityStyles[activeReport.priority]}`}>{activeReport.priority}</span></div><p className="mt-1 text-sm text-slate-500">{activeReport.content || activeReport.description}</p><p className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400"><Icon name="MapPin" size={13}/>{activeReport.attachments?.location || activeReport.location} <span className="mx-1">•</span> GPS location captured</p></div></div><div className="flex flex-wrap gap-2"><button onClick={() => updateStatus(activeReport, 'assigned')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Assign team</button>{profile?.role !== 'admin' && <button onClick={() => navigate('/report-management')} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="View incident details"><Icon name="ArrowUpRight" size={18}/></button>}</div></div></section>}
        </div>
      </main>
    </div>
    {isBoundaryModalOpen && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1050 p-4">
        <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-2xl">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h3 className="font-bold text-lg">Configure Service Boundary</h3>
            <button onClick={() => setIsBoundaryModalOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
              <Icon name="X" size={20} />
            </button>
          </div>
          <div className="p-4">
            <p className="text-sm text-slate-600 mb-4">Click on the map to add boundary points. The polygon defines your service area for automatic incident routing.</p>
            <div className="h-80 rounded-lg border border-slate-200 overflow-hidden mb-4">
              <MapContainer center={[10.3172, 123.8951]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <BoundaryEditor 
                  boundaryPoints={boundaryPoints}
                  setBoundaryPoints={setBoundaryPoints}
                />
                <FitToBoundary positions={boundaryPoints.length > 2 ? boundaryPoints.map(p => [p.lat, p.lng]) : []} />
                {boundaryPoints.length > 2 && (
                  <Polygon
                    positions={boundaryPoints.map(p => [p.lat, p.lng])}
                    color="#1b6c80"
                    fillColor="#1b6c80"
                    fillOpacity={0.2}
                  />
                )}
                {boundaryPoints.map((point, index) => (
                  <Marker
                    key={index}
                    position={[point.lat, point.lng]}
                    eventHandlers={{
                      click: (e) => {
                        e.originalEvent.stopPropagation();
                        setBoundaryPoints(boundaryPoints.filter((_, i) => i !== index));
                      }
                    }}
                  />
                ))}
              </MapContainer>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-500">{boundaryPoints.length} points added (click a marker to remove it)</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setBoundaryPoints([])}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Clear
                </button>
                <button 
                  onClick={handleSaveBoundary}
                  disabled={boundaryPoints.length < 3}
                  className="px-4 py-2 text-sm font-semibold bg-taste-500 text-white rounded-lg hover:bg-taste-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Save Boundary
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>;
}
