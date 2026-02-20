'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sun, Moon, Menu, Plus, Search, Filter, MoreVertical, Edit,
  Trash2, Clock, CheckCircle, AlertCircle, Calendar, TrendingUp,
  TrendingDown, ChevronDown, X, Lock, Unlock, FileText, Users, Award,
  GraduationCap
} from 'lucide-react';
import TeacherSidebar from '@/components/TeacherSidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  created_at: string;
  totalStudents: number;
  submitted: number;
  pending: number;
  graded: number;
}

export default function TeacherAssignmentList() {
  const { user } = useAuth();
  const router = useRouter();

  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloseSubmissionModal, setShowCloseSubmissionModal] = useState(false);
  const [showReopenSubmissionModal, setShowReopenSubmissionModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      setError(null);

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          assignment_students (
            student_id,
            status
          ),
          submissions (
            id,
            grade,
            student_id,
            submitted_at
          )
        `)
        .eq('teacher_id', user?.id)
        .order('created_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      const assignmentsWithStats = (assignmentsData || []).map((assignment: any) => {
        const totalStudents = assignment.assignment_students?.length || 0;

        const submittedStudents = assignment.submissions?.filter(
          (s: any) => s.submitted_at !== null && s.submitted_at !== undefined
        ).length || 0;

        const gradedStudents = assignment.submissions?.filter(
          (s: any) => s.grade !== null && s.grade !== undefined
        ).length || 0;

        const isOverdue = new Date(assignment.due_date) < new Date() && assignment.status === 'active';

        return {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          due_date: assignment.due_date,
          status: isOverdue ? 'overdue' : assignment.status,
          created_at: assignment.created_at,
          totalStudents,
          submitted: submittedStudents,
          pending: totalStudents - submittedStudents,
          graded: gradedStudents,
        };
      });

      setAssignments(assignmentsWithStats);
    } catch (err: any) {
      setError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setShowDeleteModal(true);
    setActiveDropdown(null);
  };

  const handleCloseSubmissionClick = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setShowCloseSubmissionModal(true);
    setActiveDropdown(null);
  };

  const handleReopenSubmissionClick = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setShowReopenSubmissionModal(true);
    setActiveDropdown(null);
  };

  const handleEditClick = (assignment: Assignment) => {
    // Block editing closed assignments
    if (assignment.status === 'closed') return;
    router.push(`/teacher/assignment-create?id=${assignment.id}`);
    setActiveDropdown(null);
  };

  const handleGradeClick = (assignment: Assignment) => {
    router.push(`/teacher/grading?assignmentId=${assignment.id}`);
  };

  const handleConfirmDelete = async () => {
    if (!selectedAssignment) return;
    try {
      setDeleting(true);
      const { error } = await supabase.from('assignments').delete().eq('id', selectedAssignment.id);
      if (error) throw error;
      setShowDeleteModal(false);
      setSelectedAssignment(null);
      fetchAssignments();
    } catch (err: any) {
      setError('Failed to delete assignment');
      setDeleting(false);
    }
  };

  const handleConfirmCloseSubmission = async () => {
    if (!selectedAssignment) return;
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ status: 'closed' })
        .eq('id', selectedAssignment.id);
      if (error) throw error;
      setShowCloseSubmissionModal(false);
      setSelectedAssignment(null);
      fetchAssignments();
    } catch (err: any) {
      setError('Failed to close submission');
    }
  };

  const handleConfirmReopenSubmission = async () => {
    if (!selectedAssignment) return;
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ status: 'active' })
        .eq('id', selectedAssignment.id);
      if (error) throw error;
      setShowReopenSubmissionModal(false);
      setSelectedAssignment(null);
      fetchAssignments();
    } catch (err: any) {
      setError('Failed to reopen submission');
    }
  };

  const stats = {
    total: assignments.length,
    active: assignments.filter(a => a.status === 'active').length,
    draft: assignments.filter(a => a.status === 'draft').length,
    pendingReview: assignments.reduce((acc, a) => acc + (a.submitted - a.graded), 0),
    overdue: assignments.filter(a => a.status === 'overdue').length,
  };

  const filteredAssignments = assignments
    .filter(assignment => {
      const matchesSearch =
        assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === 'all' || assignment.status === filterStatus;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'dueDate') return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (sortBy === 'submissions') return b.submitted - a.submitted;
      return 0;
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'draft': return isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200';
      case 'closed': return isDark ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' : 'bg-slate-100 text-slate-600 border-slate-200';
      case 'overdue': return isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200';
      default: return '';
    }
  };

  const getProgressPercentage = (submitted: number, total: number) =>
    total > 0 ? Math.round((submitted / total) * 100) : 0;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const canGrade = (assignment: Assignment) =>
    assignment.status !== 'draft' && assignment.submitted > 0;

  return (
    <ProtectedRoute requiredRole="teacher">
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        <TeacherSidebar isDark={isDark} isSidebarOpen={isSidebarOpen} currentPage="assignments" />

        <main className="lg:ml-64">
          <header className={`sticky top-0 z-20 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b`}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={`p-2 rounded-lg lg:hidden ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div>
                  <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Assignments</h2>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} hidden sm:block`}>
                    Manage and track all your assignments
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={toggleTheme} className={`p-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => router.push('/teacher/assignment-create')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">New Assignment</span>
                </button>
              </div>
            </div>
          </header>

          <div className="p-4 sm:p-6">
            {error && (
              <div className="mb-6 bg-red-500/20 border border-red-500 rounded-xl p-4 flex items-start gap-3">
                <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-500 font-medium">Error</p>
                  <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
                </div>
                <button onClick={() => setError(null)} className="text-red-500 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Total', value: stats.total, icon: <FileText className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} /> },
                { label: 'Active', value: stats.active, icon: <TrendingUp className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} /> },
                { label: 'Drafts', value: stats.draft, icon: <Edit className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} /> },
                { label: 'To Review', value: stats.pendingReview, icon: <AlertCircle className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} /> },
                { label: 'Overdue', value: stats.overdue, icon: <TrendingDown className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-red-400' : 'text-red-600'}`} /> },
              ].map((stat) => (
                <div key={stat.label} className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{stat.label}</p>
                    {stat.icon}
                  </div>
                  <p className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Search and Filters */}
            <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search assignments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-colors ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-500'} focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                  />
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className={`w-full sm:w-auto px-4 py-2.5 rounded-xl border flex items-center gap-2 ${isDark ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600' : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50'}`}
                  >
                    <Filter className="w-4 h-4" />
                    <span className="font-medium">{filterStatus === 'all' ? 'All Status' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showFilterDropdown && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowFilterDropdown(false)} />
                      <div className={`absolute top-full mt-2 right-0 w-48 rounded-xl shadow-lg border z-40 ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                        {['all', 'active', 'draft', 'closed', 'overdue'].map((status) => (
                          <button
                            key={status}
                            onClick={() => { setFilterStatus(status); setShowFilterDropdown(false); }}
                            className={`w-full px-4 py-2.5 text-left first:rounded-t-xl last:rounded-b-xl ${filterStatus === status ? isDark ? 'bg-emerald-600/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700' : isDark ? 'text-slate-300 hover:bg-slate-600' : 'text-slate-700 hover:bg-slate-100'}`}
                          >
                            {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className={`w-full sm:w-auto px-4 py-2.5 rounded-xl border flex items-center gap-2 ${isDark ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600' : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50'}`}
                  >
                    <span className="font-medium">{sortBy === 'recent' ? 'Recent' : sortBy === 'dueDate' ? 'Due Date' : 'Submissions'}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showSortDropdown && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowSortDropdown(false)} />
                      <div className={`absolute top-full mt-2 right-0 w-48 rounded-xl shadow-lg border z-40 ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                        {[{ value: 'recent', label: 'Most Recent' }, { value: 'dueDate', label: 'Due Date' }, { value: 'submissions', label: 'Submissions' }].map((sort) => (
                          <button
                            key={sort.value}
                            onClick={() => { setSortBy(sort.value); setShowSortDropdown(false); }}
                            className={`w-full px-4 py-2.5 text-left first:rounded-t-xl last:rounded-b-xl ${sortBy === sort.value ? isDark ? 'bg-emerald-600/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700' : isDark ? 'text-slate-300 hover:bg-slate-600' : 'text-slate-700 hover:bg-slate-100'}`}
                          >
                            {sort.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-4"></div>
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Loading assignments...</p>
              </div>
            )}

            {!loading && (
              <div className="space-y-4">
                {filteredAssignments.length === 0 ? (
                  <div className={`rounded-xl sm:rounded-2xl p-12 text-center ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <FileText className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>No assignments found</h3>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {searchQuery ? 'Try adjusting your search or filters' : 'Create your first assignment to get started'}
                    </p>
                  </div>
                ) : (
                  filteredAssignments.map((assignment) => (
                    <div key={assignment.id} className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm hover:shadow-md transition-shadow`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{assignment.title}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(assignment.status)}`}>
                              {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                            </span>
                            {/* Closed lock badge */}
                            {assignment.status === 'closed' && (
                              <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            )}
                          </div>
                          <p className={`text-sm mb-3 line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            {assignment.description?.replace(/<[^>]*>/g, '').substring(0, 150)}...
                          </p>
                          <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                Due: {formatDate(assignment.due_date)} at {formatTime(assignment.due_date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{assignment.totalStudents} students</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveDropdown(activeDropdown === assignment.id ? null : assignment.id)}
                            className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          {activeDropdown === assignment.id && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setActiveDropdown(null)} />
                              <div className={`absolute top-full right-0 mt-2 w-52 rounded-xl shadow-lg border z-40 ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                                
                                {/* Edit — disabled/greyed for closed */}
                                {assignment.status === 'closed' ? (
                                  <div className={`w-full px-4 py-2.5 flex items-center gap-3 first:rounded-t-xl cursor-not-allowed opacity-40 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                                    <Edit className="w-4 h-4" /> Edit
                                    <span className="ml-auto text-xs">(Locked)</span>
                                  </div>
                                ) : (
                                  <button onClick={() => handleEditClick(assignment)} className={`w-full px-4 py-2.5 text-left flex items-center gap-3 first:rounded-t-xl ${isDark ? 'text-slate-300 hover:bg-slate-600' : 'text-slate-700 hover:bg-slate-100'}`}>
                                    <Edit className="w-4 h-4" /> Edit
                                  </button>
                                )}

                                {canGrade(assignment) && (
                                  <button onClick={() => { handleGradeClick(assignment); setActiveDropdown(null); }} className={`w-full px-4 py-2.5 text-left flex items-center gap-3 ${isDark ? 'text-slate-300 hover:bg-slate-600' : 'text-slate-700 hover:bg-slate-100'}`}>
                                    <GraduationCap className="w-4 h-4" /> Grade Students
                                  </button>
                                )}

                                {/* Close Submission — only for active/overdue */}
                                {(assignment.status === 'active' || assignment.status === 'overdue') && (
                                  <button onClick={() => handleCloseSubmissionClick(assignment)} className={`w-full px-4 py-2.5 text-left flex items-center gap-3 ${isDark ? 'text-slate-300 hover:bg-slate-600' : 'text-slate-700 hover:bg-slate-100'}`}>
                                    <Lock className="w-4 h-4" /> Close Submission
                                  </button>
                                )}

                                {/* Reopen Submission — only for closed */}
                                {assignment.status === 'closed' && (
                                  <button onClick={() => handleReopenSubmissionClick(assignment)} className={`w-full px-4 py-2.5 text-left flex items-center gap-3 ${isDark ? 'text-emerald-400 hover:bg-slate-600' : 'text-emerald-700 hover:bg-slate-100'}`}>
                                    <Unlock className="w-4 h-4" /> Reopen Submission
                                  </button>
                                )}

                                <button onClick={() => handleDeleteClick(assignment)} className={`w-full px-4 py-2.5 text-left flex items-center gap-3 last:rounded-b-xl ${isDark ? 'text-red-400 hover:bg-slate-600' : 'text-red-600 hover:bg-slate-100'}`}>
                                  <Trash2 className="w-4 h-4" /> Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {assignment.status !== 'draft' && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Submission Progress</span>
                            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{assignment.submitted}/{assignment.totalStudents}</span>
                          </div>
                          <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${getProgressPercentage(assignment.submitted, assignment.totalStudents)}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Stats Row + Grade Button */}
                      {assignment.status !== 'draft' && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="grid grid-cols-3 gap-4 flex-1">
                            <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                                <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Submitted</span>
                              </div>
                              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{assignment.submitted}</p>
                            </div>
                            <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                                <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Pending</span>
                              </div>
                              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{assignment.pending}</p>
                            </div>
                            <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <Award className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                                <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Graded</span>
                              </div>
                              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{assignment.graded}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleGradeClick(assignment)}
                            className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-colors whitespace-nowrap ${
                              assignment.submitted > 0
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : isDark
                                ? 'bg-slate-700 text-slate-400 cursor-default'
                                : 'bg-slate-100 text-slate-400 cursor-default'
                            }`}
                            disabled={assignment.submitted === 0}
                          >
                            <GraduationCap className="w-4 h-4" />
                            {assignment.graded < assignment.submitted ? 'Grade Students' : 'View Grades'}
                          </button>
                        </div>
                      )}

                      {assignment.status === 'draft' && (
                        <div className={`rounded-lg p-4 border ${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
                          <p className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                            This assignment is saved as a draft. Click Edit to continue working on it or publish it to students.
                          </p>
                        </div>
                      )}

                      {/* Closed notice */}
                      {assignment.status === 'closed' && (
                        <div className={`rounded-lg p-4 border flex items-center gap-3 ${isDark ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                          <Lock className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Submissions are closed. Students can no longer submit or edit. Use "Reopen Submission" to allow submissions again.
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>

        {/* Delete Modal */}
        {showDeleteModal && selectedAssignment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`rounded-2xl max-w-md w-full p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-red-500/20 p-2 rounded-xl"><Trash2 className="w-6 h-6 text-red-500" /></div>
                  <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Delete Assignment</h3>
                </div>
                <button onClick={() => setShowDeleteModal(false)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-6">
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Are you sure you want to delete this assignment? This action cannot be undone.</p>
                <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                  <p className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedAssignment.title}</p>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{selectedAssignment.totalStudents} students • Due {formatDate(selectedAssignment.due_date)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className={`flex-1 py-3 px-4 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} disabled:opacity-50`}>Cancel</button>
                <button onClick={handleConfirmDelete} disabled={deleting} className="flex-1 py-3 px-4 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 flex items-center justify-center gap-2">
                  {deleting ? <><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>Deleting...</> : 'Delete Assignment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close Submission Modal */}
        {showCloseSubmissionModal && selectedAssignment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`rounded-2xl max-w-md w-full p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500/20 p-2 rounded-xl"><Lock className="w-6 h-6 text-amber-500" /></div>
                  <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Close Submission</h3>
                </div>
                <button onClick={() => setShowCloseSubmissionModal(false)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-6">
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Are you sure you want to close submissions? Students will no longer be able to submit or edit their work.</p>
                <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                  <p className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedAssignment.title}</p>
                  <p className={`text-sm mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Due {formatDate(selectedAssignment.due_date)} at {formatTime(selectedAssignment.due_date)}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{selectedAssignment.submitted} submitted</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{selectedAssignment.pending} pending</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowCloseSubmissionModal(false)} className={`flex-1 py-3 px-4 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Cancel</button>
                <button onClick={handleConfirmCloseSubmission} className="flex-1 py-3 px-4 rounded-xl font-medium bg-amber-500 hover:bg-amber-600 text-white">Close Submission</button>
              </div>
            </div>
          </div>
        )}

        {/* Reopen Submission Modal */}
        {showReopenSubmissionModal && selectedAssignment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`rounded-2xl max-w-md w-full p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/20 p-2 rounded-xl"><Unlock className="w-6 h-6 text-emerald-500" /></div>
                  <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Reopen Submission</h3>
                </div>
                <button onClick={() => setShowReopenSubmissionModal(false)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-6">
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  This will reopen the assignment and allow students to submit or edit their work again. The status will be set back to <strong>Active</strong>.
                </p>
                <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                  <p className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedAssignment.title}</p>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{selectedAssignment.totalStudents} students • {selectedAssignment.submitted} submitted</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowReopenSubmissionModal(false)} className={`flex-1 py-3 px-4 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Cancel</button>
                <button onClick={handleConfirmReopenSubmission} className="flex-1 py-3 px-4 rounded-xl font-medium bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2">
                  <Unlock className="w-4 h-4" /> Reopen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
