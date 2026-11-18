import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({})

// Fallback role matrix — rows in public.page_permissions (edited from the
// admin Access control page) override these live. Pages missing from both
// are treated as open, matching the old hardcoded-gate semantics.
export const DEFAULT_PAGE_ROLES = {
  command: ['admin', 'dispatcher', 'responder', 'resident'],
  queue: ['admin', 'dispatcher', 'responder', 'department_admin', 'resident'],
  new: ['admin', 'dispatcher', 'responder', 'resident'],
  residents: ['admin'],
  access: ['admin'],
  departments: ['admin'],
  reports: ['admin', 'dispatcher'],
  announcements: ['admin', 'resident'],
  contacts: ['admin', 'dispatcher', 'responder', 'resident', 'department_admin'],
  profile: ['admin', 'dispatcher', 'responder', 'resident', 'department_admin'],
};

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // Separate from `profile`: a signed-in user whose user_profiles row is
  // missing still counts as loaded — the gate waits for the FETCH, not a row.
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [pageRoles, setPageRoles] = useState(DEFAULT_PAGE_ROLES)

  // ⚠️ PROTECTED FUNCTION - DO NOT MODIFY OR ADD ASYNC OPERATIONS
  // This is a Supabase auth state change listener that must remain synchronous
  const handleAuthStateChange = (event, session) => {
    // SYNC OPERATIONS ONLY - NO ASYNC/AWAIT ALLOWED
    if (session?.user) {
      setUser(session?.user)
    } else {
      setUser(null)
      setProfile(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase?.auth?.getSession()?.then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session?.user)
        }
        setLoading(false)
      })

    const { data: { subscription } } = supabase?.auth?.onAuthStateChange(handleAuthStateChange)

    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return;

    setProfileLoaded(false);
    const fetchProfile = () =>
      supabase.from('user_profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data || null))
        .finally(() => setProfileLoaded(true));

    fetchProfile();

    // Realtime: role / status / account_status edits made by an admin apply
    // to this live session without requiring a re-login.
    const channel = supabase
      .channel(`user_profile:${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_profiles',
        filter: `id=eq.${user.id}`
      }, payload => setProfile(payload.new))
      .subscribe();

    return () => supabase.removeChannel(channel);
    // Depend on the id, not the object — onAuthStateChange hands a new user
    // object on every event (login, token refresh); re-running this would
    // flicker profileLoaded and remount the entire protected tree.
  }, [user?.id])

  // Page-permission matrix: admin edits push to every live session in
  // realtime so a role's sidebar/route access changes without re-login.
  useEffect(() => {
    if (!user) return;

    const loadPageRoles = async () => {
      const { data } = await supabase.from('page_permissions').select('page_key, allowed_roles');
      if (data?.length) {
        setPageRoles(prev => ({
          ...prev,
          ...Object.fromEntries(data.map(r => [r.page_key, r.allowed_roles || []])),
        }));
      }
    };

    loadPageRoles();

    const channel = supabase
      .channel('page_permissions_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'page_permissions' }, loadPageRoles)
      .subscribe();

    return () => supabase.removeChannel(channel);
    // Id-only dep — same-user auth events shouldn't resubscribe this channel.
  }, [user?.id])

  // Admin bypasses every gate (prevents self-lockout); unknown pages stay open.
  const canAccessPage = (pageKey, role) => {
    if (!role) return false;
    if (role === 'admin') return true;
    const allowed = pageRoles[pageKey];
    return allowed ? allowed.includes(role) : true;
  };

  const value = {
    user,
    profile,
    profileLoaded,
    loading,
    pageRoles,
    canAccessPage,
    signUp: async (email, password, userData = {}) => {
      const { data, error } = await supabase?.auth?.signUp({
        email,
        password,
        options: {
          data: userData,
          emailRedirectTo: window.location.origin
        }
      });
      return { data, error };
    },
    signIn: async (email, password) => {
      const { data, error } = await supabase?.auth?.signInWithPassword({
        email,
        password
      });
      return { data, error };
    },
    signOut: async () => {
      const { error } = await supabase?.auth?.signOut();
      // Scope the wipe to auth/session keys — a blanket clear() also deletes
      // unrelated data such as an unsent incident draft.
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') || k.startsWith('supabase') || k.startsWith('ers.'))
        .forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
      setUser(null);
      setProfile(null);
      setProfileLoaded(false);
      return { error };
    },
    getCurrentUserProfile: async () => {
      if (!user) return { data: null, error: null };

      const { data, error } = await supabase?.from('user_profiles')?.select('*')?.eq('id', user?.id)?.single();
      
      return { data, error };
    },
    // Refetch and store the caller's profile row (used after profile edits).
    refreshProfile: async () => {
      if (!user) return null;
      const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data);
      return data;
    }
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}