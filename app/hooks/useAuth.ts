'use client';

import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'teacher' | 'student';
  created_at: string;
  updated_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, retryCount = 0) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If profile doesn't exist yet and we haven't retried too many times
        if (error.code === 'PGRST116' && retryCount < 3) {
          console.log(`Profile not found, retrying in ${(retryCount + 1) * 500}ms...`);
          // Wait and retry (profile might be getting created by callback)
          setTimeout(() => {
            fetchProfile(userId, retryCount + 1);
          }, (retryCount + 1) * 500);
          return;
        }
        
        // If it's a different error or we've retried too many times
        if (error.code === 'PGRST116') {
          console.log('Profile does not exist yet - will be created by callback');
        } else {
          console.error('Error fetching profile:', error);
        }
        
        setLoading(false);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (role: 'teacher' | 'student') => {
    try {
      // IMPORTANT: Store role in localStorage BEFORE OAuth redirect
      localStorage.setItem('pending_user_role', role);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        // Clean up on error
        localStorage.removeItem('pending_user_role');
        throw error;
      }
      return { data, error: null };
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      localStorage.removeItem('pending_user_role');
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setProfile(null);
      setSession(null);
      router.push('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
      return { data, error: null };
    } catch (error: any) {
      console.error('Error updating profile:', error);
      return { data: null, error };
    }
  };

  return {
    user,
    profile,
    session,
    loading,
    signInWithGoogle,
    signOut,
    updateProfile,
    isTeacher: profile?.role === 'teacher',
    isStudent: profile?.role === 'student',
  };
}
