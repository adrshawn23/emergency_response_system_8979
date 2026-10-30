import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import NotificationBell from '../../components/NotificationBell';
import { supabase } from '../../lib/supabase';
import DepartmentManagementSection from './components/DepartmentManagementSection';
import PendingRegistrations from '../user-management/components/PendingRegistrations';
import { isPointInBoundary } from '../../utils/geofence';
import ResidentHome from '../resident-home';
import ResponderView from '../responder-view';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import BoundaryMap from '../../components/BoundaryMap';
import AppSidebar from '../../components/AppSidebar';
import useServiceBoundary from '../../hooks/useServiceBoundary';

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

const CommandCenterMap = ({ boundaryPoints, activeReport }) => {
  return (
    <MapContainer center={[10.3172, 123.8951]} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      {boundaryPoints.length > 2 && (
        <Polygon 
          positions={boundaryPoints.map(p => [p.lat, p.lng])} 
          color="#1b6c80" 
          fillColor="#1b6c80" 
          fillOpacity={0.2}
        />
      )}
      <FitToBoundary positions={boundaryPoints.length > 2 ? boundaryPoints.map(p => [p.lat, p.lng]) : []} />
      {activeReport?.latitude && activeReport?.longitude && (
        <Marker position={[activeReport.latitude, activeReport.longitude]}/>
      )}
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
const sectionCopy = {
  queue: { eyebrow: 'Live operations', title: 'Incident queue', description: 'Review, prioritize, and assign incoming emergency reports.' },
  new: { eyebrow: 'Live operations', title: 'New incident report', description: 'Create a report now. Dispatch sees urgent reports immediately, even while verification is pending.' },
  residents: { eyebrow: 'Administration', title: 'Residents & ID review', description: 'Review registrations, account status, and ID review outcomes.' },
  departments: { eyebrow: 'Administration', title: 'Departments & memberships', description: 'Only administrators can change department access, roles, and memberships.' },
  settings: { eyebrow: 'Administration', title: 'System settings', description: 'Configure service boundaries, data retention, and notification providers.' },
  profile: { eyebrow: 'Account', title: 'Your profile', description: 'Review your command-center account and operational availability.' }
};

function WorkspacePage({ section, profile, signOut, onSectionChange }) {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { reports, setReports } = useMockData();
  const [status, setStatus] = useState('all');
  const [draft, setDraft] = useState({ type: 'fire', priority: 'high', location: '', description: '', latitude: null, longitude: null, serviceAreaStatus: 'manual' });
  const draftKey = `incident-draft-${profile?.id || 'anon'}`;
  const [gpsStatus, setGpsStatus] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [responders, setResponders] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedResponder, setSelectedResponder] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
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
  const [assistingDepartments, setAssistingDepartments] = useState([]);
  const [isAssistanceModalOpen, setIsAssistanceModalOpen] = useState(false);
  const [selectedAssistanceReport, setSelectedAssistanceReport] = useState(null);
  const [selectedAssistanceDepts, setSelectedAssistanceDepts] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [idVerifications, setIdVerifications] = useState([]);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [idDocSignedUrl, setIdDocSignedUrl] = useState(null);
  const [profileTab, setProfileTab] = useState('info');
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [profileFormInit, setProfileFormInit] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState(null);
  const [prefsMsg, setPrefsMsg] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReportDetailModalOpen, setIsReportDetailModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles([...imageFiles, ...files]);
  };

  const handleRemoveImage = (index) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index));
  };

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

  // Fetch ID verifications (admin only)
  useEffect(() => {
    const fetchVerifications = async () => {
      if (profile?.role !== 'admin' || section !== 'residents') return;

      const { data } = await supabase
        .from('id_verifications')
        .select('*, user_profiles!id_verifications_user_id_fkey(full_name, email, phone, address, birthdate)')
        .order('created_at', { ascending: false });

      if (!data) return;

      // Verifications are NEVER auto-approved — an OCR match is advisory for
      // the reviewer only. Every row waits for an explicit administrator
      // decision via review_verification().
      setIdVerifications(data);
    };

    fetchVerifications();
  }, [profile?.role, section]);

  // Fetch pending registrations (admin only) — real signups land here with
  // status='inactive' until an administrator approves them.
  useEffect(() => {
    const fetchPendingUsers = async () => {
      if (profile?.role !== 'admin' || section !== 'residents') return;

      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('status', 'inactive')
        .order('created_at', { ascending: false });

      if (data) setPendingUsers(data);
    };

    fetchPendingUsers();
  }, [profile?.role, section]);

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
  };

  const links = [
    { key: 'command', label: 'Command center', icon: 'LayoutDashboard', path: '/', roles: ['admin', 'dispatcher'] },
    { key: 'queue', label: 'Incident queue', icon: 'Siren', path: '/report-management', roles: ['admin', 'dispatcher'] },
    { key: 'new', label: 'New incident', icon: 'PlusCircle', path: '/emergency-report', roles: ['admin', 'dispatcher'] },
    { key: 'residents', label: 'Residents & review', icon: 'Users', path: '/user-management', roles: ['admin'] },
    { key: 'departments', label: 'Departments', icon: 'Building2', path: '/department-management', roles: ['admin'] },
    { key: 'settings', label: 'System settings', icon: 'Settings', path: '/settings', roles: ['admin'] },
    // Responders/residents land on /profile via headers and need a way back —
    // key 'command' switches activeSection back to their board/home view.
    { key: 'command', label: 'Response board', icon: 'Ambulance', path: '/', roles: ['responder'] },
    { key: 'new', label: 'New incident', icon: 'PlusCircle', path: '/emergency-report', roles: ['responder'] },
    { key: 'command', label: 'Home', icon: 'Home', path: '/', roles: ['resident'] },
    { key: 'new', label: 'Report emergency', icon: 'Siren', path: '/emergency-report', roles: ['resident'] },
    { key: 'profile', label: 'Profile', icon: 'User', path: '/profile', roles: ['admin', 'dispatcher', 'responder', 'resident'] }
  ].filter(link => link.roles.includes(profile?.role));
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
    setSelectedDepartment(null);
    setSelectedResponder(null);
    setIsAssignModalOpen(true);
  };

  const handleReportClick = (report) => {
    setSelectedReport(report);
    setIsReportDetailModalOpen(true);
  };

  const handleAssignmentSubmit = async () => {
    if (!selectedReport || !selectedDepartment || !selectedResponder) return;

    const { error } = await supabase
      .from('emergency_reports')
      .update({
        assigned_to: selectedResponder,
        assigned_department_id: selectedDepartment,
        status: 'assigned'
      })
      .eq('id', selectedReport.id);

    if (error) {
      console.error('Assignment error:', error);
      return;
    }

    // Update local state
    setReports(prev => prev.map(r => 
      r.id === selectedReport.id 
        ? { ...r, assigned_to: selectedResponder, assigned_department_id: selectedDepartment, status: 'assigned' }
        : r
    ));

    setIsAssignModalOpen(false);
    setSelectedReport(null);
    setSelectedDepartment(null);
    setSelectedResponder(null);
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

  const handleRequestAssistance = async (reportId, departmentIds) => {
    // This would create assistance requests in a cross_department_assistance table
    // For now, just log the request
    console.log('Requesting assistance from departments:', departmentIds, 'for report:', reportId);
    setAssistingDepartments(prev => [...prev, { reportId, departmentIds }]);
    setIsAssistanceModalOpen(false);
    setSelectedAssistanceReport(null);
    setSelectedAssistanceDepts([]);
  };

  const handleAssistanceClick = async (report) => {
    try {
      if (!report) {
        alert('No incident selected.');
        return;
      }
      // Departments are only fetched when the assign modal opens; fetch on demand here
      let available = departments;
      if (!available || available.length === 0) {
        const { data } = await supabase.from('departments').select('*');
        available = data || [];
        setDepartments(available);
      }
      if (available.length === 0) {
        alert('No departments available. Please create departments first.');
        return;
      }
      setSelectedAssistanceReport(report);
      setSelectedAssistanceDepts([]);
      setIsAssistanceModalOpen(true);
    } catch (error) {
      console.error('Error opening assistance modal:', error);
      alert('Failed to open assistance modal. Please try again.');
    }
  };

  const handleReviewClick = (verification) => {
    setSelectedVerification(verification);
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
      setNotifPrefs({
        incident_updates: true,
        assignment_updates: true,
        verification_updates: true,
        registration_reviews: true,
        ...(profile.notification_prefs || {}),
      });
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
    const { error: upError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upError) {
      setProfileMsg('Avatar upload failed. Storage may need the avatars bucket.');
      setAvatarUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const avatar_url = `${urlData?.publicUrl}?v=${Date.now()}`;
    const { error } = await supabase.from('user_profiles').update({ avatar_url }).eq('id', profile.id);
    if (!error) await refreshProfile?.();
    setProfileMsg(error ? 'Avatar saved to storage but profile update failed.' : 'Profile picture updated.');
    setAvatarUploading(false);
  };

  const toggleNotifPref = async (key) => {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    setPrefsMsg('');
    const { error } = await supabase
      .from('user_profiles')
      .update({ notification_prefs: next })
      .eq('id', profile?.id);
    if (error) {
      // Column not applied yet — remember locally so the choice persists.
      try { localStorage.setItem(`notif_prefs_${profile?.id}`, JSON.stringify(next)); } catch {}
      setPrefsMsg('Saved on this device (server preferences need migration 20261030102000).');
    } else {
      setPrefsMsg('Preferences saved.');
    }
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

  const handleRequestClarity = async () => {
    if (!selectedVerification) return;
    const reason = 'Please upload a clearer image of your ID document';

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
  }, [section, profile?.role]);

  const submitIncident = async event => {
    event.preventDefault();
    if (!draft.location.trim() || !draft.description.trim()) return;
    if (!profile?.id) {
      setSubmitError('Profile is still loading. Try again in a moment.');
      return;
    }
    setSubmitError('');
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
        .from('emergency_reports')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (refreshedReports) {
        setReports(refreshedReports);
      }
    }
  };
  const ocrName = normText(selectedVerification?.ocr_data?.extracted_name);
  const ocrDob = normText(selectedVerification?.ocr_data?.extracted_dob);
  const ocrNameMatch = selectedVerification?.ocr_data?.name_match
    ?? (!!ocrName && ocrName === normText(selectedVerification?.user_profiles?.full_name));
  const ocrDobMatch = selectedVerification?.ocr_data?.dob_match
    ?? (!!ocrDob && ocrDob === normText(selectedVerification?.user_profiles?.birthdate));
  // Private storage paths resolve to short-lived signed URLs; legacy rows
  // hold data URLs that render directly.
  const idDocRaw = selectedVerification?.id_document_url;
  const idDocIsDirect = typeof idDocRaw === 'string' && /^(https?:|data:|blob:)/.test(idDocRaw);
  const idDocUrl = idDocIsDirect ? idDocRaw : idDocSignedUrl;

  return <div className="min-h-screen bg-slate-50 text-slate-900"><div className="flex min-h-screen">
    <AppSidebar links={links.map(l => ({ ...l, badge: l.key === 'queue' ? pendingCount : undefined }))} profile={profile} signOut={signOut} />
    <main className="min-w-0 flex-1 pb-24 sm:pb-0"><header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/70 bg-white px-5  sm:px-8"><div><p className="text-xs font-medium  text-slate-400">Kalubihan emergency command</p><h1 className="text-lg font-bold">{current.title}</h1></div><div className="flex items-center gap-3"><NotificationBell userId={profile?.id} onOpenIncident={(id) => { const report = reports.find(r => r.id === id); if (report) handleReportClick(report); }}/></div></header><div className="mx-auto max-w-[1400px] p-5 sm:p-8"><p className="text-xs font-bold  text-taste-600">{current.eyebrow}</p><h2 className="mt-1 text-3xl font-bold tracking-tight">{current.title}</h2><p className="mt-2 text-sm text-slate-500">{current.description}</p>
      {section === 'queue' && <>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">{['all','pending','assigned','in-progress','resolved'].map(item => <button key={item} onClick={() => setStatus(item)} className={`rounded-lg px-3 py-2 text-sm font-medium capitalize ${status === item ? 'bg-taste-500 text-white' : 'border border-slate-200/70 bg-white text-slate-600'}`}>{item === 'in-progress' ? 'in progress' : item}</button>)}</div>
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
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200/70 bg-white">
          <div className="grid min-w-[640px] grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(110px,.7fr)_minmax(170px,.8fr)] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold  text-slate-400"><span>Incident</span><span>Location</span><span>Priority</span><span>Status / action</span></div>
          {visibleReports.map(report => <div key={report.id || report.report_id} onClick={() => handleReportClick(report)} className="grid min-w-[640px] grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(110px,.7fr)_minmax(170px,.8fr)] items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0 cursor-pointer hover:bg-slate-50 transition">
            <div className="min-w-0"><p className="font-semibold capitalize">{report.report_type || report.incident_type} <span className="font-mono text-xs text-slate-400">{report.report_id || report.id?.slice(0, 8)}</span></p><p className="mt-1 truncate text-xs text-slate-500">{report.content || report.description}</p></div>
            <p className="truncate text-sm text-slate-600">{report.attachments?.location || report.location}</p>
            <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-bold uppercase ${priorityStyles[report.priority]}`}>{report.priority}</span>
            <div className="flex min-w-0 items-center gap-2">
              <span className={`inline-flex h-8 min-w-[84px] items-center justify-center rounded-full px-2 text-xs font-medium capitalize ${statusStyles[report.status] || 'bg-slate-100 text-slate-700'}`}>{formatStatus(report.status)}</span>
              {(profile?.role === 'dispatcher' || profile?.role === 'admin') && (report.status) !== 'resolved' && <div className="flex gap-1"><button onClick={(e) => { e.stopPropagation(); (report.status) === 'pending' ? handleAssignClick(report) : setReportStatus(report.report_id || report.id, 'resolved'); }} className="inline-flex h-8 min-w-[72px] items-center justify-center rounded-lg border border-taste-200 bg-taste-50 px-3 text-xs font-bold text-taste-600 transition hover:border-taste-300 hover:bg-taste-100 focus:outline-none focus:ring-2 focus:ring-taste-500 focus:ring-offset-2">{(report.status) === 'pending' ? 'Assign' : 'Resolve'}</button><button onClick={(e) => { e.stopPropagation(); handleAssistanceClick(report); }} className="inline-flex h-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100" title="Request cross-department assistance"><Icon name="Users" size={14}/></button></div>}
            </div>
          </div>)}
        </div>
      </>}
      {section === 'new' && <form onSubmit={submitIncident} className="mt-7 grid gap-5 lg:grid-cols-[1.4fr_.6fr]"><div className="rounded-lg border border-slate-200/70 bg-white p-6 "><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Emergency type<select value={draft.type} onChange={e => setDraft(value => ({...value, type: e.target.value}))} className="mt-2 w-full rounded-xl border-slate-200/70 bg-white text-sm"><option value="fire">Fire</option><option value="medical">Medical</option><option value="accident">Accident</option><option value="police">Public safety</option><option value="natural">Natural hazard</option></select></label><label className="text-sm font-semibold">Priority<select value={draft.priority} onChange={e => setDraft(value => ({...value, priority: e.target.value}))} className="mt-2 w-full rounded-xl border-slate-200/70 bg-white text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label></div><label className="mt-5 block text-sm font-semibold">Incident location<input required value={draft.location} onChange={e => setDraft(value => ({...value, location: e.target.value}))} placeholder="Address, landmark, or selected map pin" className="mt-2 w-full rounded-xl border-slate-200 px-3 py-3 text-sm"/></label><div className="mt-3 flex items-center gap-2 rounded-xl bg-taste-50 p-3 text-xs text-taste-600"><Icon name="MapPin" size={15}/>GPS and map provider are optional. A manual location is always accepted; outside-boundary reports go to dispatch for triage.</div>{gpsStatus && <div className={`mt-2 rounded-xl p-3 text-xs ${gpsStatus.includes('outside') ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{gpsStatus}</div>}<label className="mt-5 block text-sm font-semibold">What is happening?<textarea required value={draft.description} onChange={e => setDraft(value => ({...value, description: e.target.value}))} placeholder="Describe hazards, people involved, and immediate risks." rows="6" className="mt-2 w-full rounded-xl border-slate-200 px-3 py-3 text-sm"/></label>
        <div className="mt-5">
          <label className="block text-sm font-semibold mb-2">Upload evidence (optional)</label>
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
      </div><div className="space-y-5"><div className="rounded-lg border border-slate-200/70 bg-white p-6"><h3 className="font-bold">Report summary</h3><p className="mt-3 text-sm text-slate-600">Your report will be immediately visible to dispatch. Verification happens in parallel, so even unverified reports are triaged for response.</p></div>{submitError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{submitError}</div>}<button type="submit" disabled={loading || submitted || !profile?.id} className="w-full rounded-xl bg-red-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Submitting...' : submitted ? 'Report submitted' : 'Submit report'}</button>{submitted && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center"><Icon name="CheckCircle" size={32} className="text-emerald-600 mx-auto mb-2"/><h3 className="font-semibold text-emerald-900">Report submitted</h3><p className="mt-1 text-sm text-emerald-700">Report ID: {submittedReportId?.slice(0, 8)}<br/>Dispatch is reviewing your report now.</p></div>}</div></form>}
      {section === 'residents' && <><PendingRegistrations pendingUsers={pendingUsers} onApproveUser={handlePendingApprove} onRejectUser={handlePendingReject} /><div className="mt-7 grid gap-5 lg:grid-cols-2"><div className="rounded-lg border border-slate-200/70 bg-white p-6"><div className="mb-4"><h3 className="font-bold">ID verification queue</h3><p className="text-sm text-slate-500">{idVerifications.filter(v => v.verification_status === 'pending').length} awaiting review</p></div><p className="mt-5 text-xs leading-5 text-slate-500">OCR is assistive only. Approval, clearer-upload requests, and rejection decisions are made by an authorized administrator.</p>{idVerifications.length === 0 ? <p className="mt-4 text-sm text-slate-500">No ID verifications to review.</p> : <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">{idVerifications.map(verification => (<div key={verification.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer" onClick={() => handleReviewClick(verification)}><div><p className="text-sm font-medium">{verification.user_profiles?.full_name || 'Unknown'}</p><p className="text-xs text-slate-500">{verification.user_profiles?.email}</p><p className="text-[10px] text-slate-400 mt-1">OCR Confidence: {verification.ocr_confidence}%</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${verification.verification_status === 'pending' ? 'bg-amber-100 text-amber-700' : verification.verification_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : verification.verification_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{verification.verification_status}</span></div>))}</div>}</div><div className="rounded-lg border border-slate-200/70 bg-white p-6"><h3 className="font-bold">Account access</h3><p className="mt-1 text-sm text-slate-500">Department access cannot be self-granted.</p><div className="mt-5 text-sm text-slate-500">Manage departments via the Department Management page.</div></div><UserAccessManager /><div className="rounded-lg border border-slate-200/70 bg-white p-6"><div><h3 className="font-bold">Community verification</h3><p className="text-sm text-slate-500">Duplicate prevention enabled</p></div><p className="mt-5 text-sm leading-6 text-slate-500">System automatically detects duplicate reports from the same location within a 5-minute window. Admins can merge or dismiss duplicates manually.</p><button className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">View duplicates</button></div></div></>}
      {section === 'departments' && <DepartmentManagementSection />}
      {section === 'settings' && <div className="mt-7 grid gap-5 lg:grid-cols-2"><div className="rounded-lg border border-slate-200/70 bg-white p-6"><h3 className="font-bold">Notification preferences</h3><p className="mt-2 text-sm text-slate-500">Choose which updates reach your notification bell. Security and verification decisions are always delivered.</p><div className="mt-5 space-y-3">{notifPrefs && [
              ['incident_updates', 'Incident updates', 'New reports and status changes'],
              ['assignment_updates', 'Assignments', 'Incidents assigned to you'],
              ['registration_reviews', 'Registration reviews', 'Pending residents awaiting review'],
            ].map(([key, label, desc]) => <div key={key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"><div><span className="text-sm font-medium">{label}</span><p className="text-xs text-slate-500">{desc}</p></div><button role="switch" aria-checked={!!notifPrefs[key]} aria-label={`Toggle ${label}`} onClick={() => toggleNotifPref(key)} className={`relative h-6 w-11 cursor-pointer rounded-full transition ${notifPrefs[key] ? 'bg-taste-500' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${notifPrefs[key] ? 'left-[22px]' : 'left-0.5'}`}/></button></div>)}<div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><div><span className="text-sm font-medium">Verification & security notices</span><p className="text-xs text-slate-500">Required: cannot be turned off</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700 ring-1 ring-emerald-200">Always on</span></div>{prefsMsg && <p className="text-xs text-slate-500">{prefsMsg}</p>}</div></div>{profile?.role === 'admin' && <div className="rounded-lg border border-slate-200/70 bg-white p-6 "><div><h3 className="font-bold">Service boundary</h3><p className="text-sm text-slate-500">Kalubihan traced boundary</p></div><p className="mt-5 text-sm leading-6 text-slate-500">Changes are versioned and never rewrite historical incident locations or statuses.</p><button onClick={() => setIsBoundaryModalOpen(true)} className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Configure boundary</button></div>}</div>}
      {section === 'profile' && <div className="mt-7 max-w-3xl"><div className="mb-6 border-b border-slate-200"><nav className="-mb-px flex space-x-8" aria-label="Tabs"><button onClick={() => setProfileTab('info')} className={`py-2 px-1 border-b-2 font-medium text-sm transition ${profileTab === 'info' ? 'border-taste-500 text-taste-500' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-taste-500'}`}>Profile Information</button><button onClick={() => setProfileTab('security')} className={`py-2 px-1 border-b-2 font-medium text-sm transition ${profileTab === 'security' ? 'border-taste-500 text-taste-500' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-taste-500'}`}>Security</button></nav></div>{profileTab === 'info' && <div className="rounded-lg border border-slate-200/70 bg-white p-6 "><div className="flex items-center gap-4">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover"/> : <div className="grid h-14 w-14 place-items-center rounded-full bg-taste-500 text-lg font-bold text-white">{profile?.first_name?.[0] || 'U'}</div>}<div><h3 className="text-lg font-bold">{profile?.full_name || 'User'}</h3><p className="text-sm capitalize text-slate-500">{profile?.role || 'user'} account</p><label className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-taste-500 hover:underline"><Icon name="Camera" size={13}/>{avatarUploading ? 'Uploading…' : 'Change picture'}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading}/></label></div></div><div className="mt-7 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2"><div><label className="text-xs font-bold  text-slate-400">First name</label><input value={profileForm.first_name} onChange={e => setProfileForm({...profileForm, first_name: e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><div><label className="text-xs font-bold  text-slate-400">Last name</label><input value={profileForm.last_name} onChange={e => setProfileForm({...profileForm, last_name: e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><div><label className="text-xs font-bold  text-slate-400">Phone number</label><input value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><div><p className="text-xs font-bold  text-slate-400">Email</p><p className="mt-2.5 text-sm">{profile?.email}</p></div><div><p className="text-xs font-bold  text-slate-400">Account status</p><p className="mt-2.5 text-sm capitalize">{(profile?.account_status || 'active')}{profile?.status === 'active' ? ' · on duty' : ''}</p></div></div>{profileMsg && <p className="mt-3 text-sm text-taste-600">{profileMsg}</p>}<button onClick={handleProfileSave} className="mt-4 rounded-lg bg-taste-500 px-4 py-2 text-sm font-semibold text-white hover:bg-taste-600">Save profile</button><div className="mt-7 border-t border-slate-100 pt-5"><div className="flex items-center justify-between mb-4"><h4 className="font-bold">Emergency Contacts</h4><button onClick={() => setIsContactModalOpen(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Add Contact</button></div>{contactError && !isContactModalOpen && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{contactError}</div>}{emergencyContacts.length === 0 ? <p className="text-sm text-slate-500">No emergency contacts added.</p> : <div className="space-y-3">{emergencyContacts.map(contact => <div key={contact.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><div><p className="font-medium text-sm">{contact.name} {contact.is_primary && <span className="ml-2 rounded-full bg-taste-100 px-2 py-0.5 text-xs text-taste-600">Primary</span>}</p><p className="text-xs text-slate-500">{contact.relationship} · {contact.phone_number}</p></div><button onClick={() => handleDeleteContact(contact.id)} className="text-slate-400 hover:text-red-600"><Icon name="Trash2" size={16}/></button></div>)}</div>}</div></div>}{profileTab === 'security' && <div className="rounded-lg border border-slate-200/70 bg-white p-6 "><div className="mb-6"><h3 className="font-bold">Change password</h3><p className="text-sm text-slate-500">Update your account password</p></div>{passwordSuccess && <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{passwordSuccess}</div>}{Object.keys(passwordErrors).length > 0 && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{Object.values(passwordErrors).join('. ')}</div>}<form onSubmit={handlePasswordChange} className="space-y-4"><div><label className="block text-sm font-medium mb-2">Current Password</label><input type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><div><label className="block text-sm font-medium mb-2">New Password</label><input type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><div><label className="block text-sm font-medium mb-2">Confirm New Password</label><input type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><div className="flex gap-2"><button type="submit" disabled={isSubmitting} className="rounded-lg bg-taste-500 px-4 py-2 text-sm font-semibold text-white hover:bg-taste-600 disabled:opacity-50">Change Password</button><button type="button" onClick={() => {setPasswordForm({currentPassword: '', newPassword: '', confirmPassword: ''}); setPasswordErrors({}); setPasswordSuccess('');}} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button></div></form></div>}</div>}
      
      {/* Emergency Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Add Emergency Contact</h3>
              <button onClick={() => setIsContactModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Configure Service Boundary</h3>
              <button onClick={() => setIsBoundaryModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
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
      
      {/* Cross-Department Assistance Modal */}
      {isAssistanceModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Request Assistance</h3>
              <button onClick={() => setIsAssistanceModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-600">Select departments to assist with this incident:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {departments
                  .filter(d => d.id !== selectedAssistanceReport?.assigned_department_id)
                  .map(dept => (
                    <label key={dept.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={selectedAssistanceDepts.includes(dept.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAssistanceDepts([...selectedAssistanceDepts, dept.id]);
                          } else {
                            setSelectedAssistanceDepts(selectedAssistanceDepts.filter(id => id !== dept.id));
                          }
                        }}
                        className="rounded border-slate-200"
                      />
                      <span className="text-sm">{dept.name}</span>
                    </label>
                  ))}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button 
                  onClick={() => setIsAssistanceModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleRequestAssistance(selectedAssistanceReport?.id, selectedAssistanceDepts)}
                  disabled={selectedAssistanceDepts.length === 0}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ID Verification Review Modal */}
      {isReviewModalOpen && selectedVerification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-4xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Review ID Verification</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
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
                      <div className="min-w-0"><span className="text-slate-500">Birthdate</span><p className="font-medium">{selectedVerification.ocr_data?.extracted_dob || 'Not extracted'}</p></div>
                      {selectedVerification.ocr_data?.extracted_dob && (ocrDobMatch
                        ? <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Match</span>
                        : <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Review</span>)}
                    </div>
                    <div className="flex items-start justify-between gap-3 border-t border-taste-100 pt-2.5">
                      <div><span className="text-slate-500">OCR confidence</span><p className="font-medium">{selectedVerification.ocr_confidence}%</p></div>
                      <div><span className="text-slate-500">Status</span><p className="font-medium capitalize">{selectedVerification.verification_status}</p></div>
                    </div>
                  </div>
                </div>
              </div>

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

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button 
                  onClick={handleRequestClarity}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                >
                  Request Clarity
                </button>
                <button 
                  onClick={() => handleRejectVerification('ID verification rejected by administrator')}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Reject
                </button>
                <button 
                  onClick={handleApproveVerification}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Approve & Activate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Assignment Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Assign Incident</h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Department</label>
                <select 
                  value={selectedDepartment || ''}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select a department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
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
              <div className="flex justify-end gap-2 pt-4">
                <button 
                  onClick={() => setIsAssignModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAssignmentSubmit}
                  disabled={!selectedDepartment || !selectedResponder}
                  className="rounded-lg bg-taste-500 px-4 py-2 text-sm font-semibold text-white hover:bg-taste-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Report Detail Modal */}
      {isReportDetailModalOpen && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
              <h3 className="font-bold text-lg">Incident Details</h3>
              <button onClick={() => setIsReportDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
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
                  {selectedReport.attachments?.latitude && selectedReport.attachments?.longitude && (
                    <div className="rounded-lg overflow-hidden border border-slate-200 h-48">
                      <BoundaryMap
                        marker={[selectedReport.attachments.latitude, selectedReport.attachments.longitude]}
                      />
                    </div>
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
              {selectedReport.attachments?.service_area_status && (
                <div>
                  <p className="text-xs font-bold  text-slate-400">Service Area</p>
                  <p className={`text-sm capitalize ${selectedReport.attachments.service_area_status === 'outside' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {selectedReport.attachments.service_area_status}
                  </p>
                </div>
              )}
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
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[10000] p-4" onClick={() => setIsImageModalOpen(false)}>
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
  const { profile, signOut } = useAuth();
  const { reports, setReports } = useMockData();
  const [activeReport, setActiveReport] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [sent, setSent] = useState(false);
  const [activeSection, setActiveSection] = useState(section);
  const [currentDate, setCurrentDate] = useState('');
  const [departments, setDepartments] = useState([]);
  const [isBoundaryModalOpen, setIsBoundaryModalOpen] = useState(false);

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

  // Fetch departments for broadcast modal
  useEffect(() => {
    const fetchDepartments = async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*');
      
      if (error) {
        console.error('Error fetching departments:', error);
        return;
      }
      
      if (data) setDepartments(data.filter(d => d.is_active !== false));
    };

    fetchDepartments();
  }, []);

  // Fetch reports initially and set up real-time subscription
  useEffect(() => {
    const fetchReports = async () => {
      const { data, error } = await supabase
        .from('emergency_reports')
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
  if (profile?.role === 'responder' && activeSection === 'command') return <ResponderView />;
  // RBAC: role-restricted sections must not render for other roles even if a
  // route guard is bypassed (direct URL, role change mid-session).
  const sectionRoles = { residents: ['admin'], departments: ['admin'], settings: ['admin'], queue: ['admin', 'dispatcher'] };
  const allowedRoles = sectionRoles[activeSection];
  if (allowedRoles && profile?.role && !allowedRoles.includes(profile.role)) return <Navigate to="/" replace />;
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
    { label: 'System settings', icon: 'Settings', path: '/settings', roles: ['admin'] },
    { label: 'Profile', icon: 'User', path: '/profile', roles: ['admin', 'dispatcher'] }
  ].filter(link => link.roles.includes(profile?.role));

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
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center"><div><div className="mb-3 flex items-center gap-2 text-xs font-semibold  text-red-300"><span className="h-2 w-2  rounded-full bg-red-400"/>Live response operations</div><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Barangay Kalubihan Command Center</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Coordinate incidents, monitor the official service boundary, and request only the assistance your response needs.</p></div><div className="flex flex-wrap gap-3"><button onClick={() => navigate('/emergency-report')} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold hover:bg-red-700"><Icon name="Siren" size={18}/>Report emergency</button><button onClick={() => setShowBroadcast(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold hover:bg-taste-600"><Icon name="Radio" size={18}/>Request assistance</button></div></div>
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            {[['Active incidents', openCount], ['Awaiting verification review', pendingCount]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200/70 bg-white p-5"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl tabular-nums">{value}</p></div>)}
          </section>
          <section className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
            <div className="overflow-hidden rounded-lg border border-slate-200/70 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold">Live incident queue</h3><p className="mt-0.5 text-xs text-slate-500">New reports appear immediately for triage.</p></div><button onClick={() => navigate('/report-management')} className="text-sm font-semibold text-taste-600 hover:text-taste-700">View all</button></div><div className="divide-y divide-slate-100">{reports.filter(r => (r.attachments?.status || r.status) !== 'resolved').slice(0, 4).map(report => <button key={report.report_id || report.id} onClick={() => setActiveReport(report)} className={`w-full px-5 py-4 text-left transition hover:bg-slate-50 ${activeReport?.report_id === report.report_id ? 'bg-taste-50/70' : ''}`}><div className="flex gap-3"><div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${(report.report_type || report.emergency_type) === 'fire' ? 'bg-red-100 text-red-600' : 'bg-taste-100 text-taste-500'}`}><Icon name={(report.report_type || report.emergency_type) === 'fire' ? 'Flame' : (report.report_type || report.emergency_type) === 'medical' ? 'HeartPulse' : 'Car'} size={18}/></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="font-semibold capitalize">{report.report_type || report.emergency_type || report.incident_type} <span className="font-mono text-xs font-medium text-slate-400">{report.report_id || report.id?.slice(0, 8)}</span></p><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ${priorityStyles[report.priority]}`}>{report.priority}</span></div><p className="mt-1 truncate text-sm text-slate-500">{report.attachments?.location || report.location}</p><div className="mt-2 flex items-center gap-2 text-xs text-slate-400"><span className={`rounded-full px-2 py-0.5 font-medium capitalize ${statusStyles[report.status]}`}>{formatStatus(report.status)}</span><span>•</span><span>{formatTimeAgo(report.created_at)}</span></div></div></div></button>)}</div></div>
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
                <CommandCenterMap boundaryPoints={boundaryPoints} activeReport={activeReport} />
                <div className="absolute bottom-5 left-5 rounded-xl bg-white/95 p-3 shadow-lg">
                  <p className="text-xs font-bold">{activeReport?.report_id} · {activeReport?.priority} priority</p>
                  <p className="mt-1 max-w-[185px] text-xs text-slate-500">{activeReport?.attachments?.location || activeReport?.location}</p>
                </div>
                <div className="absolute right-5 top-5 rounded-xl bg-white/95 p-3 text-xs shadow-lg">
                  <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-600"/>Active incident</div>
                  <div className="mt-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border-2 border-taste-500"/>Service boundary</div>
                </div>
              </div>
            </div>
          </section>
          {activeReport && <section className="rounded-lg border border-slate-200/70 bg-white p-5 "><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div className="flex gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600"><Icon name="Flame" size={23}/></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold capitalize">{activeReport.report_type || activeReport.emergency_type || activeReport.incident_type} response · {activeReport.report_id}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ${priorityStyles[activeReport.priority]}`}>{activeReport.priority}</span></div><p className="mt-1 text-sm text-slate-500">{activeReport.content || activeReport.description}</p><p className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400"><Icon name="MapPin" size={13}/>{activeReport.attachments?.location || activeReport.location} <span className="mx-1">•</span> GPS location captured</p></div></div><div className="flex flex-wrap gap-2"><button onClick={() => updateStatus(activeReport, 'assigned')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Assign team</button><button onClick={() => setShowBroadcast(true)} className="rounded-xl bg-taste-500 px-3 py-2 text-sm font-semibold text-white hover:bg-taste-600">Request assistance</button><button onClick={() => navigate('/report-management')} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="View incident details"><Icon name="ArrowUpRight" size={18}/></button></div></div></section>}
        </div>
      </main>
    </div>
    {showBroadcast && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 p-6">
            <div>
              <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-taste-50 text-taste-600">
                <Icon name="Radio" size={20}/>
              </div>
              <h2 className="text-lg font-bold">Request department assistance</h2>
              <p className="mt-1 text-sm text-slate-500">Targeted only to selected, on-duty departments.</p>
            </div>
            <button onClick={() => {setShowBroadcast(false);setSent(false)}} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <Icon name="X"/>
            </button>
          </div>
          <div className="space-y-5 p-6">
            {sent ? (
              <div className="rounded-xl bg-emerald-50 p-5 text-center">
                <Icon name="CheckCircle2" size={32} className="mx-auto text-emerald-600"/>
                <p className="mt-3 font-semibold text-emerald-900">Assistance request sent</p>
                <p className="mt-1 text-sm text-emerald-700">The incident timeline now records this targeted request.</p>
                <button onClick={() => {setShowBroadcast(false);setSent(false)}} className="mt-4 text-sm font-semibold text-emerald-700">Done</button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-semibold mb-2">Select departments</label>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200/70 bg-white p-2 space-y-1">
                    {(departments || []).length === 0 ? (
                      <p className="text-sm text-slate-500 py-4 text-center">No departments available</p>
                    ) : (
                      (departments || []).map(dept => (
                        <label key={dept.id} className={`flex items-center gap-3 rounded-lg p-3 cursor-pointer transition ${selectedDepartments.includes(dept.id) ? 'bg-taste-50 border border-taste-200' : 'hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={selectedDepartments.includes(dept.id)} onChange={() => toggleDepartment(dept.id)} className="h-4 w-4 rounded border-slate-300 text-taste-500 focus:ring-taste-100"/>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{dept.name}</p>
                            <p className="text-xs text-slate-500">{dept.type}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{selectedDepartments.length} department(s) selected</p>
                </div>
                <button onClick={() => setSent(true)} disabled={selectedDepartments.length === 0} className="w-full rounded-xl bg-taste-500 px-4 py-3 text-sm font-semibold text-white hover:bg-taste-600 disabled:opacity-50 disabled:cursor-not-allowed">Send request</button>
              </>
            )}
          </div>
        </div>
      </div>
    )}
    {isBoundaryModalOpen && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 shadow-2xl w-full max-w-2xl">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h3 className="font-bold text-lg">Configure Service Boundary</h3>
            <button onClick={() => setIsBoundaryModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
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
