import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import useNotifications from '../../hooks/useNotifications';

const TYPE_ICON = {
  new_incident: 'Siren',
  incident_status: 'RefreshCw',
  assignment: 'UserCheck',
  verification_decision: 'ShieldCheck',
  pending_registration: 'UserPlus',
  info: 'Bell',
};

// Full notifications list — shared across every role. Same data source and
// read-state mutations as the header bell.
export default function NotificationsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { notifications, unreadCount, loading, error, markRead, markAllRead, refresh } =
    useNotifications(profile?.id);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <button onClick={() => navigate(-1)} aria-label="Back" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <Icon name="ArrowLeft" size={18}/>
          </button>
          <h1 className="font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="ml-auto text-xs font-semibold text-taste-500 hover:underline">
              Mark all as read ({unreadCount})
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-6">
        {loading && <p className="py-12 text-center text-sm text-slate-400">Loading…</p>}
        {!loading && error && (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-500">Notifications are unavailable right now.</p>
            <button onClick={refresh} className="mt-2 text-sm font-semibold text-taste-500 hover:underline">Try again</button>
          </div>
        )}
        {!loading && !error && notifications.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-400">No notifications yet.</p>
        )}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {!loading && !error && notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.read_at && markRead(n.id)}
              className={`flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-50 ${!n.read_at ? 'bg-taste-50/40' : ''}`}
            >
              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${!n.read_at ? 'bg-taste-100 text-taste-500' : 'bg-slate-100 text-slate-400'}`}>
                <Icon name={TYPE_ICON[n.type] || 'Bell'} size={15}/>
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${!n.read_at ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'}`}>{n.title || 'Notification'}</span>
                {n.message && <span className="mt-0.5 block text-sm text-slate-500">{n.message}</span>}
                <span className="mt-1 block text-xs text-slate-400">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</span>
              </span>
              {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-taste-500"/>}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
