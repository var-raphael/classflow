'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sun, Moon, FileText, Award, Menu, CheckCircle,
  Clock, XCircle, Calendar, Search, Filter,
  ChevronDown, Eye, AlertCircle, FileEdit, Lock
} from 'lucide-react';
import StudentSidebar from '@/components/StudentSidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  teacher_name: string;
  status: string;
  assignmentStatus: string; // raw status from assignments table
  grade: number | null;
  submitted_at: string | null;
}

export default function StudentAssignmentList() {
  const { user } = useAuth();
  const router = useRouter();

  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setIsDark(true);
  }, []);

  useEffect(() => {
    if (user) fetchAssignments();
  }, [user]);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);

      const { data: assignedData, error: assignedError } = await supabase
        .from('assignment_students')
        .select(`
          assignment_id,
          assignments (
            id,
            title,
            description,
            due_date,
            status,
            teacher_id
          )
        `)
        .eq('student_id', user?.id);

      if (assignedError) console.error('Error fetching assignments:', assignedError);
      if (!assignedData || assignedData.length === 0) {
        setAssignments([]);
        return;
      }

      const { data: submissionsData } = await supabase
        .from('submissions')
        .select('assignment_id, grade, submitted_at')
        .eq('student_id', user?.id);

      const submissionMap = new Map(
        (submissionsData || []).map((s: any) => [s.assignment_id, s])
      );

      const teacherIds = [
        ...new Set(assignedData.map((a: any) => a.assignments?.teacher_id).filter(Boolean))
      ] as string[];

      let teacherMap = new Map<string, string>();
      if (teacherIds.length > 0) {
        const { data: teachersData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', teacherIds);
        (teachersData || []).forEach((t: any) => {
          teacherMap.set(t.id, t.full_name || t.email || 'Unknown Teacher');
        });
      }

      const now = new Date();
      const assignmentsList = assignedData
        .filter((a: any) => a.assignments !== null)
        .map((a: any) => {
          const assignment = a.assignments;
          if (!assignment) return null;

          const submission = submissionMap.get(assignment.id);
          const dueDate = new Date(assignment.due_date);
          const isOverdue = !submission?.submitted_at && dueDate < now;
          const teacherName = teacherMap.get(assignment.teacher_id) || 'Unknown Teacher';
          const assignmentStatus = assignment.status; // 'active', 'closed', 'draft', etc.

          // Determine display status
          let status = 'pending';
          if (assignmentStatus === 'closed' && !submission?.submitted_at) {
            status = 'locked'; // closed and not submitted = locked
          } else if (submission) {
            if (submission.grade !== null && submission.grade !== undefined) {
              status = 'graded';
            } else if (submission.submitted_at) {
              status = 'submitted';
            } else {
              status = 'draft';
            }
          } else if (isOverdue) {
            status = 'overdue';
          }

          return {
            id: assignment.id,
            title: assignment.title,
            description: assignment.description || '',
            due_date: assignment.due_date,
            teacher_name: teacherName,
            assignmentStatus,
            status,
            grade: submission?.grade ?? null,
            submitted_at: submission?.submitted_at ?? null,
          };
        })
        .filter(Boolean) as Assignment[];

      setAssignments(assignmentsList);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'graded': return isDark ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'submitted': return isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'draft': return isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200';
      case 'pending': return isDark ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200';
      case 'overdue': return isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200';
      case 'locked': return isDark ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' : 'bg-slate-100 text-slate-600 border-slate-300';
      default: return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'graded': return <Award className="w-4 h-4" />;
      case 'submitted': return <CheckCircle className="w-4 h-4" />;
      case 'draft': return <FileEdit className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'overdue': return <XCircle className="w-4 h-4" />;
      case 'locked': return <Lock className="w-4 h-4" />;
      default: return null;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  };

  const getButtonConfig = (assignment: Assignment) => {
    if (assignment.status === 'locked') {
      return { label: 'Submissions Closed', disabled: true, icon: <Lock className="w-4 h-4" /> };
    }
    if (assignment.status === 'draft') {
      return { label: 'Continue Draft', disabled: false, icon: <Eye className="w-4 h-4" /> };
    }
    return { label: 'View Details', disabled: false, icon: <Eye className="w-4 h-4" /> };
  };

  const filteredAssignments = assignments
    .filter(a => {
      const matchesSearch =
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.teacher_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch && (filterStatus === 'all' || a.status === filterStatus);
    })
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const stats = {
    all: assignments.length,
    pending: assignments.filter(a => a.status === 'pending').length,
    draft: assignments.filter(a => a.status === 'draft').length,
    submitted: assignments.filter(a => a.status === 'submitted').length,
    graded: assignments.filter(a => a.status === 'graded').length,
    overdue: assignments.filter(a => a.status === 'overdue').length,
    locked: assignments.filter(a => a.status === 'locked').length,
  };

  return (
    <ProtectedRoute requiredRole="student">
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        <StudentSidebar isDark={isDark} isSidebarOpen={isSidebarOpen} currentPage="assignments" />

        <main className="lg:ml-64">
          <header className={`sticky top-0 z-20 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b`}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4">
              <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg lg:hidden ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}>
                  <Menu className="w-5 h-5" />
                </button>
                <div>
                  <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>My Assignments</h2>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} hidden sm:block`}>
                    {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''} found
                  </p>
                </div>
              </div>
              <button onClick={toggleTheme} className={`p-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </header>

          <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: 'All', count: stats.all, key: 'all' },
                { label: 'Pending', count: stats.pending, key: 'pending' },
                { label: 'Draft', count: stats.draft, key: 'draft' },
                { label: 'Submitted', count: stats.submitted, key: 'submitted' },
                { label: 'Graded', count: stats.graded, key: 'graded' },
                { label: 'Overdue', count: stats.overdue, key: 'overdue' },
                { label: 'Locked', count: stats.locked, key: 'locked' },
              ].map((stat) => (
                <button
                  key={stat.key}
                  onClick={() => setFilterStatus(stat.key)}
                  className={`p-3 sm:p-4 rounded-xl transition-colors ${
                    filterStatus === stat.key
                      ? isDark ? 'bg-slate-700 border-2 border-indigo-600' : 'bg-indigo-50 border-2 border-indigo-600'
                      : isDark ? 'bg-slate-800 border-2 border-transparent hover:bg-slate-700' : 'bg-white border-2 border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className={`text-xl sm:text-2xl font-bold mb-1 ${
                    stat.key === 'locked' ? isDark ? 'text-slate-400' : 'text-slate-500' : isDark ? 'text-white' : 'text-slate-900'
                  }`}>{stat.count}</div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{stat.label}</div>
                </button>
              ))}
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search assignments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'} focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                />
              </div>
              <div className="relative sm:w-48">
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`w-full px-4 py-2.5 rounded-xl border flex items-center justify-between text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <span className="font-medium">{filterStatus === 'all' ? 'All Status' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}</span>
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showFilterDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                    <div className={`absolute top-full mt-2 left-0 right-0 rounded-xl shadow-lg border z-20 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      {['all', 'pending', 'draft', 'submitted', 'graded', 'overdue', 'locked'].map((status) => (
                        <button
                          key={status}
                          onClick={() => { setFilterStatus(status); setShowFilterDropdown(false); }}
                          className={`w-full px-4 py-2.5 text-left text-sm first:rounded-t-xl last:rounded-b-xl ${filterStatus === status ? isDark ? 'bg-indigo-600/20 text-indigo-400' : 'bg-indigo-50 text-indigo-700' : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'}`}
                        >
                          {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            )}

            {!loading && (
              <div className="space-y-3">
                {filteredAssignments.length === 0 ? (
                  <div className={`rounded-xl sm:rounded-2xl p-12 text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                    <FileText className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                    <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>No assignments found</h3>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {searchQuery ? 'Try adjusting your search or filters' : 'No assignments have been assigned to you yet'}
                    </p>
                  </div>
                ) : (
                  filteredAssignments.map((assignment) => {
                    const btnConfig = getButtonConfig(assignment);
                    return (
                      <div key={assignment.id} className={`rounded-xl p-4 sm:p-6 shadow-sm transition-shadow ${
                        assignment.status === 'locked'
                          ? isDark ? 'bg-slate-800/60 opacity-80' : 'bg-white opacity-80'
                          : isDark ? 'bg-slate-800 hover:shadow-md' : 'bg-white hover:shadow-md'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3 mb-2">
                              {assignment.status === 'overdue' && <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                              {assignment.status === 'locked' && <Lock className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />}
                              <div className="flex-1 min-w-0">
                                <h3 className={`text-base sm:text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{assignment.title}</h3>
                                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm mb-2">
                                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{assignment.teacher_name}</span>
                                </div>
                                <p className={`text-xs sm:text-sm line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {assignment.description.replace(/<[^>]*>/g, '').substring(0, 150) || 'No description'}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex sm:flex-col items-start sm:items-end gap-2 sm:gap-3">
                            <span className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border flex items-center gap-1.5 whitespace-nowrap ${getStatusColor(assignment.status)}`}>
                              {getStatusIcon(assignment.status)}
                              {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                            </span>
                            {assignment.grade !== null && (
                              <div className={`px-3 py-1.5 rounded-lg font-bold text-sm sm:text-base ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                {assignment.grade}%
                              </div>
                            )}
                          </div>
                        </div>

                        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <Calendar className={`w-4 h-4 ${assignment.status === 'overdue' ? 'text-red-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                            <span className={assignment.status === 'overdue' ? 'text-red-500 font-medium' : isDark ? 'text-slate-400' : 'text-slate-600'}>
                              {formatDate(assignment.due_date)}
                            </span>
                          </div>

                          {/* Locked notice inline */}
                          {assignment.status === 'locked' && (
                            <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                              <Lock className="w-3 h-3" />
                              Teacher closed submissions
                            </div>
                          )}

                          <button
                            onClick={() => !btnConfig.disabled && router.push(`/student/assignment-submit/${assignment.id}`)}
                            disabled={btnConfig.disabled}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors text-sm font-medium ${
                              btnConfig.disabled
                                ? isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                          >
                            {btnConfig.icon}
                            {btnConfig.label}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
