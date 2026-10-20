import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import { supabase } from '../../lib/supabase';
import DepartmentManagementSection from './components/DepartmentManagementSection';
import { isPointInBoundary } from '../../utils/geofence';
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
  const [draft, setDraft] = useState({ type: 'fire', priority: 'high', location: '', description: '', latitude: null, longitude: null, serviceAreaStatus: 'manual' });
  const [gpsStatus, setGpsStatus] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [responders, setResponders] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedResponder, setSelectedResponder] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', relationship: '', phone_number: '', is_primary: false });
  const [boundaryPoints, setBoundaryPoints] = useState([]);
  const [isBoundaryModalOpen, setIsBoundaryModalOpen] = useState(false);
  const [assistingDepartments, setAssistingDepartments] = useState([]);
  const [isAssistanceModalOpen, setIsAssistanceModalOpen] = useState(false);
  const [selectedAssistanceReport, setSelectedAssistanceReport] = useState(null);
  const [selectedAssistanceDepts, setSelectedAssistanceDepts] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [idVerifications, setIdVerifications] = useState([]);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
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
          setReports(prev => [payload.new, ...prev]);
          // Add notification for new incident
          const newNotif = {
            id: `new-${payload.new.id}`,
            type: 'new_incident',
            title: 'New incident reported',
            message: `${payload.new.emergency_type || 'Emergency'} at ${payload.new.attachments?.location || payload.new.location || 'Unknown location'}`,
            reportId: payload.new.id,
            timestamp: new Date().toISOString(),
            read: false
          };
          setNotifications(prev => [newNotif, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setReports(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
          // Add notification for status changes
          if (payload.old.status !== payload.new.status) {
            const statusNotif = {
              id: `status-${payload.new.id}-${Date.now()}`,
              type: 'status_change',
              title: 'Incident status updated',
              message: `Incident ${payload.new.report_id || payload.new.id?.slice(0, 8)} is now ${payload.new.status}`,
              reportId: payload.new.id,
              timestamp: new Date().toISOString(),
              read: false
            };
            setNotifications(prev => [statusNotif, ...prev]);
          }
          if (payload.old.assigned_to !== payload.new.assigned_to) {
            const assignNotif = {
              id: `assign-${payload.new.id}-${Date.now()}`,
              type: 'assignment',
              title: 'Incident assigned',
              message: `Incident ${payload.new.report_id || payload.new.id?.slice(0, 8)} has been assigned`,
              reportId: payload.new.id,
              timestamp: new Date().toISOString(),
              read: false
            };
            setNotifications(prev => [assignNotif, ...prev]);
          }
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
        .eq('is_active', true);
      
      console.log('Fetched responders:', responderData);
      console.log('Responder error:', responderError);
      if (responderData) {
        responderData.forEach(r => {
          console.log(`Responder: ${r.full_name || r.email}, dept_id: ${r.department_id}, role: ${r.role}, is_active: ${r.is_active}`);
        });
        setResponders(responderData);
      }
    };

    fetchAssignmentData();
  }, [isAssignModalOpen]);

  // Fetch emergency contacts
  useEffect(() => {
    const fetchContacts = async () => {
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
        .select('*, user_profiles(full_name, email)')
        .order('created_at', { ascending: false });
      
      if (data) setIdVerifications(data);
    };

    fetchVerifications();
  }, [profile?.role, section]);

  const links = [
    { key: 'command', label: 'Command center', icon: 'LayoutDashboard', path: '/', roles: ['admin', 'dispatcher'] },
    { key: 'queue', label: 'Incident queue', icon: 'Siren', path: '/report-management', roles: ['admin', 'dispatcher'] },
    { key: 'new', label: 'New incident', icon: 'PlusCircle', path: '/emergency-report', roles: ['admin', 'dispatcher'] },
    { key: 'residents', label: 'Residents & review', icon: 'Users', path: '/user-management', roles: ['admin'] },
    { key: 'departments', label: 'Departments', icon: 'Building2', path: '/department-management', roles: ['admin'] },
    { key: 'settings', label: 'System settings', icon: 'Settings', path: '/settings', roles: ['admin'] },
    { key: 'profile', label: 'Profile', icon: 'User', path: '/profile', roles: ['admin', 'dispatcher', 'responder'] }
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
          (report.attachments?.priority || report.priority || '').toLowerCase().includes(query) ||
          (report.attachments?.status || report.status || '').toLowerCase().includes(query)
        );
      })
    : reports;
  const visibleReports = status === 'all' ? filteredReports : filteredReports.filter(report => (report.attachments?.status || report.status) === status);
  const pendingCount = reports.filter(r => (r.attachments?.status || r.status) === 'pending').length;
  const handleNavigation = link => onSectionChange(link.key);
  const setReportStatus = (id, nextStatus) => {
    setReports(items => items.map(item => item.report_id === id ? { ...item, status: nextStatus } : item));
    // Update in Supabase
    supabase.from('emergency_reports').update({ status: nextStatus }).eq('report_id', id);
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

    const { error } = await supabase
      .from('emergency_contacts')
      .insert({
        user_id: profile?.id,
        name: newContact.name,
        relationship: newContact.relationship,
        phone_number: newContact.phone_number,
        is_primary: newContact.is_primary
      });

    if (!error) {
      const { data } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', profile?.id);
      
      if (data) setEmergencyContacts(data);
      setNewContact({ name: '', relationship: '', phone_number: '', is_primary: false });
      setIsContactModalOpen(false);
    }
  };

  const handleDeleteContact = async (contactId) => {
    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', contactId);

    if (!error) {
      setEmergencyContacts(prev => prev.filter(c => c.id !== contactId));
    }
  };

  const handleSaveBoundary = async () => {
    // Save boundary points to database (would need a service_boundaries table)
    // For now, save to localStorage as demo
    localStorage.setItem('service_boundary', JSON.stringify({ points: boundaryPoints }));
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

  const handleAssistanceClick = (report) => {
    try {
      if (!departments || departments.length === 0) {
        alert('No departments available. Please create departments first.');
        return;
      }
      if (!report) {
        alert('No incident selected.');
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

  const handleApproveVerification = async () => {
    if (!selectedVerification) return;

    const { error } = await supabase
      .from('id_verifications')
      .update({
        verification_status: 'approved',
        reviewed_by: profile?.id,
        review_notes: 'Approved by administrator'
      })
      .eq('id', selectedVerification.id);

    if (!error) {
      // Activate user account
      await supabase
        .from('user_profiles')
        .update({ is_active: true, account_status: 'active' })
        .eq('id', selectedVerification.user_id);

      setIdVerifications(prev => prev.map(v => 
        v.id === selectedVerification.id 
          ? { ...v, verification_status: 'approved', reviewed_by: profile?.id }
          : v
      ));
      setIsReviewModalOpen(false);
      setSelectedVerification(null);
    }
  };

  const handleRejectVerification = async (reason) => {
    if (!selectedVerification) return;

    const { error } = await supabase
      .from('id_verifications')
      .update({
        verification_status: 'rejected',
        reviewed_by: profile?.id,
        review_notes: reason
      })
      .eq('id', selectedVerification.id);

    if (!error) {
      setIdVerifications(prev => prev.map(v => 
        v.id === selectedVerification.id 
          ? { ...v, verification_status: 'rejected', reviewed_by: profile?.id, review_notes: reason }
          : v
      ));
      setIsReviewModalOpen(false);
      setSelectedVerification(null);
    }
  };

  const handleRequestClarity = async () => {
    if (!selectedVerification) return;

    const { error } = await supabase
      .from('id_verifications')
      .update({
        verification_status: 'needs_clarity',
        reviewed_by: profile?.id,
        review_notes: 'Please upload a clearer image of your ID document'
      })
      .eq('id', selectedVerification.id);

    if (!error) {
      setIdVerifications(prev => prev.map(v => 
        v.id === selectedVerification.id 
          ? { ...v, verification_status: 'needs_clarity', reviewed_by: profile?.id }
          : v
      ));
      setIsReviewModalOpen(false);
      setSelectedVerification(null);
    }
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
        
        // Get service boundary from localStorage or use default
        const savedBoundary = localStorage.getItem('service_boundary');
        const serviceBoundary = savedBoundary ? JSON.parse(savedBoundary) : { points: [
          { latitude: 10.3172, longitude: 123.8951 },
          { latitude: 10.3172, longitude: 123.8981 },
          { latitude: 10.3192, longitude: 123.8981 },
          { latitude: 10.3192, longitude: 123.8951 }
        ]};
        
        const inServiceArea = isPointInBoundary({ latitude, longitude }, serviceBoundary.points);
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
        contact_phone: profile?.phone_number,
        service_area_status: draft.serviceAreaStatus,
        images: imageDataUrls
      }
    }).select().single();

    if (!error && data) {
      setSubmittedReportId(data.id);
      setSubmitted(true);
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
  return <div className="min-h-screen bg-slate-50 text-slate-900"><div className="flex min-h-screen">
    <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col overflow-x-hidden bg-slate-950 text-slate-300 sm:w-72"><div className="flex h-20 items-center justify-center gap-3 border-b border-slate-800 px-3 sm:justify-start sm:px-7"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500 text-white"><Icon name="Siren" size={22}/></div><div className="hidden sm:block"><p className="font-semibold text-white">Kalubihan</p><p className="text-xs text-slate-500">Emergency Command</p></div></div><div className="flex-1 px-3 py-7 sm:px-4"><p className="mb-3 hidden px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500 sm:block">Operations</p><nav className="space-y-1">{links.map(link => <button key={link.key} onClick={() => handleNavigation(link)} title={link.label} className={`flex w-full items-center justify-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition sm:justify-start ${link.key === section ? 'bg-white/10 font-medium text-white' : 'hover:bg-white/5 hover:text-white'}`}><Icon name={link.icon} size={18}/><span className="hidden flex-1 sm:block">{link.label}</span>{link.key === 'queue' && <span className="hidden rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white sm:block">{pendingCount}</span>}</button>)}</nav></div><div className="m-3 rounded-2xl bg-slate-900 p-3 sm:m-4 sm:p-4"><div className="flex items-center justify-center gap-3 sm:justify-start"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-700 text-sm font-bold text-white">{profile?.first_name?.[0] || 'A'}</div><div className="hidden min-w-0 flex-1 sm:block"><p className="truncate text-sm font-medium text-white">{profile?.full_name || 'Administrator'}</p><p className="text-xs capitalize text-slate-500">{profile?.role}</p></div><button onClick={signOut} className="hidden text-slate-500 hover:text-white sm:block"><Icon name="LogOut" size={17}/></button></div></div></aside>
    <main className="min-w-0 flex-1"><header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8"><div><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Kalubihan emergency command</p><h1 className="text-lg font-bold">{current.title}</h1></div><div className="flex items-center gap-3"><div className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500"/>All systems operational</div><button onClick={() => setIsNotificationPanelOpen(!isNotificationPanelOpen)} className="relative rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><Icon name="Bell" size={18}/>{notifications.length > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white">{notifications.length}</span>}</button></div></header><div className="mx-auto max-w-[1400px] p-5 sm:p-8"><p className="text-xs font-bold uppercase tracking-wider text-blue-700">{current.eyebrow}</p><h2 className="mt-1 text-3xl font-bold tracking-tight">{current.title}</h2><p className="mt-2 text-sm text-slate-500">{current.description}</p>
      {section === 'queue' && <>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">{['all','pending','assigned','in-progress','resolved'].map(item => <button key={item} onClick={() => setStatus(item)} className={`rounded-lg px-3 py-2 text-sm font-medium capitalize ${status === item ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{item === 'in-progress' ? 'in progress' : item}</button>)}</div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search incidents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 rounded-lg border border-slate-200 px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <button onClick={() => navigate('/emergency-report')} className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white"><Icon name="Plus" size={16} className="mr-1 inline"/>New incident</button>
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(110px,.7fr)_minmax(170px,.8fr)] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400"><span>Incident</span><span>Location</span><span>Priority</span><span>Status / action</span></div>
          {visibleReports.map(report => <div key={report.id || report.report_id} onClick={() => handleReportClick(report)} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(110px,.7fr)_minmax(170px,.8fr)] items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0 cursor-pointer hover:bg-slate-50 transition">
            <div className="min-w-0"><p className="font-semibold capitalize">{report.report_type || report.incident_type} <span className="font-mono text-xs text-slate-400">{report.report_id || report.id?.slice(0, 8)}</span></p><p className="mt-1 truncate text-xs text-slate-500">{report.content || report.description}</p></div>
            <p className="truncate text-sm text-slate-600">{report.attachments?.location || report.location}</p>
            <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-bold uppercase ${priorityStyles[report.attachments?.priority || report.priority]}`}>{report.attachments?.priority || report.priority}</span>
            <div className="flex min-w-0 items-center gap-2">
              <span className={`inline-flex h-8 min-w-[84px] items-center justify-center rounded-full px-2 text-xs font-medium capitalize ${statusStyles[report.attachments?.status || report.status] || 'bg-slate-100 text-slate-700'}`}>{formatStatus(report.attachments?.status || report.status)}</span>
              {(profile?.role === 'dispatcher' || profile?.role === 'admin') && (report.attachments?.status || report.status) !== 'resolved' && <div className="flex gap-1"><button onClick={(e) => { e.stopPropagation(); (report.attachments?.status || report.status) === 'pending' ? handleAssignClick(report) : setReportStatus(report.report_id || report.id, 'resolved'); }} className="inline-flex h-8 min-w-[72px] items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">{(report.attachments?.status || report.status) === 'pending' ? 'Assign' : 'Resolve'}</button><button onClick={(e) => { e.stopPropagation(); handleAssistanceClick(report); }} className="inline-flex h-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100" title="Request cross-department assistance"><Icon name="Users" size={14}/></button></div>}
            </div>
          </div>)}
        </div>
      </>}
      {section === 'new' && <form onSubmit={submitIncident} className="mt-7 grid gap-5 lg:grid-cols-[1.4fr_.6fr]"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Emergency type<select value={draft.type} onChange={e => setDraft(value => ({...value, type: e.target.value}))} className="mt-2 w-full rounded-xl border-slate-200 bg-white text-sm"><option value="fire">Fire</option><option value="medical">Medical</option><option value="accident">Accident</option><option value="police">Public safety</option><option value="natural">Natural hazard</option></select></label><label className="text-sm font-semibold">Priority<select value={draft.priority} onChange={e => setDraft(value => ({...value, priority: e.target.value}))} className="mt-2 w-full rounded-xl border-slate-200 bg-white text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label></div><label className="mt-5 block text-sm font-semibold">Incident location<input required value={draft.location} onChange={e => setDraft(value => ({...value, location: e.target.value}))} placeholder="Address, landmark, or selected map pin" className="mt-2 w-full rounded-xl border-slate-200 px-3 py-3 text-sm"/></label><div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-800"><Icon name="MapPin" size={15}/>GPS and map provider are optional. A manual location is always accepted; outside-boundary reports go to dispatch for triage.</div><label className="mt-5 block text-sm font-semibold">What is happening?<textarea required value={draft.description} onChange={e => setDraft(value => ({...value, description: e.target.value}))} placeholder="Describe hazards, people involved, and immediate risks." rows="6" className="mt-2 w-full rounded-xl border-slate-200 px-3 py-3 text-sm"/></label>
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
                    className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                  >
                    <Icon name="X" size={12}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div><div className="space-y-5"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="font-bold">Report summary</h3><p className="mt-3 text-sm text-slate-600">Your report will be immediately visible to dispatch. Verification happens in parallel, so even unverified reports are triaged for response.</p></div><button type="submit" disabled={loading || submitted} className="w-full rounded-xl bg-red-500 px-4 py-3.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Submitting...' : submitted ? 'Report submitted' : 'Submit report'}</button>{submitted && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center"><Icon name="CheckCircle" size={32} className="text-emerald-600 mx-auto mb-2"/><h3 className="font-semibold text-emerald-900">Report submitted</h3><p className="mt-1 text-sm text-emerald-700">Report ID: {submittedReportId?.slice(0, 8)}<br/>Dispatch is reviewing your report now.</p></div>}</div></form>}
      {section === 'residents' && <div className="mt-7 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><Icon name="FileSearch" size={20}/></div><div><h3 className="font-bold">ID verification queue</h3><p className="text-sm text-slate-500">{idVerifications.filter(v => v.verification_status === 'pending').length} awaiting review</p></div></div></div><p className="mt-5 text-xs leading-5 text-slate-500">OCR is assistive only. Approval, clearer-upload requests, and rejection decisions are made by an authorized administrator.</p>{idVerifications.length === 0 ? <p className="mt-4 text-sm text-slate-500">No ID verifications to review.</p> : <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">{idVerifications.map(verification => (<div key={verification.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer" onClick={() => handleReviewClick(verification)}><div><p className="text-sm font-medium">{verification.user_profiles?.full_name || 'Unknown'}</p><p className="text-xs text-slate-500">{verification.user_profiles?.email}</p><p className="text-[10px] text-slate-400 mt-1">OCR Confidence: {verification.ocr_confidence}%</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${verification.verification_status === 'pending' ? 'bg-amber-100 text-amber-700' : verification.verification_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : verification.verification_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{verification.verification_status}</span></div>))}</div>}</div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="font-bold">Account access</h3><p className="mt-1 text-sm text-slate-500">Department access cannot be self-granted.</p><div className="mt-5 text-sm text-slate-500">Manage departments via the Department Management page.</div></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon name="ShieldCheck" size={20}/></div><div><h3 className="font-bold">Community verification</h3><p className="text-sm text-slate-500">Duplicate prevention enabled</p></div></div><p className="mt-5 text-sm leading-6 text-slate-500">System automatically detects duplicate reports from the same location within a 5-minute window. Admins can merge or dismiss duplicates manually.</p><button className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">View duplicates</button></div></div>}
      {section === 'departments' && <DepartmentManagementSection />}
      {section === 'settings' && <div className="mt-7 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon name="Map" size={20}/></div><div><h3 className="font-bold">Service boundary</h3><p className="text-sm text-slate-500">Kalubihan demo boundary · version 1</p></div></div><p className="mt-5 text-sm leading-6 text-slate-500">Changes are versioned and never rewrite historical incident locations or statuses.</p><button onClick={() => setIsBoundaryModalOpen(true)} className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Configure boundary</button></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="font-bold">Delivery providers</h3><p className="mt-2 text-sm text-slate-500">In-app notifications are available in mock mode. SMS, email, push, map GIS, and OCR require provider credentials.</p><button className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Provider settings</button></div></div>}
      {section === 'profile' && <div className="mt-7 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-full bg-blue-700 text-lg font-bold text-white">{profile?.first_name?.[0] || 'A'}</div><div><h3 className="text-lg font-bold">{profile?.full_name || 'Administrator'}</h3><p className="text-sm capitalize text-slate-500">{profile?.role || 'Administrator'} account</p></div></div><div className="mt-7 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</p><p className="mt-1 text-sm">{profile?.email}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</p><p className="mt-1 text-sm text-emerald-700">Active / on duty</p></div></div>
        
        <div className="mt-7 border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold">Emergency Contacts</h4>
            <button onClick={() => setIsContactModalOpen(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Add Contact</button>
          </div>
          {emergencyContacts.length === 0 ? (
            <p className="text-sm text-slate-500">No emergency contacts added.</p>
          ) : (
            <div className="space-y-3">
              {emergencyContacts.map(contact => (
                <div key={contact.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="font-medium text-sm">{contact.name} {contact.is_primary && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Primary</span>}</p>
                    <p className="text-xs text-slate-500">{contact.relationship} · {contact.phone_number}</p>
                  </div>
                  <button onClick={() => handleDeleteContact(contact.id)} className="text-slate-400 hover:text-red-600">
                    <Icon name="Trash2" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>}
      
      {/* Emergency Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Add Emergency Contact</h3>
              <button onClick={() => setIsContactModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Name</label>
                <input 
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Contact name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Relationship</label>
                <input 
                  type="text"
                  value={newContact.relationship}
                  onChange={(e) => setNewContact({...newContact, relationship: e.target.value})}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g., Spouse, Parent, Friend"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Phone Number</label>
                <input 
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
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
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
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Configure Service Boundary</h3>
              <button onClick={() => setIsBoundaryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-4">Click on the map to add boundary points. The polygon defines your service area for automatic incident routing.</p>
              <div className="h-64 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center mb-4">
                <p className="text-sm text-slate-500">Map integration coming soon</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">{boundaryPoints.length} points added</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setBoundaryPoints([])}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={handleSaveBoundary}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
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
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Request Assistance</h3>
              <button onClick={() => setIsAssistanceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
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
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Review ID Verification</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Name</p>
                  <p className="mt-1 text-sm">{selectedVerification.user_profiles?.full_name}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</p>
                  <p className="mt-1 text-sm">{selectedVerification.user_profiles?.email}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">OCR Confidence</p>
                  <p className="mt-1 text-sm">{selectedVerification.ocr_confidence}%</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Status</p>
                  <p className="mt-1 text-sm capitalize">{selectedVerification.verification_status}</p>
                </div>
              </div>
              
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Extracted Data</p>
                <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
                  <p><strong>Name:</strong> {selectedVerification.ocr_data?.extracted_name}</p>
                  <p><strong>DOB:</strong> {selectedVerification.ocr_data?.extracted_dob}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">ID Document</p>
                <div className="mt-2 rounded-lg bg-slate-100 p-8 text-center text-sm text-slate-500">
                  ID document preview would appear here
                </div>
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
      
      {/* Notification Panel */}
      {isNotificationPanelOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-end z-[9999] p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg w-full max-w-sm mt-16 mr-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Notifications</h3>
              <button onClick={() => setIsNotificationPanelOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No new notifications</p>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      onClick={() => {
                        if (notif.reportId) {
                          const report = reports.find(r => r.id === notif.reportId);
                          if (report) setSelectedReport(report);
                        }
                        setIsNotificationPanelOpen(false);
                      }}
                      className={`rounded-lg border p-3 hover:bg-slate-50 cursor-pointer transition ${!notif.read ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 h-2 w-2 rounded-full ${notif.type === 'new_incident' ? 'bg-red-500' : notif.type === 'status_change' ? 'bg-amber-500' : 'bg-blue-500'}`}/>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                          <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                          <p className="text-[10px] text-slate-400 mt-2">{formatTimeAgo(notif.timestamp)}</p>
                        </div>
                        {!notif.read && (
                          <div className="h-2 w-2 rounded-full bg-blue-500"/>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Assignment Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">Assign Incident</h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600">
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
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
              <h3 className="font-bold text-lg">Incident Details</h3>
              <button onClick={() => setIsReportDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Incident ID</p>
                  <p className="font-mono text-sm">{selectedReport.report_id || selectedReport.id?.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Type</p>
                  <p className="capitalize text-sm">{selectedReport.report_type || selectedReport.incident_type}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Description</p>
                <p className="text-sm mt-1">{selectedReport.content || selectedReport.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Location</p>
                  <p className="text-sm mb-2">{selectedReport.attachments?.location || selectedReport.location}</p>
                  {selectedReport.attachments?.latitude && selectedReport.attachments?.longitude && (
                    <div className="rounded-lg overflow-hidden border border-slate-200 h-48">
                      <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        scrolling="no"
                        marginHeight="0"
                        marginWidth="0"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedReport.attachments.longitude - 0.01}%2C${selectedReport.attachments.latitude - 0.01}%2C${selectedReport.attachments.longitude + 0.01}%2C${selectedReport.attachments.latitude + 0.01}&layer=mapnik&marker=${selectedReport.attachments.latitude}%2C${selectedReport.attachments.longitude}`}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Priority</p>
                  <span className={`inline-block px-2 py-1 text-[10px] font-bold uppercase rounded-full ${priorityStyles[selectedReport.attachments?.priority || selectedReport.priority]}`}>{selectedReport.attachments?.priority || selectedReport.priority}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Status</p>
                  <span className={`inline-block px-2 py-1 text-xs font-medium capitalize rounded-full ${statusStyles[selectedReport.attachments?.status || selectedReport.status] || 'bg-slate-100 text-slate-700'}`}>{formatStatus(selectedReport.attachments?.status || selectedReport.status)}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Contact</p>
                  <p className="text-sm">{selectedReport.attachments?.contact_name || 'N/A'}</p>
                  <p className="text-xs text-slate-500">{selectedReport.attachments?.contact_phone || 'N/A'}</p>
                </div>
              </div>
              {selectedReport.attachments?.latitude && selectedReport.attachments?.longitude && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">GPS Coordinates</p>
                  <p className="text-sm font-mono">{selectedReport.attachments.latitude}, {selectedReport.attachments.longitude}</p>
                </div>
              )}
              {selectedReport.attachments?.service_area_status && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Service Area</p>
                  <p className={`text-sm capitalize ${selectedReport.attachments.service_area_status === 'outside' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {selectedReport.attachments.service_area_status}
                  </p>
                </div>
              )}
              {selectedReport.attachments?.images && selectedReport.attachments.images.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Evidence Images</p>
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
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button 
                  onClick={() => setIsReportDetailModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Close
                </button>
                {(profile?.role === 'dispatcher' || profile?.role === 'admin') && (selectedReport.attachments?.status || selectedReport.status) !== 'resolved' && (
                  <button 
                    onClick={() => {
                      setIsReportDetailModalOpen(false);
                      handleAssignClick(selectedReport);
                    }}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    {(selectedReport.attachments?.status || selectedReport.status) === 'pending' ? 'Assign' : 'Resolve'}
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
              className="absolute top-4 right-4 rounded-full bg-white/20 hover:bg-white/30 p-2 text-white backdrop-blur-sm"
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [notifications, setNotifications] = useState([]);

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
          setReports(prev => [payload.new, ...prev]);
          const newNotif = {
            id: `new-${payload.new.id}`,
            type: 'new_incident',
            title: 'New incident reported',
            message: `${payload.new.emergency_type || payload.new.incident_type || 'Emergency'} at ${payload.new.attachments?.location || payload.new.location || 'Unknown location'}`,
            reportId: payload.new.id,
            timestamp: new Date().toISOString(),
            read: false
          };
          setNotifications(prev => [newNotif, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setReports(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
          if (payload.old.status !== payload.new.status) {
            const statusNotif = {
              id: `status-${payload.new.id}-${Date.now()}`,
              type: 'status_change',
              title: 'Incident status updated',
              message: `Incident ${payload.new.report_id || payload.new.id?.slice(0, 8)} is now ${payload.new.status}`,
              reportId: payload.new.id,
              timestamp: new Date().toISOString(),
              read: false
            };
            setNotifications(prev => [statusNotif, ...prev]);
          }
          if (payload.old.assigned_to !== payload.new.assigned_to) {
            const assignNotif = {
              id: `assign-${payload.new.id}-${Date.now()}`,
              type: 'assignment',
              title: 'Incident assigned',
              message: `Incident ${payload.new.report_id || payload.new.id?.slice(0, 8)} has been assigned`,
              reportId: payload.new.id,
              timestamp: new Date().toISOString(),
              read: false
            };
            setNotifications(prev => [assignNotif, ...prev]);
          }
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
    { label: 'System settings', icon: 'Settings', path: '/settings', roles: ['admin'] },
    { label: 'Profile', icon: 'User', path: '/profile', roles: ['admin', 'dispatcher'] }
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
              {notifications.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-red-500"/>
                    <p>No new notifications</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      onClick={() => {
                        if (notif.reportId) {
                          const report = reports.find(r => r.id === notif.reportId);
                          if (report) setActiveReport(report);
                        }
                        setShowNotifications(false);
                      }}
                      className={`px-4 py-3 cursor-pointer transition hover:bg-slate-50 ${!notif.read ? 'bg-blue-50/30' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 h-2 w-2 rounded-full ${notif.type === 'new_incident' ? 'bg-red-500' : notif.type === 'status_change' ? 'bg-amber-500' : 'bg-blue-500'}`}/>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                          <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                          <p className="text-[10px] text-slate-400 mt-2">{formatTimeAgo(notif.timestamp)}</p>
                        </div>
                        {!notif.read && (
                          <div className="h-2 w-2 rounded-full bg-blue-500"/>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold">Live incident queue</h3><p className="mt-0.5 text-xs text-slate-500">New reports appear immediately for triage.</p></div><button onClick={() => navigate('/report-management')} className="text-sm font-semibold text-blue-700 hover:text-blue-900">View all</button></div><div className="divide-y divide-slate-100">{reports.filter(r => (r.attachments?.status || r.status) !== 'resolved').map(report => <button key={report.report_id || report.id} onClick={() => setActiveReport(report)} className={`w-full px-5 py-4 text-left transition hover:bg-slate-50 ${activeReport?.report_id === report.report_id ? 'bg-blue-50/70' : ''}`}><div className="flex gap-3"><div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${report.emergency_type === 'fire' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}><Icon name={report.emergency_type === 'fire' ? 'Flame' : report.emergency_type === 'medical' ? 'HeartPulse' : 'Car'} size={18}/></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="font-semibold capitalize">{report.emergency_type || report.incident_type} <span className="font-mono text-xs font-medium text-slate-400">{report.report_id || report.id?.slice(0, 8)}</span></p><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ${priorityStyles[report.attachments?.priority || report.priority]}`}>{report.attachments?.priority || report.priority}</span></div><p className="mt-1 truncate text-sm text-slate-500">{report.attachments?.location || report.location}</p><div className="mt-2 flex items-center gap-2 text-xs text-slate-400"><span className={`rounded-full px-2 py-0.5 font-medium capitalize ${statusStyles[report.attachments?.status || report.status]}`}>{formatStatus(report.attachments?.status || report.status)}</span><span>•</span><span>{formatTimeAgo(report.created_at)}</span></div></div></div></button>)}</div></div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold">Service area & active response</h3><p className="mt-0.5 text-xs text-slate-500">Configured Barangay Kalubihan boundary</p></div><button className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><Icon name="Maximize2" size={14}/>Expand</button></div><div className="relative h-[365px] overflow-hidden bg-[#e8f1e6] p-5"><div className="absolute inset-0 opacity-70" style={{backgroundImage:'linear-gradient(30deg, transparent 48%, #d4e1d5 49%, #d4e1d5 51%, transparent 52%), linear-gradient(-28deg, transparent 48%, #d4e1d5 49%, #d4e1d5 51%, transparent 52%)', backgroundSize:'150px 95px'}}/><div className="absolute left-[15%] top-[12%] h-[73%] w-[67%] rotate-[-8deg] rounded-[44%_50%_45%_40%] border-[3px] border-blue-600/80 bg-blue-400/10"><span className="absolute left-6 top-5 -rotate-[-2deg] rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-blue-700 shadow">KALUBIHAN SERVICE AREA</span></div><div className="absolute left-[48%] top-[45%] grid h-11 w-11 place-items-center rounded-full border-4 border-white bg-red-500 text-white shadow-lg shadow-red-500/40"><Icon name="Flame" size={19}/></div><div className="absolute bottom-5 left-5 rounded-xl bg-white/95 p-3 shadow-lg"><p className="text-xs font-bold">{activeReport?.report_id} · {activeReport?.priority} priority</p><p className="mt-1 max-w-[185px] text-xs text-slate-500">{activeReport?.location}</p></div><div className="absolute right-5 top-5 rounded-xl bg-white/95 p-3 text-xs shadow-lg"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500"/>Active incident</div><div className="mt-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border-2 border-blue-600"/>Service boundary</div></div></div></div>
          </section>
          {activeReport && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div className="flex gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600"><Icon name="Flame" size={23}/></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold capitalize">{activeReport.emergency_type} response · {activeReport.report_id}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ${priorityStyles[activeReport.priority]}`}>{activeReport.priority}</span></div><p className="mt-1 text-sm text-slate-500">{activeReport.description}</p><p className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400"><Icon name="MapPin" size={13}/>{activeReport.location} <span className="mx-1">•</span> GPS location captured</p></div></div><div className="flex flex-wrap gap-2"><button onClick={() => updateStatus(activeReport, 'assigned')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Assign team</button><button onClick={() => setShowBroadcast(true)} className="rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">Request assistance</button><button onClick={() => navigate('/report-management')} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="View incident details"><Icon name="ArrowUpRight" size={18}/></button></div></div></section>}
        </div>
      </main>
    </div>
    {showBroadcast && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-100 p-6"><div><div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon name="Radio" size={20}/></div><h2 className="text-lg font-bold">Request department assistance</h2><p className="mt-1 text-sm text-slate-500">Targeted only to selected, on-duty departments.</p></div><button onClick={() => {setShowBroadcast(false);setSent(false)}} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><Icon name="X"/></button></div><div className="space-y-5 p-6">{sent ? <div className="rounded-xl bg-emerald-50 p-5 text-center"><Icon name="CheckCircle2" size={32} className="mx-auto text-emerald-600"/><p className="mt-3 font-semibold text-emerald-900">Assistance request sent</p><p className="mt-1 text-sm text-emerald-700">The incident timeline now records this targeted request.</p><button onClick={() => {setShowBroadcast(false);setSent(false)}} className="mt-4 text-sm font-semibold text-emerald-700">Done</button></div> : <><div><label className="block text-sm font-semibold mb-2">Select departments</label><div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 space-y-1">{(departments || []).length === 0 ? <p className="text-sm text-slate-500 py-4 text-center">No departments available</p> : (departments || []).map(dept => <label key={dept.id} className={`flex items-center gap-3 rounded-lg p-3 cursor-pointer transition ${selectedDepartments.includes(dept.id) ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50'}`}><input type="checkbox" checked={selectedDepartments.includes(dept.id)} onChange={() => toggleDepartment(dept.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/><div className="flex-1"><p className="text-sm font-medium">{dept.name}</p><p className="text-xs text-slate-500">{dept.type}</p></div></label>)}</div><p className="mt-2 text-xs text-slate-500">{selectedDepartments.length} department(s) selected</p></div><button onClick={() => setSent(true)} disabled={selectedDepartments.length === 0} className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed">Send request</button></>}</div></div></div>}
  </div>;
}
