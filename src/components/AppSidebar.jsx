import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from './AppIcon';
import SidebarProfile from './SidebarProfile';

/**
 * Shared app sidebar: brand header, role-scoped nav links, profile card,
 * and the mobile bottom bar. Active state follows the current route, so a
 * link only lights up while you are on its page.
 *
 *   <AppSidebar links={[{ label, icon, path, badge? }]} profile={profile} signOut={signOut} />
 */
const AppSidebar = ({ links = [], profile, signOut }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col overflow-x-hidden border-r border-slate-300 bg-[#f9fbfc] text-slate-600 sm:flex sm:w-72">
        <div className="flex h-20 items-center justify-center gap-3 border-b border-slate-200 px-3 sm:justify-start sm:px-7">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-600 text-white">
            <Icon name="Siren" size={22} />
          </div>
          <div className="hidden sm:block">
            <p className="font-semibold tracking-tight text-slate-900">Kalubihan</p>
            <p className="text-xs text-slate-500">Emergency Command</p>
          </div>
        </div>
        <div className="flex-1 px-3 py-7 sm:px-4">
          <p className="mb-3 hidden px-3 text-[13px] font-medium text-slate-500 sm:block">Operations</p>
          <nav className="space-y-1">
            {links.map(link => (
              <button
                key={link.label}
                title={link.label}
                onClick={() => navigate(link.path)}
                className={`flex w-full items-center justify-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition sm:justify-start ${
                  isActive(link.path)
                    ? 'bg-[#ebedee] font-medium text-slate-900'
                    : 'text-slate-600 hover:bg-[#ebedee] hover:text-slate-900'
                }`}
              >
                <Icon name={link.icon} size={18} />
                <span className="hidden flex-1 sm:block">{link.label}</span>
                {link.badge ? (
                  <span className="hidden rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white sm:block">
                    {link.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </div>
        <div className="m-3 rounded-lg border border-slate-200 bg-white p-3 sm:m-4 sm:p-4">
          <SidebarProfile profile={profile} signOut={signOut} />
        </div>
      </aside>
      <nav className="fixed bottom-0 inset-x-0 z-40 flex overflow-x-auto border-t border-slate-300 bg-[#f9fbfc] py-1 sm:hidden">
        {links.map(link => (
          <button
            key={link.label}
            onClick={() => navigate(link.path)}
            className={`flex shrink-0 flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] ${
              isActive(link.path) ? 'text-slate-900 font-medium' : 'text-slate-500'
            }`}
          >
            <Icon name={link.icon} size={20} />
            <span>{link.label}</span>
          </button>
        ))}
        <button
          aria-label="Sign out"
          onClick={signOut}
          className="flex shrink-0 flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] text-slate-500"
        >
          <Icon name="LogOut" size={20} />
          <span>Sign out</span>
        </button>
      </nav>
    </>
  );
};

export default AppSidebar;
