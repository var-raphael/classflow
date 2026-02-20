'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText, Award, Clock, Menu, CheckCircle,
  XCircle, Calendar, Sun, Moon, TrendingUp, Lock
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import StudentSidebar from '@/components/StudentSidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

interface RecentAssignment {
  id: string;
  title: string;
  due_date: string;
  status: string;
  grade: number | null;
}

interface GradeTrend {
  assignment: string;
  grade: number;
}

export default function StudentDashboard() {
  const { profile, user } = useAuth();
  const router = useRouter();

  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalAssignments: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
    locked: 0,
    averageGrade: 0,
    ranking: 0,
    totalStudents: 0,
  });

  const [assignmentStatus, setAssignmentStatus] = useState<{ name: string; value: number; color: string }[]>([]);
  const [gradeTrend, setGradeTrend] = useState<GradeTrend[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<RecentAssignment[]>([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setIsDark(true);
  }, []);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Get assignments with their status (need status to detect locked)
      const { data: assignedData } = await supabase
        .from('assignment_students')
        .select(`
          assignments (
            id,
            title,
            due_date,
            status
          )
        `)
        .eq('student_id', user?.id);

      const assigned = (assignedData || []).filter((a: any) => a.assignments !== null);
      const now = new Date();

      // 2. Get submissions
      const { data: submissionsData } = await supabase
        .from('submissions')
        .select('assignment_id, grade, submitted_at, updated_at')
        .eq('student_id', user?.id)
        .order('updated_at', { ascending: true });

      const submissions = submissionsData || [];
      const submissionMap = new Map(submissions.map((s: any) => [s.assignment_id, s]));

      const submittedIds = new Set(
        submissions.filter((s: any) => s.submitted_at !== null && s.submitted_at !== undefined).map((s: any) => s.assignment_id)
      );
      const draftIds = new Set(
        submissions.filter((s: any) => s.submitted_at === null || s.submitted_at === undefined).map((s: any) => s.assignment_id)
      );

      // 3. Classify each assignment
      const classify = (a: any): string => {
        const assignment = a.assignments;
        const submission = submissionMap.get(assignment?.id);
        const isSubmitted = submittedIds.has(assignment?.id);
        const isClosed = assignment?.status === 'closed';

        if (submission) {
          if (submission.grade !== null && submission.grade !== undefined) return 'graded';
          if (isSubmitted) return 'submitted';
          return 'draft';
        }
        // No submission
        if (isClosed) return 'locked'; // closed + not submitted = locked
        if (new Date(assignment?.due_date) < now) return 'overdue';
        return 'pending';
      };

      // 4. Stats
      const total = assigned.length;
      const completed = assigned.filter(a => ['submitted', 'graded'].includes(classify(a))).length;
      const pending = assigned.filter(a => classify(a) === 'pending').length;
      const overdue = assigned.filter(a => classify(a) === 'overdue').length;
      const lockedCount = assigned.filter(a => classify(a) === 'locked').length;
      const draftCount = assigned.filter(a => classify(a) === 'draft').length;

      // 5. Average grade
      const gradedSubmissions = submissions.filter((s: any) => s.grade !== null && s.grade !== undefined);
      const avgGrade = gradedSubmissions.length > 0
        ? gradedSubmissions.reduce((acc: number, s: any) => acc + s.grade, 0) / gradedSubmissions.length
        : 0;

      // 6. Ranking
      const { data: classmatesData } = await supabase
        .from('teacher_students')
        .select('student_id')
        .in(
          'teacher_id',
          (await supabase.from('teacher_students').select('teacher_id').eq('student_id', user?.id))
            .data?.map((t: any) => t.teacher_id) || []
        );

      const classmateIds = classmatesData?.map((c: any) => c.student_id) || [];
      const totalStudents = classmateIds.length;
      let ranking = 1;

      if (classmateIds.length > 1 && avgGrade > 0) {
        const { data: allGrades } = await supabase
          .from('submissions')
          .select('student_id, grade')
          .in('student_id', classmateIds)
          .not('grade', 'is', null);

        const studentAverages: Record<string, number[]> = {};
        (allGrades || []).forEach((s: any) => {
          if (!studentAverages[s.student_id]) studentAverages[s.student_id] = [];
          studentAverages[s.student_id].push(s.grade);
        });
        const averages = Object.entries(studentAverages).map(([id, grades]) => ({
          id, avg: grades.reduce((a, b) => a + b, 0) / grades.length,
        }));
        ranking = averages.filter(s => s.avg > avgGrade).length + 1;
      }

      setStats({ totalAssignments: total, completed, pending, overdue, locked: lockedCount, averageGrade: Math.round(avgGrade * 10) / 10, ranking, totalStudents });

      // 7. Pie chart — includes locked
      setAssignmentStatus(
        [
          { name: 'Submitted', value: completed, color: '#10b981' },
          { name: 'Draft', value: draftCount, color: '#3b82f6' },
          { name: 'Pending', value: pending, color: '#f59e0b' },
          { name: 'Overdue', value: overdue, color: '#ef4444' },
          { name: 'Locked', value: lockedCount, color: '#64748b' },
        ].filter(s => s.value > 0)
      );

      // 8. Grade trend
      const gradedWithTitles = submissions
        .filter((s: any) => s.grade !== null && s.grade !== undefined)
        .slice(-6)
        .map((s: any, idx: number) => ({ assignment: `#${idx + 1}`, grade: s.grade }));
      setGradeTrend(gradedWithTitles);

      // 9. Recent assignments
      const recent = assigned.slice(0, 4).map((a: any) => {
        const assignment = a.assignments;
        if (!assignment) return null;
        const submission = submissionMap.get(assignment.id);
        return {
          id: assignment.id,
          title: assignment.title,
          due_date: assignment.due_date,
          status: classify(a),
          grade: submission?.grade ?? null,
        };
      }).filter(Boolean) as RecentAssignment[];

      setRecentAssignments(recent);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'graded': return isDark ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'draft': return isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200';
      case 'pending': return isDark ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200';
      case 'overdue': return isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200';
      case 'locked': return isDark ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' : 'bg-slate-100 text-slate-600 border-slate-300';
      default: return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted': return <CheckCircle className="w-4 h-4" />;
      case 'graded': return <Award className="w-4 h-4" />;
      case 'draft': return <FileText className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'overdue': return <XCircle className="w-4 h-4" />;
      case 'locked': return <Lock className="w-4 h-4" />;
      default: return null;
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <ProtectedRoute requiredRole="student">
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        <StudentSidebar isDark={isDark} isSidebarOpen={isSidebarOpen} currentPage="dashboard" />

        <main className="lg:ml-64">
          <header className={`sticky top-0 z-20 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b`}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4">
              <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg lg:hidden ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}>
                  <Menu className="w-5 h-5" />
                </button>
                <div>
                  <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>My Dashboard</h2>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} hidden sm:block`}>
                    Welcome back, <strong>{profile?.full_name || 'Student'}</strong>
                  </p>
                </div>
              </div>
              <button onClick={toggleTheme} className={`p-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </header>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            )}

            {!loading && (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl w-fit mb-3 sm:mb-4 ${isDark ? 'bg-indigo-600/20' : 'bg-indigo-100'}`}>
                      <FileText className={`w-4 h-4 sm:w-6 sm:h-6 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                    </div>
                    <h3 className={`text-2xl sm:text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.totalAssignments}</h3>
                    <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Assignments</p>
                  </div>

                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl w-fit mb-3 sm:mb-4 ${isDark ? 'bg-emerald-600/20' : 'bg-emerald-100'}`}>
                      <CheckCircle className={`w-4 h-4 sm:w-6 sm:h-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    </div>
                    <h3 className={`text-2xl sm:text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.completed}</h3>
                    <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Submitted</p>
                  </div>

                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl w-fit mb-3 sm:mb-4 ${isDark ? 'bg-amber-600/20' : 'bg-amber-100'}`}>
                      <Clock className={`w-4 h-4 sm:w-6 sm:h-6 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                    </div>
                    <h3 className={`text-2xl sm:text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.pending}</h3>
                    <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pending</p>
                  </div>

                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
                        <Award className={`w-4 h-4 sm:w-6 sm:h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                      </div>
                      {stats.averageGrade > 0 && <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />}
                    </div>
                    <h3 className={`text-2xl sm:text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {stats.averageGrade > 0 ? `${stats.averageGrade}%` : 'N/A'}
                    </h3>
                    <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Average Grade</p>
                  </div>
                </div>

                {/* Locked assignments notice — only shown if any exist */}
                {stats.locked > 0 && (
                  <div className={`rounded-xl p-4 flex items-center gap-3 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} shadow-sm`}>
                    <div className={`p-2 rounded-lg flex-shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                      <Lock className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                    </div>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      You have <strong className={isDark ? 'text-slate-300' : 'text-slate-700'}>{stats.locked} locked assignment{stats.locked > 1 ? 's' : ''}</strong> — submissions were closed by your teacher before you submitted.
                    </p>
                  </div>
                )}

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <h3 className={`text-base sm:text-lg font-bold mb-4 sm:mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Assignment Status</h3>
                    {assignmentStatus.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie data={assignmentStatus} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} outerRadius={70} dataKey="value">
                            {assignmentStatus.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: '0.75rem', color: isDark ? '#fff' : '#000', fontSize: '0.875rem' }} />
                          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.75rem' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[250px]">
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No assignments yet</p>
                      </div>
                    )}
                  </div>

                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <h3 className={`text-base sm:text-lg font-bold mb-4 sm:mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Grade Trend</h3>
                    {gradeTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={gradeTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                          <XAxis dataKey="assignment" stroke={isDark ? '#64748b' : '#94a3b8'} style={{ fontSize: '0.75rem' }} />
                          <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} style={{ fontSize: '0.75rem' }} domain={[0, 100]} />
                          <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: '0.75rem', color: isDark ? '#fff' : '#000', fontSize: '0.875rem' }} />
                          <Line type="monotone" dataKey="grade" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[250px]">
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No grades yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Assignments & Ranking */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <h3 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Recent Assignments</h3>
                      <button onClick={() => router.push('/student/assignments')} className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 font-medium">View All</button>
                    </div>

                    {recentAssignments.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className={`w-10 h-10 mx-auto mb-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No assignments yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentAssignments.map((assignment) => (
                          <div
                            key={assignment.id}
                            onClick={() => router.push(`/student/assignment-submit/${assignment.id}`)}
                            className={`p-3 sm:p-4 rounded-xl cursor-pointer transition-colors ${
                              assignment.status === 'locked'
                                ? isDark ? 'bg-slate-700/50 opacity-75 hover:bg-slate-700' : 'bg-slate-50 opacity-75 hover:bg-slate-100'
                                : isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-50 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {assignment.status === 'locked' && <Lock className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />}
                                <h4 className={`font-semibold text-sm sm:text-base truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{assignment.title}</h4>
                              </div>
                              {assignment.grade !== null && (
                                <div className={`ml-2 px-2 py-1 rounded-lg flex-shrink-0 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                                  <span className={`text-xs sm:text-sm font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{assignment.grade}%</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${getStatusColor(assignment.status)}`}>
                                {getStatusIcon(assignment.status)}
                                {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                              </span>
                              <div className="flex items-center gap-1 text-xs sm:text-sm">
                                <Calendar className={`w-3 h-3 sm:w-4 sm:h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{formatDate(assignment.due_date)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Class Ranking */}
                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <h3 className={`text-base sm:text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Class Ranking</h3>

                    {stats.averageGrade === 0 ? (
                      <div className="flex items-center justify-center h-32">
                        <p className={`text-sm text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Submit graded assignments to see your ranking</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <p className={`text-xs sm:text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Your position in class</p>
                            <div className="flex items-center gap-2">
                              <Award className="w-6 h-6 text-amber-500" />
                              <span className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>#{stats.ranking}</span>
                            </div>
                            <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>out of {stats.totalStudents} students</p>
                          </div>
                          <div className={`p-4 rounded-2xl text-center ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                            <p className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Avg Grade</p>
                            <p className={`text-2xl font-bold ${stats.averageGrade >= 90 ? 'text-emerald-500' : stats.averageGrade >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                              {stats.averageGrade}%
                            </p>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Top</span>
                            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Bottom</span>
                          </div>
                          <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                            <div
                              className="h-full bg-indigo-500 transition-all duration-500"
                              style={{ width: `${stats.totalStudents > 0 ? ((stats.totalStudents - stats.ranking + 1) / stats.totalStudents) * 100 : 0}%` }}
                            />
                          </div>
                          <p className={`text-xs mt-2 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Better than {stats.totalStudents > 0 ? Math.round(((stats.totalStudents - stats.ranking) / stats.totalStudents) * 100) : 0}% of your class
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
