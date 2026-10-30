import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './AppIcon';
import useNotifications from '../hooks/useNotifications';

const timeAgo = (iso) => {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const TYPE_ICON = {
  new_incident: 'Siren',
  incident_status: 'RefreshCw',
  assignment: 'UserCheck',
  verification_decision: 'ShieldCheck',
  pending_registration: 'UserPlus',
  info: 'Bell',
};

// Shared notification bell for every role. Self-manages fetch, realtime,
// unread count, and read state. `onOpenIncident(reportId)` lets a host page
// deep-link a notification to its incident modal.
const NotificationBell = ({ userId, onOpenIncident }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const { notifications, unreadCount, loading, error, markRead, markAllRead, refresh } =
    useNotifications(userId);

  // Outside click + Escape close.
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openNotification = (n) => {
    if (!n.read_at) markRead(n.id);
    if (n.incident_id && onOpenIncident) {
      onOpenIncident(n.incident_id);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-taste-500"
      >
        <Icon name="Bell" size={18}/>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white ">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-semibold text-taste-500 hover:underline">
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>}
            {!loading && error && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-slate-500">Notifications are unavailable right now.</p>
                <button onClick={refresh} className="mt-2 text-xs font-semibold text-taste-500 hover:underline">Try again</button>
              </div>
            )}
            {!loading && !error && notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">You're all caught up.</p>
            )}
            {!loading && !error && notifications.map((n) => (
              <button
                key={n.id}
                role="menuitem"
                onClick={() => openNotification(n)}
                className={`flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${!n.read_at ? 'bg-taste-50/40' : ''}`}
              >
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${!n.read_at ? 'bg-taste-100 text-taste-500' : 'bg-slate-100 text-slate-400'}`}>
                  <Icon name={TYPE_ICON[n.type] || 'Bell'} size={14}/>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${!n.read_at ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'}`}>{n.title || 'Notification'}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(n.created_at)}</span>
                  </span>
                  {n.message && <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{n.message}</span>}
                </span>
                {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-taste-500" aria-label="unread"/>}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setOpen(false); navigate('/notifications'); }}
            className="w-full border-t border-slate-100 px-4 py-2.5 text-center text-xs font-semibold text-taste-500 hover:bg-slate-50"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
