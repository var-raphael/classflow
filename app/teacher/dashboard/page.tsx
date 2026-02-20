'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Plus,
  Sun,
  Moon,
  FileText,
  Award,
  Clock,
  Menu,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Activity,
  Mail
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar
} from 'recharts';
import TeacherSidebar from '@/components/TeacherSidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

interface StudentPerf {
  name: string;
  grade: number;
  trend: 'up' | 'down';
  assignments: number;
  missing?: number;
}

interface RecentActivity {
  student: string;
  action: string;
  time: string;
  type: 'submission' | 'question' | 'missed';
}

interface UpcomingDeadline {
  id: string;
  title: string;
  dueDate: string;
  submissions: number;
  total: number;
}

interface WeekTrend {
  week: string;
  onTime: number;
  late: number;
}

interface GradeBucket {
  name: string;
  value: number;
  color: string;
}

interface AssignmentCompletion {
  assignment: string;
  completion: number;
}

export default function TeacherDashboard() {
  const router = useRouter();
  const { profile, user } = useAuth();

  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalAssignments: 0,
    pendingSubmissions: 0,
    averageGrade: 0,
  });

  // Chart data
  const [submissionTrend, setSubmissionTrend] = useState<WeekTrend[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<GradeBucket[]>([]);
  const [assignmentCompletion, setAssignmentCompletion] = useState<AssignmentCompletion[]>([]);

  // Tables
  const [topStudents, setTopStudents] = useState<StudentPerf[]>([]);
  const [needsAttention, setNeedsAttention] = useState<StudentPerf[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadline[]>([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setIsDark(true);
  }, []);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // ── 1. Teacher's students ──────────────────────────────────────────────
      const { data: tsRows } = await supabase
        .from('teacher_students')
        .select('student_id')
        .eq('teacher_id', user!.id);

      const studentIds: string[] = (tsRows || []).map((r: any) => r.student_id);

      // ── 2. Teacher's assignments ───────────────────────────────────────────
      const { data: assignmentsData } = await supabase
        .from('assignments')
        .select('id, title, due_date, status, created_at')
        .eq('teacher_id', user!.id)
        .order('created_at', { ascending: false });

      const assignments = assignmentsData || [];
      const assignmentIds: string[] = assignments.map((a: any) => a.id);

      // ── 3. All submissions for this teacher's assignments ──────────────────
      let allSubmissions: any[] = [];
      if (assignmentIds.length > 0) {
        const { data: subData } = await supabase
          .from('submissions')
          .select('id, student_id, assignment_id, grade, submitted_at, content')
          .in('assignment_id', assignmentIds);
        allSubmissions = subData || [];
      }

      // ── 4. STATS ──────────────────────────────────────────────────────────
      const gradedSubs = allSubmissions.filter(s => s.grade !== null);
      const avgGrade = gradedSubs.length > 0
        ? gradedSubs.reduce((sum: number, s: any) => sum + s.grade, 0) / gradedSubs.length
        : 0;

      // pending = submitted but not graded
      const pendingCount = allSubmissions.filter(
        s => s.submitted_at !== null && s.grade === null
      ).length;

      setStats({
        totalStudents: studentIds.length,
        totalAssignments: assignments.length,
        pendingSubmissions: pendingCount,
        averageGrade: Math.round(avgGrade * 10) / 10,
      });

      // ── 5. SUBMISSION TREND (last 4 weeks) ────────────────────────────────
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const trendData: WeekTrend[] = Array.from({ length: 4 }, (_, i) => {
        const weekStart = now - (3 - i) * weekMs;
        const weekEnd = weekStart + weekMs;
        const label = `Week ${i + 1}`;

        const inWindow = allSubmissions.filter(s => {
          if (!s.submitted_at) return false;
          const t = new Date(s.submitted_at).getTime();
          return t >= weekStart && t < weekEnd;
        });

        // find assignment due_date to determine late
        const assignmentDueMap = new Map(assignments.map((a: any) => [a.id, a.due_date]));
        const onTime = inWindow.filter(s => {
          const due = assignmentDueMap.get(s.assignment_id);
          if (!due) return true;
          return new Date(s.submitted_at).getTime() <= new Date(due).getTime();
        }).length;

        return { week: label, onTime, late: inWindow.length - onTime };
      });
      setSubmissionTrend(trendData);

      // ── 6. GRADE DISTRIBUTION ─────────────────────────────────────────────
      const buckets = [
        { name: 'A (90-100)', min: 90, max: 100, color: '#10b981' },
        { name: 'B (80-89)', min: 80, max: 89.99, color: '#3b82f6' },
        { name: 'C (70-79)', min: 70, max: 79.99, color: '#f59e0b' },
        { name: 'D (<70)', min: 0, max: 69.99, color: '#ef4444' },
      ];
      const gradeDist = buckets.map(b => ({
        name: b.name,
        color: b.color,
        value: gradedSubs.filter((s: any) => s.grade >= b.min && s.grade <= b.max).length,
      })).filter(b => b.value > 0);
      setGradeDistribution(gradeDist);

      // ── 7. ASSIGNMENT COMPLETION RATE (recent 5 non-draft) ────────────────
      const activeAssignments = assignments.filter((a: any) => a.status !== 'draft').slice(0, 5);
      const completionData: AssignmentCompletion[] = await Promise.all(
        activeAssignments.map(async (a: any) => {
          const { data: asRows } = await supabase
            .from('assignment_students')
            .select('student_id')
            .eq('assignment_id', a.id);
          const total = (asRows || []).length;
          const submitted = allSubmissions.filter(
            s => s.assignment_id === a.id && s.submitted_at !== null
          ).length;
          const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
          // shorten title for chart
          const short = a.title.length > 12 ? a.title.substring(0, 12) + '…' : a.title;
          return { assignment: short, completion: pct };
        })
      );
      setAssignmentCompletion(completionData);

      // ── 8. STUDENT PERFORMANCE ────────────────────────────────────────────
      if (studentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', studentIds);

        const profiles = profilesData || [];

        // Last 3 graded assignments (by due_date desc)
        const last3Assignments = assignments
          .filter((a: any) => a.status !== 'draft')
          .sort((a: any, b: any) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
          .slice(0, 3)
          .map((a: any) => a.id);

        // Per-student: overall avg (for top performers) + last-3 avg (for needs attention)
        const studentStats: StudentPerf[] = profiles.map((p: any) => {
          const subs = allSubmissions.filter(s => s.student_id === p.id);
          const graded = subs.filter(s => s.grade !== null);

          // Overall average for top performers
          const overallAvg = graded.length > 0
            ? graded.reduce((sum: number, s: any) => sum + s.grade, 0) / graded.length
            : 0;

          // Last-3-assignments average for needs attention
          const last3Graded = graded.filter(s => last3Assignments.includes(s.assignment_id));
          const last3Avg = last3Graded.length > 0
            ? last3Graded.reduce((sum: number, s: any) => sum + s.grade, 0) / last3Graded.length
            : null; // null = no data in last 3

          // Trend: is last3Avg going down vs overall?
          let trend: 'up' | 'down' = 'up';
          if (last3Avg !== null && graded.length > last3Graded.length) {
            trend = last3Avg >= overallAvg ? 'up' : 'down';
          } else if (graded.length >= 2) {
            const sorted = [...graded].sort(
              (a: any, b: any) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
            );
            const mid = Math.floor(sorted.length / 2);
            const firstAvg = sorted.slice(0, mid).reduce((s: number, x: any) => s + x.grade, 0) / mid;
            const lastAvg = sorted.slice(mid).reduce((s: number, x: any) => s + x.grade, 0) / (sorted.length - mid);
            trend = lastAvg >= firstAvg ? 'up' : 'down';
          }

          const submitted = subs.filter(s => s.submitted_at !== null).length;
          const missing = Math.max(0, assignments.filter((a: any) => a.status !== 'draft').length - submitted);

          return {
            name: p.full_name || p.email || 'Unknown',
            grade: Math.round(overallAvg * 10) / 10,
            last3Avg: last3Avg !== null ? Math.round(last3Avg * 10) / 10 : null,
            trend,
            assignments: subs.length,
            missing,
          } as any;
        });

        const withGrades = studentStats.filter(s => s.grade > 0);
        const sorted = [...withGrades].sort((a, b) => b.grade - a.grade);
        setTopStudents(sorted.slice(0, 3));

        // Needs attention: students whose last-3-assignments avg is BELOW the class average
        // Only include if they have data in at least 1 of the last 3 assignments
        const classAvg = avgGrade; // already computed above
        const struggling = (studentStats as any[])
          .filter(s => s.last3Avg !== null && s.last3Avg < classAvg)
          .sort((a, b) => a.last3Avg - b.last3Avg) // worst first
          .slice(0, 3)
          .map(s => ({ ...s, grade: s.last3Avg })); // show last3 avg as displayed grade

        setNeedsAttention(struggling);
      }

      // ── 9. RECENT ACTIVITY ────────────────────────────────────────────────
      // Recent submissions
      const recentSubs = allSubmissions
        .filter(s => s.submitted_at !== null)
        .sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
        .slice(0, 3);

      // Get student names for recent subs
      const recentStudentIds = [...new Set(recentSubs.map((s: any) => s.student_id))] as string[];
      let recentProfiles: any[] = [];
      if (recentStudentIds.length > 0) {
        const { data: rp } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', recentStudentIds);
        recentProfiles = rp || [];
      }
      const profileMap = new Map(recentProfiles.map((p: any) => [p.id, p]));

      // Recent comments
      let recentComments: any[] = [];
      if (assignmentIds.length > 0) {
        const { data: cData } = await supabase
          .from('comments')
          .select('id, user_id, assignment_id, created_at')
          .in('assignment_id', assignmentIds)
          .neq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(2);
        recentComments = cData || [];
      }

      const commentAuthorIds = [...new Set(recentComments.map((c: any) => c.user_id))] as string[];
      let commentProfiles: any[] = [];
      if (commentAuthorIds.length > 0) {
        const { data: cp } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', commentAuthorIds);
        commentProfiles = cp || [];
      }
      const commentProfileMap = new Map(commentProfiles.map((p: any) => [p.id, p]));
      const assignmentTitleMap = new Map(assignments.map((a: any) => [a.id, a.title]));

      const activities: RecentActivity[] = [
        ...recentSubs.map((s: any) => {
          const p = profileMap.get(s.student_id);
          const title = assignmentTitleMap.get(s.assignment_id) || 'an assignment';
          return {
            student: p?.full_name || p?.email || 'Student',
            action: `Submitted "${title}"`,
            time: timeAgo(s.submitted_at),
            type: 'submission' as const,
          };
        }),
        ...recentComments.map((c: any) => {
          const p = commentProfileMap.get(c.user_id);
          const title = assignmentTitleMap.get(c.assignment_id) || 'an assignment';
          return {
            student: p?.full_name || p?.email || 'Student',
            action: `Asked a question on "${title}"`,
            time: timeAgo(c.created_at),
            type: 'question' as const,
          };
        }),
      ]
        .sort((a, b) => 0) // already ordered
        .slice(0, 5);

      setRecentActivity(activities);

      // ── 10. UPCOMING DEADLINES ────────────────────────────────────────────
      const upcoming = assignments
        .filter((a: any) => a.status === 'active' && new Date(a.due_date) > new Date())
        .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 3);

      const deadlines: UpcomingDeadline[] = await Promise.all(
        upcoming.map(async (a: any) => {
          const { data: asRows } = await supabase
            .from('assignment_students')
            .select('student_id')
            .eq('assignment_id', a.id);
          const total = (asRows || []).length;
          const submitted = allSubmissions.filter(
            s => s.assignment_id === a.id && s.submitted_at !== null
          ).length;
          return { id: a.id, title: a.title, dueDate: a.due_date, submissions: submitted, total };
        })
      );
      setUpcomingDeadlines(deadlines);

    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'submission': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'question': return <Mail className="w-4 h-4 text-indigo-500" />;
      case 'missed': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <ProtectedRoute requiredRole="teacher">
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        <TeacherSidebar isDark={isDark} isSidebarOpen={isSidebarOpen} currentPage="dashboard" />

        <main className="lg:ml-64">
          <header className={`sticky top-0 z-20 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b`}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4">
              <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg lg:hidden ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}>
                  <Menu className="w-5 h-5" />
                </button>
                <div>
                  <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Dashboard</h2>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} hidden sm:block`}>
                    Welcome back, <strong>{profile?.full_name || 'Professor'}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button onClick={toggleTheme} className={`p-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button onClick={() => router.push('/teacher/assignment-create')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2 rounded-xl font-medium flex items-center gap-2 text-sm sm:text-base">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Assignment</span>
                  <span className="sm:hidden">New</span>
                </button>
              </div>
            </div>
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
            </div>
          ) : (
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                {[
                  { label: 'Total Students', value: stats.totalStudents, icon: <Users className={`w-4 h-4 sm:w-6 sm:h-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />, bg: isDark ? 'bg-emerald-600/20' : 'bg-emerald-100' },
                  { label: 'Total Assignments', value: stats.totalAssignments, icon: <FileText className={`w-4 h-4 sm:w-6 sm:h-6 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />, bg: isDark ? 'bg-indigo-600/20' : 'bg-indigo-100' },
                  { label: 'Pending Reviews', value: stats.pendingSubmissions, icon: <Clock className={`w-4 h-4 sm:w-6 sm:h-6 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />, bg: isDark ? 'bg-amber-600/20' : 'bg-amber-100' },
                  { label: 'Class Average', value: `${stats.averageGrade}%`, icon: <Award className={`w-4 h-4 sm:w-6 sm:h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />, bg: isDark ? 'bg-purple-600/20' : 'bg-purple-100' },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${s.bg}`}>{s.icon}</div>
                    </div>
                    <h3 className={`text-2xl sm:text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.value}</h3>
                    <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Submission Trend */}
                <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                  <h3 className={`text-base sm:text-lg font-bold mb-4 sm:mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Submission Trend</h3>
                  {submissionTrend.some(w => w.onTime + w.late > 0) ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={submissionTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="week" stroke={isDark ? '#64748b' : '#94a3b8'} style={{ fontSize: '0.75rem' }} />
                        <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} style={{ fontSize: '0.75rem' }} />
                        <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem' }} />
                        <Line type="monotone" dataKey="onTime" stroke="#10b981" strokeWidth={2} name="On Time" />
                        <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} name="Late" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className={`flex items-center justify-center h-[250px] text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No submission data yet</div>
                  )}
                </div>

                {/* Grade Distribution */}
                <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                  <h3 className={`text-base sm:text-lg font-bold mb-4 sm:mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Grade Distribution</h3>
                  {gradeDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={gradeDistribution} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${(name ?? '').split(' ')[0]}: ${((percent ?? 0) * 100).toFixed(0)}%`} outerRadius={70} dataKey="value">
                          {gradeDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem' }} />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '0.75rem' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className={`flex items-center justify-center h-[250px] text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No graded submissions yet</div>
                  )}
                </div>
              </div>

              {/* Assignment Completion & Student Performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Assignment Completion Rate */}
                <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                  <h3 className={`text-base sm:text-lg font-bold mb-4 sm:mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Assignment Completion Rate</h3>
                  {assignmentCompletion.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={assignmentCompletion}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="assignment" stroke={isDark ? '#64748b' : '#94a3b8'} style={{ fontSize: '0.75rem' }} />
                        <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} style={{ fontSize: '0.75rem' }} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem' }} />
                        <Bar dataKey="completion" fill="#10b981" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className={`flex items-center justify-center h-[250px] text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No active assignments yet</div>
                  )}
                </div>

                {/* Student Performance */}
                <div className="space-y-4 sm:space-y-6">
                  {/* Top Performers */}
                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                      <h3 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Top Performers</h3>
                    </div>
                    {topStudents.length > 0 ? (
                      <div className="space-y-2 sm:space-y-3">
                        {topStudents.map((student, index) => (
                          <div key={index} className={`flex items-center justify-between p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${isDark ? 'bg-emerald-600/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>{index + 1}</div>
                              <div>
                                <p className={`font-medium text-xs sm:text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{student.name}</p>
                                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{student.assignments} submissions</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2">
                              <span className={`font-bold text-sm sm:text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>{student.grade}%</span>
                              {student.trend === 'up' ? <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" /> : <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={`text-sm text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No graded students yet</p>
                    )}
                  </div>

                  {/* Needs Attention */}
                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                        <h3 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Needs Attention</h3>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-lg ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>Below avg · last 3</span>
                    </div>
                    {needsAttention.length > 0 ? (
                      <div className="space-y-2 sm:space-y-3">
                        {needsAttention.map((student, index) => (
                          <div key={index} className={`flex items-center justify-between p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                            <div>
                              <p className={`font-medium text-xs sm:text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{student.name}</p>
                              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                {(student.missing ?? 0) > 0 ? `${student.missing} missing assignment${(student.missing ?? 0) > 1 ? 's' : ''}` : 'Low grade'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2">
                              <span className={`font-bold text-sm sm:text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>{student.grade}%</span>
                              {student.trend === 'up' ? <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" /> : <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={`text-sm text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>All students on track 🎉</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Activity & Upcoming Deadlines */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Recent Activity */}
                <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Recent Activity</h3>
                    <Activity className={`w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  </div>
                  {recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivity.map((activity, index) => (
                        <div key={index} className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                          <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{activity.student}</p>
                            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{activity.action}</p>
                            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{activity.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-sm text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No recent activity</p>
                  )}
                </div>

                {/* Upcoming Deadlines */}
                <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Upcoming Deadlines</h3>
                    <Calendar className={`w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  </div>
                  {upcomingDeadlines.length > 0 ? (
                    <div className="space-y-4">
                      {upcomingDeadlines.map((deadline) => (
                        <div key={deadline.id} className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{deadline.title}</h4>
                              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Due: {new Date(deadline.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                              {deadline.submissions}/{deadline.total}
                            </span>
                          </div>
                          <div className={`w-full h-2 rounded-full ${isDark ? 'bg-slate-600' : 'bg-slate-200'}`}>
                            <div
                              className="h-2 rounded-full bg-emerald-500"
                              style={{ width: `${deadline.total > 0 ? (deadline.submissions / deadline.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-sm text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No upcoming deadlines</p>
                  )}
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
