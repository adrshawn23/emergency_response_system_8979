import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useMockData } from './MockDataContext';
import { mockUsers } from '../data/mockData';

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const { useMock, mockAuth } = useMockData();
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
    if (useMock) {
      // Mock mode: Check for stored mock session
      const storedSession = localStorage.getItem('mock_session');
      if (storedSession) {
        const session = JSON.parse(storedSession);
        setUser(session.user);
        setProfile(session.profile);
      }
      setLoading(false);
      return;
    }

    // Real Supabase mode
    supabase?.auth?.getSession()?.then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session?.user)
        }
        setLoading(false)
      })

    const { data: { subscription } } = supabase?.auth?.onAuthStateChange(handleAuthStateChange)

    return () => subscription?.unsubscribe()
  }, [useMock])

  useEffect(() => {
    if (!user) return;
    
    if (useMock) {
      // Mock mode: Find profile from mock data
      const mockProfile = mockUsers.find(u => u.id === user.id);
      setProfile(mockProfile || null);
      return;
    }

    // Real Supabase mode
    supabase.from('user_profiles').select('*, department:departments(*)').eq('id', user.id).single()
      .then(({ data }) => setProfile(data || null));
  }, [user, useMock])

  const value = {
    user,
    profile,
    loading,
    signUp: async (email, password, userData = {}) => {
      if (useMock) {
        return await mockAuth.signUp(email, password, userData);
      }
      
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
      if (useMock) {
        const result = await mockAuth.signIn(email, password);
        if (result.data?.user) {
          const mockProfile = mockUsers.find(u => u.id === result.data.user.id);
          localStorage.setItem('mock_session', JSON.stringify({
            user: result.data.user,
            profile: mockProfile
          }));
          setUser(result.data.user);
          setProfile(mockProfile);
        }
        return result;
      }
      
      const { data, error } = await supabase?.auth?.signInWithPassword({
        email,
        password
      });
      return { data, error };
    },
    signOut: async () => {
      if (useMock) {
        localStorage.removeItem('mock_session');
        setUser(null);
        setProfile(null);
        return { error: null };
      }
      
      const { error } = await supabase?.auth?.signOut();
      localStorage.clear();
      sessionStorage.clear();
      return { error };
    },
    getCurrentUserProfile: async () => {
      if (!user) return { data: null, error: null };
      
      if (useMock) {
        const mockProfile = mockUsers.find(u => u.id === user.id);
        return { data: mockProfile, error: null };
      }
      
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