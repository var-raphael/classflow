'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sun, Moon, Menu, ArrowLeft, Download, Eye, Save,
  CheckCircle, Clock, Calendar, User, MessageSquare,
  Paperclip, Star, ChevronDown, ChevronUp, Filter,
  Search, Bold, Italic, List, ListOrdered, Undo, Redo,
  Award, FileText, Send, AlertCircle
} from 'lucide-react';
import TeacherSidebar from '@/components/TeacherSidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  file_url: string;
  file_type: string;
}

interface Comment {
  id: string;
  author_name: string;
  role: string;
  message: string;
  created_at: string;
}

interface Submission {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  status: string;
  submitted_at: string | null;
  grade: number | null;
  feedback: string | null;
  content: string | null;
  attachments: Attachment[];
  comments: Comment[];
}

interface Assignment {
  id: string;
  title: string;
  due_date: string;
  total_students: number;
  submitted: number;
  graded: number;
}

function TeacherGradingView() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');

  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [grade, setGrade] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showComments, setShowComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackColumn, setFeedbackColumn] = useState<string>('feedback');

  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Write your feedback here...</p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none ${isDark ? 'prose-invert' : ''}`,
      },
    },
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setIsDark(true);
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, assignmentId]);

  useEffect(() => {
    if (editor && selectedSubmission) {
      editor.commands.setContent(selectedSubmission.feedback || '<p>Write your feedback here...</p>');
      setGrade(selectedSubmission.grade?.toString() || '');
    }
  }, [selectedSubmission?.id]);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      let targetAssignmentId = assignmentId;
      if (!targetAssignmentId) {
        const { data: firstAssignment, error: firstError } = await supabase
          .from('assignments')
          .select('id')
          .eq('teacher_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (firstError || !firstAssignment) {
          setLoading(false);
          return;
        }
        targetAssignmentId = firstAssignment.id;
      }

      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select('id, title, due_date')
        .eq('id', targetAssignmentId)
        .single();

      if (assignmentError) {
        setError('Failed to load assignment');
        setLoading(false);
        return;
      }

      const { data: assignedStudents } = await supabase
        .from('assignment_students')
        .select('student_id')
        .eq('assignment_id', targetAssignmentId);

      const assignedStudentIds = (assignedStudents || []).map((s: any) => s.student_id);

      let studentProfiles: any[] = [];
      if (assignedStudentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', assignedStudentIds);
        studentProfiles = profilesData || [];
      }

      const studentMap = new Map(studentProfiles.map((p: any) => [p.id, p]));

      let submissionsData: any[] = [];
      let resolvedFeedbackColumn = 'feedback';

      const { data: subWithFeedback, error: subError1 } = await supabase
        .from('submissions')
        .select('id, student_id, content, grade, feedback, submitted_at')
        .eq('assignment_id', targetAssignmentId);

      if (subError1) {
        const { data: subWithoutFeedback } = await supabase
          .from('submissions')
          .select('id, student_id, content, grade, submitted_at')
          .eq('assignment_id', targetAssignmentId);
        submissionsData = subWithoutFeedback || [];
        resolvedFeedbackColumn = 'none';
      } else {
        submissionsData = subWithFeedback || [];
      }

      setFeedbackColumn(resolvedFeedbackColumn);

      const submissionMap = new Map(submissionsData.map((s: any) => [s.student_id, s]));
      const submissionIds = submissionsData.map((s: any) => s.id);

      let attachmentsData: any[] = [];
      if (submissionIds.length > 0) {
        const { data: attData } = await supabase
          .from('submission_attachments')
          .select('*')
          .in('submission_id', submissionIds);
        attachmentsData = attData || [];
      }

      let commentsData: any[] = [];
      if (submissionIds.length > 0) {
        const { data: cData } = await supabase
          .from('comments')
          .select('id, assignment_id, user_id, message, created_at')
          .eq('assignment_id', targetAssignmentId)
          .order('created_at', { ascending: true });
        commentsData = cData || [];
      }

      const commentAuthorIds = [...new Set(commentsData.map((c: any) => c.user_id).filter(Boolean))] as string[];
      const commentAuthorMap = new Map<string, any>();
      if (commentAuthorIds.length > 0) {
        const { data: authorProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('id', commentAuthorIds);
        (authorProfiles || []).forEach((p: any) => commentAuthorMap.set(p.id, p));
      }

      const builtSubmissions: Submission[] = assignedStudentIds.map((studentId: string) => {
        const student = studentMap.get(studentId);
        const submission = submissionMap.get(studentId);

        const subAttachments = submission
          ? attachmentsData.filter((a: any) => a.submission_id === submission.id)
          : [];

        const subComments = commentsData
          .filter((c: any) => c.assignment_id === targetAssignmentId)
          .map((c: any) => {
            const author = commentAuthorMap.get(c.user_id);
            return {
              id: c.id,
              author_name: author?.full_name || 'Unknown',
              role: author?.role || 'student',
              message: c.message,
              created_at: c.created_at,
            };
          });

        let status = 'pending';
        if (submission) {
          if (submission.grade !== null && submission.grade !== undefined) {
            status = 'graded';
          } else if (submission.submitted_at !== null && submission.submitted_at !== undefined) {
            status = 'submitted';
          } else {
            status = 'draft';
          }
        }

        return {
          id: submission?.id || `pending-${studentId}`,
          student_id: studentId,
          student_name: student?.full_name || student?.email || 'Unknown',
          student_email: student?.email || '',
          status,
          submitted_at: submission?.submitted_at || null,
          grade: submission?.grade ?? null,
          feedback: submission?.feedback || null,
          content: submission?.content || null,
          attachments: subAttachments.map((a: any) => ({
            id: a.id,
            file_name: a.file_name,
            file_size: a.file_size,
            file_url: a.file_url,
            file_type: a.file_type,
          })),
          comments: subComments,
        };
      });

      const submittedCount = builtSubmissions.filter(s => s.status === 'submitted' || s.status === 'graded').length;
      const gradedCount = builtSubmissions.filter(s => s.status === 'graded').length;

      setAssignment({
        id: assignmentData.id,
        title: assignmentData.title,
        due_date: assignmentData.due_date,
        total_students: assignedStudentIds.length,
        submitted: submittedCount,
        graded: gradedCount,
      });

      setSubmissions(builtSubmissions);

      const firstUngraded = builtSubmissions.find(s => s.status === 'submitted');
      setSelectedSubmission(firstUngraded || builtSubmissions[0] || null);
    } catch (err: any) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGrade = async () => {
    if (!selectedSubmission || !assignment) return;
    if (selectedSubmission.id.startsWith('pending-')) return;

    const gradeNum = parseFloat(grade);
    if (grade && (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100)) {
      setError('Grade must be 0-100');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const feedbackHtml = editor?.getHTML() || '';
      const updatePayload: any = { grade: grade ? gradeNum : null };
      if (feedbackColumn !== 'none') {
        updatePayload.feedback = feedbackHtml;
      }

      const { error: updateError } = await supabase
        .from('submissions')
        .update(updatePayload)
        .eq('id', selectedSubmission.id);

      if (updateError) throw updateError;

      const updatedStatus = grade ? 'graded' : selectedSubmission.status;

      const updatedSubmissions = submissions.map(s =>
        s.id === selectedSubmission.id
          ? { ...s, grade: grade ? gradeNum : null, feedback: feedbackHtml, status: updatedStatus }
          : s
      );

      setSubmissions(updatedSubmissions);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Clear and move to next
      setGrade('');
      editor?.commands.setContent('<p>Write your feedback here...</p>');
      
      const currentIndex = updatedSubmissions.findIndex(s => s.id === selectedSubmission.id);
      const nextUngraded = updatedSubmissions.slice(currentIndex + 1).find(s => s.status === 'submitted');
      
      if (nextUngraded) {
        setSelectedSubmission(nextUngraded);
      } else {
        // Check if all submitted assignments are now graded
        const allGraded = updatedSubmissions.filter(s => s.status === 'submitted' || s.status === 'graded')
          .every(s => s.status === 'graded');
        
        if (allGraded) {
          setSelectedSubmission(null);
        }
      }
    } catch (err: any) {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !selectedSubmission || !user) return;
    if (selectedSubmission.id.startsWith('pending-')) return;

    try {
      setSendingComment(true);
      setError(null);

      const { data: commentData, error: commentError } = await supabase
        .from('comments')
        .insert({
          assignment_id: assignment?.id,
          user_id: user.id,
          message: newComment.trim(),
        })
        .select('id, created_at')
        .single();

      if (commentError) {
        setError('Failed to send comment');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single();

      const newCommentObj: Comment = {
        id: commentData.id,
        author_name: profileData?.full_name || 'Teacher',
        role: profileData?.role || 'teacher',
        message: newComment.trim(),
        created_at: commentData.created_at,
      };

      setSubmissions(prev =>
        prev.map(s =>
          s.id === selectedSubmission.id
            ? { ...s, comments: [...s.comments, newCommentObj] }
            : s
        )
      );
      setSelectedSubmission(prev =>
        prev ? { ...prev, comments: [...prev.comments, newCommentObj] } : prev
      );

      setNewComment('');
    } catch (err: any) {
      setError('Failed to send');
    } finally {
      setSendingComment(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'graded': return isDark ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'pending': return isDark ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200';
      case 'draft': return isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200';
      default: return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted': return <CheckCircle className="w-4 h-4" />;
      case 'graded': return <Award className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'draft': return <FileText className="w-4 h-4" />;
      default: return null;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not submitted';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch =
      sub.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.student_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || sub.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const canGrade = selectedSubmission &&
    (selectedSubmission.status === 'submitted' || selectedSubmission.status === 'graded');

  const editorButtons = [
    { icon: Bold, label: 'Bold', action: () => editor?.chain().focus().toggleBold().run(), isActive: editor?.isActive('bold') },
    { icon: Italic, label: 'Italic', action: () => editor?.chain().focus().toggleItalic().run(), isActive: editor?.isActive('italic') },
    { icon: List, label: 'Bullet List', action: () => editor?.chain().focus().toggleBulletList().run(), isActive: editor?.isActive('bulletList') },
    { icon: ListOrdered, label: 'Numbered List', action: () => editor?.chain().focus().toggleOrderedList().run(), isActive: editor?.isActive('orderedList') },
    { icon: Undo, label: 'Undo', action: () => editor?.chain().focus().undo().run(), isActive: false },
    { icon: Redo, label: 'Redo', action: () => editor?.chain().focus().redo().run(), isActive: false },
  ];

  return (
    <ProtectedRoute requiredRole="teacher">
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        <TeacherSidebar isDark={isDark} isSidebarOpen={isSidebarOpen} currentPage="grading" />

        <main className="lg:ml-64">
          <header className={`sticky top-0 z-20 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b`}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg lg:hidden ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}>
                  <Menu className="w-5 h-5" />
                </button>
                <button onClick={() => router.push('/teacher/assignments')} className={`p-2 rounded-lg hidden lg:flex ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}>
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {loading ? 'Loading...' : assignment?.title || 'Grading'}
                  </h2>
                  {assignment && (
                    <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {assignment.submitted} submitted • {assignment.graded} graded • {assignment.total_students} total
                    </p>
                  )}
                </div>
              </div>
              <button onClick={toggleTheme} className={`p-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </header>

          {feedbackColumn === 'none' && !loading && (
            <div className="mx-4 mt-4 p-3 bg-amber-500/20 border border-amber-500 rounded-xl text-amber-600 text-sm">
              <strong>Missing column:</strong> Run: <code className="ml-2 px-2 py-0.5 rounded bg-black/10 font-mono text-xs">ALTER TABLE submissions ADD COLUMN feedback TEXT;</code>
            </div>
          )}

          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500 rounded-xl text-red-500 text-sm flex items-center justify-between">
              {error}
              <button onClick={() => setError(null)} className="text-xs underline">Dismiss</button>
            </div>
          )}

          {saveSuccess && (
            <div className="mx-4 mt-4 p-3 bg-emerald-500/20 border border-emerald-500 rounded-xl text-emerald-500 text-sm">
              Grade saved!
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : !assignment ? (
            <div className={`m-6 rounded-2xl p-12 text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <FileText className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
              <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>No Assignments</h3>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row">
              <div className={`lg:w-80 xl:w-96 lg:h-[calc(100vh-73px)] lg:sticky lg:top-[73px] border-r ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} overflow-y-auto`}>
                <div className="p-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'} focus:outline-none`}
                    />
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                      className={`w-full px-4 py-2 rounded-xl border flex items-center justify-between text-sm ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        <span>{filterStatus === 'all' ? 'All' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}</span>
                      </div>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {showFilterDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                        <div className={`absolute top-full mt-2 left-0 right-0 rounded-xl shadow-lg border z-20 ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                          {['all', 'submitted', 'graded', 'draft', 'pending'].map((status) => (
                            <button
                              key={status}
                              onClick={() => { setFilterStatus(status); setShowFilterDropdown(false); }}
                              className={`w-full px-4 py-2.5 text-left text-sm first:rounded-t-xl last:rounded-b-xl ${filterStatus === status ? isDark ? 'bg-emerald-600/20' : 'bg-emerald-50' : isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-100'}`}
                            >
                              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    {filteredSubmissions.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedSubmission(sub)}
                        className={`w-full text-left p-3 rounded-xl ${
                          selectedSubmission?.id === sub.id
                            ? isDark ? 'bg-emerald-600/20 border-2 border-emerald-600' : 'bg-emerald-50 border-2 border-emerald-600'
                            : isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{sub.student_name}</p>
                            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{sub.student_email}</p>
                          </div>
                          {sub.grade !== null && (
                            <div className={`px-2 py-1 rounded-lg ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                              <span className={`text-xs font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{sub.grade}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${getStatusColor(sub.status)}`}>
                            {getStatusIcon(sub.status)}
                            {sub.status}
                          </span>
                          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {formatDate(sub.submitted_at)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pb-20 lg:pb-6">
                {!selectedSubmission ? (
                  (() => {
                    const submittedAndGraded = submissions.filter(s => s.status === 'submitted' || s.status === 'graded');
                    const allGraded = submittedAndGraded.length > 0 && submittedAndGraded.every(s => s.status === 'graded');
                    
                    return allGraded ? (
                      // Congratulations screen
                      <div className={`m-6 rounded-2xl p-12 text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                        <div className="flex justify-center mb-6">
                          <div className="relative">
                            <Award className={`w-24 h-24 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                            <div className="absolute -top-2 -right-2 w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        </div>
                        <h3 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          All Graded! 🎉
                        </h3>
                        <p className={`text-base mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          You've graded all submitted assignments for "{assignment?.title}"
                        </p>
                        <button
                          onClick={() => router.push('/teacher/dashboard')}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
                        >
                          <ArrowLeft className="w-5 h-5" />
                          Back to Dashboard
                        </button>
                      </div>
                    ) : (
                      // Select a student screen
                      <div className={`m-6 rounded-2xl p-12 text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                        <User className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Select a student</p>
                      </div>
                    );
                  })()
                ) : (
                  <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6">

                    {(selectedSubmission.status === 'pending' || selectedSubmission.status === 'draft') && (
                      <div className={`rounded-xl p-12 text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                        <Clock className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                        <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {selectedSubmission.status === 'draft' ? 'Draft' : 'No Submission'}
                        </h3>
                      </div>
                    )}

                    {canGrade && (
                      <>
                        <div className={`rounded-xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-emerald-600 p-2 rounded-xl">
                                <User className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedSubmission.student_name}</h3>
                                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{selectedSubmission.student_email}</p>
                              </div>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs border flex items-center gap-1 ${getStatusColor(selectedSubmission.status)}`}>
                              {getStatusIcon(selectedSubmission.status)}
                              {selectedSubmission.status}
                            </span>
                          </div>
                        </div>

                        {selectedSubmission.content && (
                          <div className={`rounded-xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                            <h4 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Submission</h4>
                            <div
                              className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}
                              dangerouslySetInnerHTML={{ __html: selectedSubmission.content }}
                            />
                          </div>
                        )}

                        {selectedSubmission.attachments.length > 0 && (
                          <div className={`rounded-xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                            <h4 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Files</h4>
                            <div className="space-y-2">
                              {selectedSubmission.attachments.map((file) => (
                                <div key={file.id} className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                                  <div className="flex items-center gap-3">
                                    <FileText className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                                    <div>
                                      <p className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{file.file_name}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <a href={file.file_url} target="_blank" rel="noopener noreferrer" className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-200'}`}>
                                      <Eye className="w-3 h-3" />
                                    </a>
                                    <a href={file.file_url} download className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-200'}`}>
                                      <Download className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className={`rounded-xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                          <h4 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Grade & Feedback</h4>

                          <div className="mb-4">
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Grade (0-100)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={grade}
                              onChange={(e) => setGrade(e.target.value)}
                              placeholder="Enter grade"
                              className={`w-32 px-4 py-2 rounded-xl border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'} focus:outline-none`}
                            />
                          </div>

                          <div>
                            <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Feedback</label>
                            <div className={`flex flex-wrap gap-1 p-2 rounded-t-xl border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-300'}`}>
                              {editorButtons.map((btn, idx) => (
                                <button key={idx} onClick={btn.action} type="button"
                                  className={`p-2 rounded-lg ${btn.isActive ? isDark ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700' : isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-200'}`}
                                >
                                  <btn.icon className="w-4 h-4" />
                                </button>
                              ))}
                            </div>
                            <div className={`rounded-b-xl border border-t-0 min-h-[150px] ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'}`}>
                              <EditorContent editor={editor} className={`px-4 py-3 ${isDark ? 'text-white' : 'text-slate-900'}`} />
                            </div>
                          </div>

                          <button
                            onClick={handleSaveGrade}
                            disabled={saving}
                            className="mt-4 py-3 px-6 rounded-xl font-medium bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 disabled:opacity-60"
                          >
                            {saving ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div> : <Save className="w-4 h-4" />}
                            {saving ? 'Saving...' : 'Save & Next'}
                          </button>
                        </div>

                        <div className={`rounded-xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                          <button onClick={() => setShowComments(!showComments)} className="w-full flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <MessageSquare className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                              <h4 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                Discussion ({selectedSubmission.comments.length})
                              </h4>
                            </div>
                            {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>

                          {showComments && (
                            <div className="space-y-4">
                              {selectedSubmission.comments.length === 0 ? (
                                <p className={`text-sm text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No comments</p>
                              ) : (
                                <div className="space-y-3">
                                  {selectedSubmission.comments.map((comment) => (
                                    <div key={comment.id} className={`p-3 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <p className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{comment.author_name}</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                          comment.role === 'student' ? isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600' : isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                                        }`}>
                                          {comment.role}
                                        </span>
                                      </div>
                                      <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{comment.message}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  placeholder="Comment..."
                                  className={`flex-1 px-4 py-2 rounded-xl border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'} focus:outline-none`}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendComment(); }}
                                />
                                <button
                                  onClick={handleSendComment}
                                  disabled={!newComment.trim() || sendingComment}
                                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                                >
                                  {sendingComment ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div> : <Send className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <style jsx global>{`
          .ProseMirror { min-height: 150px; outline: none; }
          .ProseMirror p { margin: 0.5em 0; }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}

export default function TeacherGradingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div></div>}>
      <TeacherGradingView />
    </Suspense>
  );
}
