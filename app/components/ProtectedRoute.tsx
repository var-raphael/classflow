'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'teacher' | 'student';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      // Not logged in - redirect to auth
      if (!user) {
        router.push('/auth');
        return;
      }

      // Wait for profile to load
      if (!profile) {
        return;
      }

      // Check role mismatch
      if (requiredRole && profile.role !== requiredRole) {
        console.log(`Role mismatch: User is ${profile.role}, page requires ${requiredRole}`);
        
        // Redirect to correct dashboard
        if (profile.role === 'teacher') {
          router.replace('/teacher/dashboard');
        } else {
          router.replace('/student/dashboard');
        }
      }
    }
  }, [user, profile, loading, requiredRole, router, pathname]);

  // Show loading while auth is loading OR profile hasn't loaded yet
  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in - don't show anything
  if (!user) {
    return null;
  }

  // Profile not loaded - don't show anything
  if (!profile) {
    return null;
  }

  // Wrong role - don't show anything (redirect will happen)
  if (requiredRole && profile.role !== requiredRole) {
    return null;
  }

  // All good - show the page
  return <>{children}</>;
}
