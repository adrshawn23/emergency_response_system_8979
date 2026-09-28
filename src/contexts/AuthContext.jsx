import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({})

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
    // Get initial session - Use Promise chain
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
    supabase.from('user_profiles').select('*, department:departments(*)').eq('id', user.id).single()
      .then(({ data }) => setProfile(data || null));
  }, [user])


  const value = {
    user,
    profile,
    loading,
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
      localStorage.clear();
      sessionStorage.clear();
      return { error };
    },
    getCurrentUserProfile: async () => {
      if (!user) return { data: null, error: null };
      
      const { data, error } = await supabase?.from('user_profiles')?.select('*, department:departments(*)')?.eq('id', user?.id)?.single();
      
      return { data, error };
    }
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
