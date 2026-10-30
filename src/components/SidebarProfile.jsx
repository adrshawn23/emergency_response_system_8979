import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './AppIcon';

// Shared profile block for every role's shell. Shows the REAL account state —
// name, role, avatar, and the authoritative account_status — never hardcoded
// "Administrator"/"Active Account". Click opens a menu with My Profile,
// Account Settings, and Logout. `dark` styles it for the slate-900 sidebars.
//
//   <SidebarProfile profile={profile} signOut={signOut} dark />
//   <SidebarProfile profile={profile} signOut={signOut} compact />  // header variant

const STATUS_STYLE = {
  active: { dot: 'bg-emerald-400', text: 'text-emerald-500', label: 'Active account' },
  pending: { dot: 'bg-amber-400', text: 'text-amber-500', label: 'Pending verification' },
  suspended: { dot: 'bg-red-400', text: 'text-red-500', label: 'Suspended' },
  rejected: { dot: 'bg-red-400', text: 'text-red-500', label: 'Registration rejected' },
};

const Avatar = ({ profile, size = 'h-9 w-9', text = 'text-sm' }) =>
  profile?.avatar_url ? (
    <img src={profile.avatar_url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <div className={`grid ${size} shrink-0 place-items-center rounded-full bg-taste-500 ${text} font-bold text-white`}>
      {profile?.first_name?.[0] || profile?.full_name?.[0] || 'U'}
    </div>
  );

const SidebarProfile = ({ profile, signOut, dark = false, compact = false }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

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

  const status = STATUS_STYLE[profile?.account_status] || STATUS_STYLE.active;
  const go = (path) => { setOpen(false); navigate(path); };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${
          dark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
      >
        <Avatar profile={profile} />
        {!compact && (
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className={`truncate text-sm font-medium ${dark ? 'text-white' : 'text-slate-900'}`}>
              {profile?.full_name || 'User'}
            </p>
            <p className={`text-xs capitalize ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              {profile?.role || 'user'}
            </p>
          </div>
        )}
        <Icon name="ChevronDown" size={14} className={dark ? 'text-slate-500' : 'text-slate-400'} />
      </button>

      {/* Authoritative account status — never a hardcoded "Online" */}
      {!compact && (
        <div className={`mt-1 hidden items-center gap-2 px-2 text-xs sm:flex ${status.text}`}>
          <span className={`h-2 w-2 rounded-full ${status.dot}`}/> {status.label}
        </div>
      )}

      {open && (
        <div role="menu" className={`absolute ${compact ? 'right-0 top-12' : 'bottom-full left-0 mb-2 w-full'} z-50 min-w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 `}>
          <div className="border-b border-slate-100 px-4 py-2">
            <p className="truncate text-sm font-semibold text-slate-900">{profile?.full_name || 'User'}</p>
            <p className={`flex items-center gap-1.5 text-xs capitalize ${status.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`}/>{status.label}
            </p>
          </div>
          <button role="menuitem" onClick={() => go('/profile')}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
            <Icon name="User" size={15}/> My Profile
          </button>
          <button role="menuitem" onClick={() => go('/settings')}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
            <Icon name="Settings" size={15}/> Account Settings
          </button>
          <button role="menuitem" onClick={() => { setOpen(false); signOut?.(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50">
            <Icon name="LogOut" size={15}/> Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default SidebarProfile;
