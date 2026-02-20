'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth error:', error);
          router.push('/auth?error=authentication_failed');
          return;
        }

        if (!session) {
          router.push('/auth');
          return;
        }

        const userId = session.user.id;
        const userEmail = session.user.email;

        // Get role from localStorage (set before OAuth redirect)
        const selectedRole = localStorage.getItem('pending_user_role') as 'teacher' | 'student' | null;

        if (!selectedRole) {
          console.error('No role found in localStorage');
          router.push('/auth?error=role_not_found');
          return;
        }

        console.log('Creating/checking profile for role:', selectedRole);

        // Check if profile already exists
        const { data: existingProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          // Error other than "not found"
          console.error('Profile fetch error:', fetchError);
          router.push('/auth?error=profile_fetch_failed');
          return;
        }

        let userRole: 'teacher' | 'student';

        if (!existingProfile) {
          console.log('Creating new profile with role:', selectedRole);
          
          // Create new profile with the selected role
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email: userEmail,
              full_name: session.user.user_metadata?.full_name || 
                        session.user.user_metadata?.name || 
                        null,
              role: selectedRole,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (insertError) {
            console.error('Profile creation error:', insertError);
            router.push('/auth?error=profile_creation_failed');
            return;
          }

          console.log('Profile created successfully:', newProfile);
          userRole = selectedRole;
          
          // Wait a moment for the database to sync
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.log('Profile already exists:', existingProfile);
          userRole = existingProfile.role;
        }

        // Clean up localStorage
        localStorage.removeItem('pending_user_role');

        // Force a session refresh to ensure useAuth picks up the changes
        await supabase.auth.refreshSession();

        // Small delay to let the auth state propagate
        await new Promise(resolve => setTimeout(resolve, 300));

        // Redirect based on the role
        console.log('Redirecting to dashboard for role:', userRole);
        if (userRole === 'teacher') {
          router.push('/teacher/dashboard');
        } else {
          router.push('/student/dashboard');
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        router.push('/auth?error=unexpected_error');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-white text-lg">Setting up your account...</p>
        <p className="text-slate-400 text-sm mt-2">Please wait</p>
      </div>
    </div>
  );
}
