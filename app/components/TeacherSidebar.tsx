'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { 
  BookOpen, 
  LogOut,
  FileText,
  Users,
  Award
} from 'lucide-react';

interface TeacherSidebarProps {
  isDark: boolean;
  isSidebarOpen: boolean;
  currentPage: 'dashboard' | 'assignments' | 'students' | 'grading';
}

export default function TeacherSidebar({ 
  isDark, 
  isSidebarOpen, 
  currentPage
}: TeacherSidebarProps) {
  const router = useRouter();
  const { signOut } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Users, path: '/teacher/dashboard' },
    { id: 'assignments', label: 'Assignments', icon: FileText, path: '/teacher/assignments' },
    { id: 'students', label: 'Students', icon: Users, path: '/teacher/students' }
  ];

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/auth');
  };

  return (
    <aside className={`fixed left-0 top-0 h-full transition-transform duration-300 z-30 w-64 ${
      isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
    } lg:translate-x-0 ${isDark ? 'bg-slate-800' : 'bg-white'} border-r ${
      isDark ? 'border-slate-700' : 'border-slate-200'
    }`}>
      <div className="p-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-emerald-600 p-2 rounded-xl">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>
              ClassFlow
            </h1>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Teacher Portal
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : isDark 
                    ? 'text-slate-300 hover:bg-slate-700' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <button 
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mt-8 transition-colors ${
            isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
