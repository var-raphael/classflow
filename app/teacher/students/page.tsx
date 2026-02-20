'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Sun,
  Moon,
  Menu,
  Plus,
  Search,
  Filter,
  ChevronDown,
  Mail,
  Trash2,
  Eye,
  Award,
  FileText,
  TrendingUp,
  TrendingDown,
  X,
  UserPlus,
  Download,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import TeacherSidebar from '@/components/TeacherSidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

interface Student {
  id: string;
  name: string;
  email: string;
  joinedDate: string;
  totalAssignments: number;
  submitted: number;
  averageGrade: number | null;
  trend: 'up' | 'down';
  status: string;
  lastActivity: string;
}

// FIX: profiles is an array returned by Supabase joins
interface TeacherStudentData {
  added_at: string;
  profiles: {
    id: string;
    email: string;
    full_name: string | null;
  }[];
}

export default function TeacherStudentManagement() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingStudent, setAddingStudent] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<Student | null>(null);
  const [removingStudent, setRemovingStudent] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setIsDark(true);
  }, []);

  useEffect(() => {
    if (user) fetchStudents();
  }, [user]);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: teacherStudents, error: studentsError } = await supabase
        .from('teacher_students')
        .select(`
          added_at,
          profiles:student_id (
            id,
            email,
            full_name
          )
        `)
        .eq('teacher_id', user?.id);

      if (studentsError) throw studentsError;

      const { data: teacherAssignments } = await supabase
        .from('assignments')
        .select('id')
        .eq('teacher_id', user?.id);

      const activeAssignmentIds = teacherAssignments?.map(a => a.id) || [];

      const studentsWithStats = await Promise.all(
        (teacherStudents || []).map(async (ts: TeacherStudentData) => {
          // FIX: access profiles as array
          const profile = ts.profiles[0];
          if (!profile) return null;

          const studentId = profile.id;

          if (activeAssignmentIds.length === 0) {
            return {
              id: studentId,
              name: profile.full_name || 'Unknown',
              email: profile.email,
              joinedDate: ts.added_at,
              totalAssignments: 0,
              submitted: 0,
              averageGrade: null,
              trend: 'up' as const,
              status: 'active',
              lastActivity: ts.added_at
            };
          }

          const { count: totalAssignments } = await supabase
            .from('assignment_students')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', studentId)
            .in('assignment_id', activeAssignmentIds);

          const { count: submittedCount } = await supabase
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', studentId)
            .in('assignment_id', activeAssignmentIds);

          const { data: grades } = await supabase
            .from('submissions')
            .select('grade')
            .eq('student_id', studentId)
            .not('grade', 'is', null)
            .in('assignment_id', activeAssignmentIds);

          const averageGrade = grades && grades.length > 0
            ? Math.round(grades.reduce((sum, g) => sum + (g.grade || 0), 0) / grades.length * 10) / 10
            : null;

          const { data: lastSubmissions } = await supabase
            .from('submissions')
            .select('submitted_at')
            .eq('student_id', studentId)
            .order('submitted_at', { ascending: false })
            .limit(1);

          const lastSubmission = lastSubmissions?.[0] ?? null;

          return {
            id: studentId,
            name: profile.full_name || 'Unknown',
            email: profile.email,
            joinedDate: ts.added_at,
            totalAssignments: totalAssignments || 0,
            submitted: submittedCount || 0,
            averageGrade,
            trend: 'up' as const,
            status: 'active',
            lastActivity: lastSubmission?.submitted_at || ts.added_at
          };
        })
      );

      setStudents(studentsWithStats.filter(Boolean) as Student[]);
    } catch (err: any) {
      console.error('Error fetching students:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    if (!newStudentEmail.trim()) return;

    try {
      setAddingStudent(true);
      setError(null);

      const { data: student, error: studentError } = await supabase
        .from('profiles')
        .select('id, role, email')
        .ilike('email', newStudentEmail.trim())
        .single();

      if (studentError || !student) {
        setError(`No student found with email: ${newStudentEmail.trim()}`);
        return;
      }

      if (student.role !== 'student') {
        setError('This user is not a student.');
        return;
      }

      const { data: existing } = await supabase
        .from('teacher_students')
        .select('id')
        .eq('teacher_id', user?.id)
        .eq('student_id', student.id)
        .single();

      if (existing) {
        setError('Student already added to your class.');
        return;
      }

      const { error: addError } = await supabase
        .from('teacher_students')
        .insert({ teacher_id: user?.id, student_id: student.id });

      if (addError) throw addError;

      setNewStudentEmail('');
      setShowAddModal(false);
      fetchStudents();
    } catch (err: any) {
      console.error('Error adding student:', err);
      setError(err.message);
    } finally {
      setAddingStudent(false);
    }
  };

  const handleRemoveStudent = async () => {
    if (!studentToRemove) return;

    try {
      setRemovingStudent(true);
      const { error } = await supabase
        .from('teacher_students')
        .delete()
        .eq('teacher_id', user?.id)
        .eq('student_id', studentToRemove.id);

      if (error) throw error;
      setShowRemoveModal(false);
      setStudentToRemove(null);
      fetchStudents();
    } catch (err: any) {
      console.error('Error removing student:', err);
      setError(err.message);
    } finally {
      setRemovingStudent(false);
    }
  };

  const handleSendEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  const gradedStudents = students.filter(s => s.averageGrade !== null);
  const stats = {
    totalStudents: students.length,
    activeStudents: students.filter(s => s.status === 'active').length,
    averageGrade: gradedStudents.length > 0
      ? Math.round(gradedStudents.reduce((sum, s) => sum + (s.averageGrade || 0), 0) / gradedStudents.length * 10) / 10
      : null,
    topPerformers: gradedStudents.filter(s => (s.averageGrade || 0) >= 90).length,
    needsAttention: gradedStudents.filter(s => (s.averageGrade || 0) < 70).length
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' ||
      (filterStatus === 'top' && (student.averageGrade || 0) >= 90) ||
      (filterStatus === 'attention' && student.averageGrade !== null && (student.averageGrade || 0) < 70);
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getGradeColor = (grade: number | null) => {
    if (grade === null) return isDark ? 'text-slate-400' : 'text-slate-500';
    if (grade >= 90) return isDark ? 'text-emerald-400' : 'text-emerald-600';
    if (grade >= 80) return isDark ? 'text-blue-400' : 'text-blue-600';
    if (grade >= 70) return isDark ? 'text-amber-400' : 'text-amber-600';
    return isDark ? 'text-red-400' : 'text-red-600';
  };

  const getGradeBg = (grade: number | null) => {
    if (grade === null) return isDark ? 'bg-slate-500/20' : 'bg-slate-50';
    if (grade >= 90) return isDark ? 'bg-emerald-500/20' : 'bg-emerald-50';
    if (grade >= 80) return isDark ? 'bg-blue-500/20' : 'bg-blue-50';
    if (grade >= 70) return isDark ? 'bg-amber-500/20' : 'bg-amber-50';
    return isDark ? 'bg-red-500/20' : 'bg-red-50';
  };

  return (
    <ProtectedRoute requiredRole="teacher">
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        <TeacherSidebar isDark={isDark} isSidebarOpen={isSidebarOpen} currentPage="students" />

        <main className="lg:ml-64">
          <header className={`sticky top-0 z-20 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b`}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div>
                  <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Student Management
                  </h2>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} hidden sm:block`}>
                    Manage and track your students
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={toggleTheme}
                  className={`p-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => { setShowAddModal(true); setError(null); }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2 rounded-xl font-medium flex items-center gap-2 text-sm sm:text-base"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add Student</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </div>
            </div>
          </header>

          <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
            {error && !showAddModal && (
              <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 flex items-start gap-3">
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
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6">
              {[
                { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'emerald' },
                { label: 'Active', value: stats.activeStudents, icon: FileText, color: 'blue' },
                { label: 'Class Average', value: stats.averageGrade !== null ? `${stats.averageGrade}%` : 'N/A', icon: Award, color: 'purple' },
                { label: 'Top Performers', value: stats.topPerformers, icon: TrendingUp, color: 'emerald' },
                { label: 'Needs Attention', value: stats.needsAttention, icon: TrendingDown, color: 'amber' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? `bg-${color}-600/20` : `bg-${color}-100`}`}>
                      <Icon className={`w-4 h-4 sm:w-6 sm:h-6 ${isDark ? `text-${color}-400` : `text-${color}-600`}`} />
                    </div>
                  </div>
                  <h3 className={`text-2xl sm:text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {value}
                  </h3>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
                </div>
              ))}
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-colors ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-emerald-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                />
              </div>

              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`w-full sm:w-auto px-4 py-2.5 rounded-xl border flex items-center justify-between sm:justify-center gap-2 text-sm ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <span>{filterStatus === 'all' ? 'All Students' : filterStatus === 'top' ? 'Top Performers' : 'Needs Attention'}</span>
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showFilterDropdown && (
                  <>
                    <div className="fixed inset-0 z-30 sm:hidden" onClick={() => setShowFilterDropdown(false)} />
                    <div className={`absolute top-full mt-2 left-0 right-0 sm:right-0 sm:left-auto sm:w-48 rounded-xl shadow-lg border z-40 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                    }`}>
                      {['all', 'top', 'attention'].map((status) => (
                        <button
                          key={status}
                          onClick={() => { setFilterStatus(status); setShowFilterDropdown(false); }}
                          className={`w-full px-4 py-2.5 text-left text-sm first:rounded-t-xl last:rounded-b-xl ${
                            filterStatus === status
                              ? isDark ? 'bg-emerald-600/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                              : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {status === 'all' ? 'All Students' : status === 'top' ? 'Top Performers' : 'Needs Attention'}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-4"></div>
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Loading students...</p>
              </div>
            )}

            {!loading && (
              <div className={`rounded-xl sm:rounded-2xl overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className={isDark ? 'bg-slate-700/50' : 'bg-slate-50'}>
                      <tr>
                        {['Student', 'Submissions', 'Average Grade', 'Last Activity', 'Actions'].map((h, i) => (
                          <th key={h} className={`px-6 py-4 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}>
                      {filteredStudents.map((student) => (
                        <tr key={student.id} className={`${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'} transition-colors`}>
                          <td className="px-6 py-4">
                            <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{student.name}</p>
                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{student.email}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {student.submitted}/{student.totalAssignments}
                              </span>
                              {student.submitted < student.totalAssignments && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                                  {student.totalAssignments - student.submitted} pending
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-bold ${getGradeColor(student.averageGrade)}`}>
                                {student.averageGrade !== null ? `${student.averageGrade}%` : 'N/A'}
                              </span>
                              {student.averageGrade !== null && (
                                student.trend === 'up'
                                  ? <TrendingUp className="w-4 h-4 text-emerald-500" />
                                  : <TrendingDown className="w-4 h-4 text-amber-500" />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              {formatDate(student.lastActivity)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => setSelectedStudent(student)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`} title="View Details">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleSendEmail(student.email)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`} title="Send Email">
                                <Mail className="w-4 h-4" />
                              </button>
                              <button onClick={() => { setStudentToRemove(student); setShowRemoveModal(true); }} className="p-2 rounded-lg hover:bg-red-500/20 text-red-500" title="Remove Student">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-700">
                  {filteredStudents.map((student) => (
                    <div key={student.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{student.name}</p>
                          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{student.email}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-lg text-lg font-bold ${getGradeColor(student.averageGrade)} ${getGradeBg(student.averageGrade)}`}>
                          {student.averageGrade !== null ? `${student.averageGrade}%` : 'N/A'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm mb-3">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                          {student.submitted}/{student.totalAssignments} submitted
                        </span>
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {formatDate(student.lastActivity)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedStudent(student)} className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">
                          View Details
                        </button>
                        <button onClick={() => handleSendEmail(student.email)} className={`p-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                          <Mail className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setStudentToRemove(student); setShowRemoveModal(true); }} className="p-2 rounded-lg bg-red-500/20 text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredStudents.length === 0 && (
                  <div className="p-12 text-center">
                    <Users className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                    <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>No students found</h3>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {students.length === 0 ? 'Add your first student to get started' : 'Try adjusting your search or filters'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Add Student Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Add Student</h3>
                <button onClick={() => { setShowAddModal(false); setError(null); setNewStudentEmail(''); }} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 bg-red-500/20 border border-red-500 rounded-xl p-3">
                  <p className="text-red-500 text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Student Email
                  </label>
                  <div className="relative">
                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                      type="email"
                      value={newStudentEmail}
                      onChange={(e) => { setNewStudentEmail(e.target.value); setError(null); }}
                      placeholder="student@school.edu"
                      onKeyPress={(e) => { if (e.key === 'Enter' && newStudentEmail.trim()) handleAddStudent(); }}
                      className={`w-full pl-11 pr-4 py-3 rounded-xl border transition-colors ${
                        isDark
                          ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-emerald-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                      } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                    />
                  </div>
                  <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Student must already have an account on the platform
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowAddModal(false); setError(null); setNewStudentEmail(''); }}
                    disabled={addingStudent}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddStudent}
                    disabled={!newStudentEmail.trim() || addingStudent}
                    className="flex-1 py-3 px-4 rounded-xl font-medium bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {addingStudent ? (
                      <><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>Adding...</>
                    ) : (
                      <><UserPlus className="w-4 h-4" />Add Student</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Student Details Modal */}
        {selectedStudent && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className={`w-full max-w-2xl rounded-2xl p-6 my-8 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Student Details</h3>
                <button onClick={() => setSelectedStudent(null)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <h4 className={`font-bold text-lg mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedStudent.name}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{selectedStudent.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Joined: {formatDate(selectedStudent.joinedDate)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Average Grade', value: selectedStudent.averageGrade !== null ? `${selectedStudent.averageGrade}%` : 'N/A', colored: true },
                    { label: 'Submitted', value: selectedStudent.submitted, colored: false },
                    { label: 'Pending', value: selectedStudent.totalAssignments - selectedStudent.submitted, colored: false },
                  ].map(({ label, value, colored }) => (
                    <div key={label} className={`p-4 rounded-xl text-center ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                      <div className={`text-2xl font-bold mb-1 ${colored ? getGradeColor(selectedStudent.averageGrade) : isDark ? 'text-white' : 'text-slate-900'}`}>
                        {value}
                      </div>
                      <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleSendEmail(selectedStudent.email)}
                  className="w-full py-3 px-4 rounded-xl font-medium bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Send Message
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Student Modal */}
        {showRemoveModal && studentToRemove && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
              </div>

              <h3 className={`text-xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Remove Student
              </h3>
              <p className={`text-center text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                You are about to remove <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{studentToRemove.name}</span> from your class.
              </p>

              <div className={`rounded-xl p-4 mb-6 space-y-3 border ${isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> This action will:
                </p>
                <ul className={`space-y-2 text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                  <li className="flex items-start gap-2">
                    <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>Remove <span className="font-semibold">{studentToRemove.name}</span> from your class roster permanently</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>Revoke their access to all assignments you have shared with them</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>Their existing submissions and grades will remain in the database but will no longer be visible to you</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>This action <span className="font-semibold">cannot be undone</span>. You would need to re-add them manually</span>
                  </li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowRemoveModal(false); setStudentToRemove(null); }}
                  disabled={removingStudent}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveStudent}
                  disabled={removingStudent}
                  className="flex-1 py-3 px-4 rounded-xl font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {removingStudent ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>Removing...</>
                  ) : (
                    <><Trash2 className="w-4 h-4" />Yes, Remove Student</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
