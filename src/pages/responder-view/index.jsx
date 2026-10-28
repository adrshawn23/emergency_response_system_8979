import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useMockData } from '../../contexts/MockDataContext';
import { supabase } from '../../lib/supabase';

export default function ResponderView() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { reports: allReports, setReports } = useMockData();
  const [assignedReports, setAssignedReports] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white">
              <Icon name="Ambulance" size={21}/>
            </div>
            <div>
              <p className="font-bold">Responder workspace</p>
              <p className="text-xs text-slate-500">On duty</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/profile')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Profile</button>
            <button onClick={() => navigate('/report-management')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Incident queue</button>
            <button onClick={signOut} aria-label="Sign out" title="Sign out" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
              <Icon name="LogOut" size={19}/>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Live assignments</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Response board</h1>
            <p className="mt-2 text-sm text-slate-500">Acknowledge and update your assigned incidents. Dispatch receives every status update.</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500"/>
            Available for dispatch
          </div>
        </div>
        
        {loading ? (
          <div className="text-center text-slate-500">Loading assignments...</div>
        ) : assignedReports.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <Icon name="CheckCircle" size={48} className="text-slate-400 mx-auto mb-4"/>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No active assignments</h3>
            <p className="text-sm text-slate-500">You have no incidents assigned to you at this time.</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {assignedReports.map((report) => (
              <article key={report.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600">
                    <Icon name={report.report_type === 'medical' ? 'HeartPulse' : 'Siren'} size={20}/>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase text-indigo-700">
                    {report.status || 'pending'}
                  </span>
                </div>
                <h3 className="mt-3 font-semibold capitalize">{report.report_type || report.incident_type}</h3>
                <p className="mt-1 text-sm text-slate-600">{report.content || report.description}</p>
                <p className="mt-2 text-xs text-slate-500">{report.attachments?.location || report.location}</p>
                <div className="mt-4 flex gap-2">
                  {report.status === 'assigned' && (
                    <button 
                      onClick={() => updateStatus(report.id, 'in-progress')}
                      className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      Acknowledge
                    </button>
                  )}
                  {report.status === 'in-progress' && (
                    <button 
                      onClick={() => updateStatus(report.id, 'resolved')}
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
    </div>
  );
}
