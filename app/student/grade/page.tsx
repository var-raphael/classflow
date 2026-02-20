'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { supabase } from '@/lib/supabaseClient';
import { 
  BookOpen, 
  Sun,
  Moon,
  LogOut,
  FileText,
  Award,
  Menu,
  Target,
  TrendingUp,
  TrendingDown,
  Download,
  Filter,
  ChevronDown,
  Calendar,
  Star,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import StudentSidebar from '@/components/StudentSidebar';

interface GradeData {
  id: string;
  assignment_id: string;
  assignment_title: string;
  teacher_name: string;
  submitted_at: string;
  graded_at: string;
  grade: number;
  feedback: string;
}

export default function StudentGrades() {
  const { user } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filterGrade, setFilterGrade] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<GradeData | null>(null);
  const [grades, setGrades] = useState<GradeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchGrades();
    }
  }, [user]);

  const fetchGrades = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch submissions with grades
      const { data: submissions, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('student_id', user.id);

      if (error) throw error;

      // Filter for graded submissions (those that have a grade)
      const gradedSubmissions = (submissions || []).filter(
        sub => sub.grade !== null && sub.grade !== undefined
      );

      // Fetch assignment and teacher details separately
      const transformedGrades: GradeData[] = [];
      
      for (const sub of gradedSubmissions) {
        // Get assignment details
        const { data: assignment } = await supabase
          .from('assignments')
          .select('id, title, teacher_id')
          .eq('id', sub.assignment_id)
          .single();

        if (!assignment) continue;

        // Get teacher details
        const { data: teacher } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', assignment.teacher_id)
          .single();

        // Strip HTML tags from feedback
        const stripHtml = (html: string) => {
          const tmp = document.createElement('div');
          tmp.innerHTML = html;
          return tmp.textContent || tmp.innerText || '';
        };

        const feedbackText = sub.feedback || sub.teacher_feedback || 'No feedback provided';
        const cleanFeedback = stripHtml(feedbackText);

        transformedGrades.push({
          id: sub.id,
          assignment_id: sub.assignment_id,
          assignment_title: assignment?.title || 'Unknown Assignment',
          teacher_name: teacher?.full_name || 'Unknown Teacher',
          submitted_at: sub.submitted_at,
          graded_at: sub.graded_at || sub.updated_at || sub.submitted_at,
          grade: sub.grade || 0,
          feedback: cleanFeedback
        });
      }

      setGrades(transformedGrades);
    } catch (error: any) {
      console.error('Error fetching grades:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  // Calculate statistics
  const stats = {
    totalGraded: grades.length,
    averageGrade: grades.length > 0 
      ? Math.round(grades.reduce((sum, g) => sum + g.grade, 0) / grades.length * 10) / 10 
      : 0,
    highestGrade: grades.length > 0 ? Math.max(...grades.map(g => g.grade)) : 0,
    lowestGrade: grades.length > 0 ? Math.min(...grades.map(g => g.grade)) : 0,
    above90: grades.filter(g => g.grade >= 90).length,
    below70: grades.filter(g => g.grade < 70).length
  };

  // Grade trend over time (last 5 only for better visibility)
  const gradeTrend = grades
    .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
    .slice(-5)
    .map((g, index) => ({
      assignment: `#${index + 1}`,
      fullName: g.assignment_title,
      grade: g.grade,
      date: g.submitted_at
    }));

  // Grade distribution
  const gradeDistribution = [
    { name: 'A (90-100)', value: grades.filter(g => g.grade >= 90).length, color: '#10b981' },
    { name: 'B (80-89)', value: grades.filter(g => g.grade >= 80 && g.grade < 90).length, color: '#3b82f6' },
    { name: 'C (70-79)', value: grades.filter(g => g.grade >= 70 && g.grade < 80).length, color: '#f59e0b' },
    { name: 'D (60-69)', value: grades.filter(g => g.grade >= 60 && g.grade < 70).length, color: '#ef4444' }
  ];

  // Grade range options
  const gradeRanges = [
    { id: 'all', label: 'All Grades', min: 0, max: 100 },
    { id: 'a', label: 'A (90-100)', min: 90, max: 100 },
    { id: 'b', label: 'B (80-89)', min: 80, max: 89 },
    { id: 'c', label: 'C (70-79)', min: 70, max: 79 },
    { id: 'd', label: 'D (60-69)', min: 60, max: 69 },
    { id: 'below60', label: 'Below 60', min: 0, max: 59 }
  ];

  const filteredGrades = filterGrade === 'all' 
    ? grades 
    : grades.filter(g => {
        const range = gradeRanges.find(r => r.id === filterGrade);
        return range && g.grade >= range.min && g.grade <= range.max;
      });

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return isDark ? 'text-emerald-400' : 'text-emerald-600';
    if (grade >= 80) return isDark ? 'text-blue-400' : 'text-blue-600';
    if (grade >= 70) return isDark ? 'text-amber-400' : 'text-amber-600';
    return isDark ? 'text-red-400' : 'text-red-600';
  };

  const getGradeBg = (grade: number) => {
    if (grade >= 90) return isDark ? 'bg-emerald-500/20' : 'bg-emerald-50';
    if (grade >= 80) return isDark ? 'bg-blue-500/20' : 'bg-blue-50';
    if (grade >= 70) return isDark ? 'bg-amber-500/20' : 'bg-amber-50';
    return isDark ? 'bg-red-500/20' : 'bg-red-50';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const exportReport = () => {
    // Create CSV content
    const csvContent = [
      ['Assignment', 'Teacher', 'Grade', 'Submitted', 'Graded', 'Feedback'].join(','),
      ...grades.map(g => [
        `"${g.assignment_title}"`,
        `"${g.teacher_name}"`,
        g.grade,
        formatDate(g.submitted_at),
        formatDate(g.graded_at),
        `"${g.feedback}"`
      ].join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grades_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <ProtectedRoute requiredRole="student">
      <div className={`min-h-screen transition-colors duration-300 ${
        isDark ? 'bg-slate-900' : 'bg-slate-50'
      }`}>
        {/* Sidebar Overlay for Mobile */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <StudentSidebar 
          isDark={isDark}
          isSidebarOpen={isSidebarOpen}
          currentPage="grades"
        />

        {/* Main Content */}
        <main className="lg:ml-64">
          {/* Header */}
          <header className={`sticky top-0 z-20 ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          } border-b`}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={`p-2 rounded-lg ${
                    isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div>
                  <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    My Grades
                  </h2>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} hidden sm:block`}>
                    Track your academic performance
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={toggleTheme}
                  className={`p-2 rounded-lg ${
                    isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button 
                  onClick={exportReport}
                  disabled={grades.length === 0}
                  className={`px-3 sm:px-4 py-2 rounded-xl font-medium flex items-center gap-2 text-sm sm:text-base ${
                    grades.length === 0
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export Report</span>
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className={`w-12 h-12 animate-spin mb-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading grades...</p>
              </div>
            ) : grades.length === 0 ? (
              <div className={`rounded-2xl p-12 text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                <Award className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  No Grades Yet
                </h3>
                <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Your graded assignments will appear here
                </p>
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? 'bg-indigo-600/20' : 'bg-indigo-100'}`}>
                        <Award className={`w-4 h-4 sm:w-6 sm:h-6 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                      </div>
                      {stats.averageGrade >= 85 && <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />}
                    </div>
                    <h3 className={`text-2xl sm:text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {stats.averageGrade}%
                    </h3>
                    <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Average Grade
                    </p>
                  </div>

                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? 'bg-emerald-600/20' : 'bg-emerald-100'}`}>
                        <Star className={`w-4 h-4 sm:w-6 sm:h-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      </div>
                    </div>
                    <h3 className={`text-2xl sm:text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {stats.highestGrade}%
                    </h3>
                    <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Highest Grade
                    </p>
                  </div>

                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
                        <CheckCircle className={`w-4 h-4 sm:w-6 sm:h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                      </div>
                    </div>
                    <h3 className={`text-2xl sm:text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {stats.above90}
                    </h3>
                    <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      A Grades (90+)
                    </p>
                  </div>

                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? 'bg-blue-600/20' : 'bg-blue-100'}`}>
                        <FileText className={`w-4 h-4 sm:w-6 sm:h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                      </div>
                    </div>
                    <h3 className={`text-2xl sm:text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {stats.totalGraded}
                    </h3>
                    <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Total Graded
                    </p>
                  </div>
                </div>

                {/* Charts */}
                {grades.length >= 2 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Grade Trend */}
                    <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                      <h3 className={`text-base sm:text-lg font-bold mb-4 sm:mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Grade Trend {gradeTrend.length < grades.length && `(Last ${gradeTrend.length})`}
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={gradeTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                          <XAxis 
                            dataKey="assignment" 
                            stroke={isDark ? '#64748b' : '#94a3b8'} 
                            style={{ fontSize: '0.875rem' }}
                          />
                          <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} style={{ fontSize: '0.75rem' }} domain={[0, 100]} />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className={`px-3 py-2 rounded-lg ${
                                    isDark ? 'bg-slate-700 border border-slate-600' : 'bg-white border border-slate-200'
                                  }`}>
                                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                      {payload[0].payload.fullName}
                                    </p>
                                    <p className="text-sm text-indigo-500 font-bold">
                                      Grade: {payload[0].value}%
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line type="monotone" dataKey="grade" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Grade Distribution */}
                    <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                      <h3 className={`text-base sm:text-lg font-bold mb-4 sm:mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Grade Distribution
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={gradeDistribution.filter(g => g.value > 0)}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name.split(' ')[0]}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={70}
                            dataKey="value"
                          >
                            {gradeDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: isDark ? '#1e293b' : '#ffffff',
                              border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                              borderRadius: '0.75rem',
                              fontSize: '0.875rem'
                            }}
                          />
                          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '0.75rem' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Recent Grades */}
                <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                  <h3 className={`text-base sm:text-lg font-bold mb-4 sm:mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Recent Grades
                  </h3>
                  <div className="space-y-3">
                    {grades.slice(0, 5).map((grade) => (
                      <div key={grade.id} className={`flex items-center justify-between p-3 sm:p-4 rounded-xl ${
                        isDark ? 'bg-slate-700' : 'bg-slate-50'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm sm:text-base truncate ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}>
                            {grade.assignment_title}
                          </p>
                          <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {grade.teacher_name} • {formatDate(grade.graded_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-3">
                          <div className={`px-3 py-1.5 rounded-lg font-bold text-lg ${
                            getGradeBg(grade.grade)
                          }`}>
                            <span className={getGradeColor(grade.grade)}>
                              {grade.grade}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filter */}
                <div className="flex items-center justify-between">
                  <h3 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    All Grades ({filteredGrades.length})
                  </h3>
                  <div className="relative">
                    <button
                      onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                      className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-sm ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                          : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                      <span>{gradeRanges.find(r => r.id === filterGrade)?.label || 'All Grades'}</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    
                    {showFilterDropdown && (
                      <>
                        <div 
                          className="fixed inset-0 z-30 sm:hidden"
                          onClick={() => setShowFilterDropdown(false)}
                        />
                        <div className={`absolute top-full mt-2 right-0 w-48 rounded-xl shadow-lg border z-40 ${
                          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                        }`}>
                          {gradeRanges.map((range) => (
                            <button
                              key={range.id}
                              onClick={() => {
                                setFilterGrade(range.id);
                                setShowFilterDropdown(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm first:rounded-t-xl last:rounded-b-xl ${
                                filterGrade === range.id
                                  ? isDark ? 'bg-indigo-600/20 text-indigo-400' : 'bg-indigo-50 text-indigo-700'
                                  : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {range.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Grades List */}
                <div className="space-y-3">
                  {filteredGrades.map((grade) => (
                    <div
                      key={grade.id}
                      onClick={() => setSelectedGrade(selectedGrade?.id === grade.id ? null : grade)}
                      className={`rounded-xl p-4 sm:p-6 cursor-pointer transition-all ${
                        isDark ? 'bg-slate-800 hover:bg-slate-750' : 'bg-white hover:shadow-md'
                      } shadow-sm`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getGradeBg(grade.grade)}`}>
                              <Award className={`w-5 h-5 ${getGradeColor(grade.grade)}`} />
                            </div>
                            <div className="flex-1">
                              <h4 className={`font-bold text-sm sm:text-base mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {grade.assignment_title}
                              </h4>
                              <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                {grade.teacher_name}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="text-right">
                            <div className={`text-2xl sm:text-3xl font-bold ${getGradeColor(grade.grade)}`}>
                              {grade.grade}%
                            </div>
                            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {formatDate(grade.graded_at)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {selectedGrade?.id === grade.id && (
                        <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                          <div className="space-y-3">
                            <div>
                              <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Teacher Feedback
                              </p>
                              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {grade.feedback}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs">
                              <div>
                                <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Submitted: </span>
                                <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {formatDate(grade.submitted_at)}
                                </span>
                              </div>
                              <div>
                                <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Score: </span>
                                <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {grade.grade}/100
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
