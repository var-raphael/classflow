'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { 
  Sun, Moon, Menu, ArrowLeft, Calendar, Clock, User, Upload, File,
  Trash2, Send, Save, MessageSquare, ChevronDown, ChevronUp,
  Bold, Italic, List, ListOrdered, Undo, Redo, Download, Eye,
  FileText, Loader2, AlertCircle, Lock
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import StudentSidebar from '@/components/StudentSidebar';

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  created_at: string;
  status: string;
  teacher_id: string;
  teacher?: { full_name: string; email: string; };
}

interface AssignmentAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
}

interface Submission {
  id: string;
  content: string;
  submitted_at: string | null;
  grade: number | null;
  feedback: string | null;
}

interface SubmissionAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
}

interface Comment {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  user?: { full_name: string; role: string; };
}

export default function StudentAssignmentSubmitPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const assignmentId = params.id as string;

  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [error, setError] = useState('');

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [teacherAttachments, setTeacherAttachments] = useState<AssignmentAttachment[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [submissionAttachments, setSubmissionAttachments] = useState<SubmissionAttachment[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(true);
  const [newComment, setNewComment] = useState('');

  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Start writing your submission here...</p>',
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
    if (user && assignmentId) fetchAssignmentData();
  }, [user, assignmentId]);

  const fetchAssignmentData = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select(`*, teacher:profiles!teacher_id (full_name, email)`)
        .eq('id', assignmentId)
        .single();

      if (assignmentError) throw assignmentError;
      setAssignment(assignmentData);

      const { data: attachmentsData } = await supabase
        .from('assignment_attachments')
        .select('*')
        .eq('assignment_id', assignmentId);
      setTeacherAttachments(attachmentsData || []);

      // Check access
      const { data: assignmentStudent, error: accessError } = await supabase
        .from('assignment_students')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user?.id)
        .single();

      if (accessError || !assignmentStudent) {
        setError('You do not have access to this assignment.');
        return;
      }

      const { data: submissionData } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user?.id)
        .maybeSingle();

      if (submissionData) {
        setSubmission(submissionData);
        if (editor && submissionData.content) {
          editor.commands.setContent(submissionData.content);
        }
        const { data: subAttachments } = await supabase
          .from('submission_attachments')
          .select('*')
          .eq('submission_id', submissionData.id);
        setSubmissionAttachments(subAttachments || []);
      }

      const { data: commentsData } = await supabase
        .from('comments')
        .select(`*, user:profiles!user_id (full_name, role)`)
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: true });
      setComments(commentsData || []);

    } catch (err: any) {
      setError(err.message || 'Failed to load assignment');
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  // Derived state
  const isSubmitted = !!submission?.submitted_at;
  const isClosed = assignment?.status === 'closed'; // teacher locked it
  // Can edit if: not submitted AND not closed
  const canEdit = !isSubmitted && !isClosed;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name} is too large. Max 10MB.`);
          return false;
        }
        return true;
      });
      setUploadedFiles([...uploadedFiles, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const deleteSubmissionAttachment = async (attachmentId: string, fileUrl: string) => {
    if (!confirm('Delete this file?')) return;
    try {
      const fileName = fileUrl.split('/').pop();
      if (fileName) await supabase.storage.from('submission-files').remove([fileName]);
      await supabase.from('submission_attachments').delete().eq('id', attachmentId);
      setSubmissionAttachments(submissionAttachments.filter(att => att.id !== attachmentId));
    } catch (err: any) {
      alert('Failed to delete file');
    }
  };

  const uploadFilesToStorage = async (submissionId: string) => {
    const results: { file_name: string; file_url: string; file_size: number }[] = [];
    for (const file of uploadedFiles) {
      try {
        const ext = file.name.split('.').pop();
        const fileName = `${submissionId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error } = await supabase.storage.from('submission-files').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('submission-files').getPublicUrl(fileName);
        results.push({ file_name: file.name, file_url: publicUrl, file_size: file.size });
      } catch (err) {
        console.error('Upload error:', file.name, err);
      }
    }
    return results;
  };

  const saveSubmissionAttachments = async (submissionId: string, fileData: { file_name: string; file_url: string; file_size: number }[]) => {
    const { error } = await supabase.from('submission_attachments').insert(
      fileData.map(f => ({ submission_id: submissionId, ...f }))
    );
    if (error) throw error;
  };

  const handleSaveDraft = async () => {
    if (!user || !assignment || !canEdit) return;
    const content = editor?.getHTML() || '';
    if (!content || content === '<p></p>') { alert('Please add some content before saving'); return; }

    try {
      setSaving(true);
      setError('');
      let submissionId = submission?.id;

      if (submission) {
        await supabase.from('submissions').update({ content, updated_at: new Date().toISOString() }).eq('id', submission.id);
      } else {
        const { data: newSub, error: insertError } = await supabase
          .from('submissions')
          .insert({ assignment_id: assignmentId, student_id: user.id, content, submitted_at: null })
          .select().single();
        if (insertError) throw insertError;
        submissionId = newSub.id;
        setSubmission(newSub);
      }

      if (uploadedFiles.length > 0 && submissionId) {
        setUploadingFiles(true);
        const fileData = await uploadFilesToStorage(submissionId);
        await saveSubmissionAttachments(submissionId, fileData);
        setUploadedFiles([]);
        const { data: subAttachments } = await supabase.from('submission_attachments').select('*').eq('submission_id', submissionId);
        setSubmissionAttachments(subAttachments || []);
        setUploadingFiles(false);
      }

      alert('Draft saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !assignment || !canEdit) return;
    const content = editor?.getHTML() || '';
    if (!content || content === '<p></p>') { alert('Please add some content before submitting'); return; }
    if (!confirm('Submit this assignment? You cannot edit after submission.')) return;

    try {
      setSubmitting(true);
      setError('');
      let submissionId = submission?.id;

      if (submission) {
        await supabase.from('submissions').update({ content, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', submission.id);
      } else {
        const { data: newSub, error: insertError } = await supabase
          .from('submissions')
          .insert({ assignment_id: assignmentId, student_id: user.id, content, submitted_at: new Date().toISOString() })
          .select().single();
        if (insertError) throw insertError;
        submissionId = newSub.id;
        setSubmission(newSub);
      }

      if (uploadedFiles.length > 0 && submissionId) {
        setUploadingFiles(true);
        const fileData = await uploadFilesToStorage(submissionId);
        await saveSubmissionAttachments(submissionId, fileData);
        setUploadedFiles([]);
        setUploadingFiles(false);
      }

      alert('Assignment submitted successfully!');
      router.push('/student/assignments');
    } catch (err: any) {
      setError(err.message || 'Failed to submit assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({ assignment_id: assignmentId, user_id: user.id, message: newComment.trim() })
        .select(`*, user:profiles!user_id (full_name, role)`)
        .single();
      if (error) throw error;
      setComments([...comments, data]);
      setNewComment('');
    } catch (err: any) {
      alert('Failed to post comment');
    }
  };

  const downloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch { alert('Failed to download file'); }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getDaysRemaining = () => {
    if (!assignment) return { text: '', color: '' };
    const diff = Math.ceil((new Date(assignment.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: 'Overdue', color: 'text-red-500' };
    if (diff === 0) return { text: 'Due today', color: 'text-amber-500' };
    if (diff === 1) return { text: 'Due tomorrow', color: 'text-amber-500' };
    return { text: `${diff} days left`, color: 'text-emerald-500' };
  };

  const editorButtons = [
    { icon: Bold, label: 'Bold', action: () => editor?.chain().focus().toggleBold().run(), isActive: editor?.isActive('bold') },
    { icon: Italic, label: 'Italic', action: () => editor?.chain().focus().toggleItalic().run(), isActive: editor?.isActive('italic') },
    { icon: List, label: 'Bullet List', action: () => editor?.chain().focus().toggleBulletList().run(), isActive: editor?.isActive('bulletList') },
    { icon: ListOrdered, label: 'Numbered List', action: () => editor?.chain().focus().toggleOrderedList().run(), isActive: editor?.isActive('orderedList') },
    { icon: Undo, label: 'Undo', action: () => editor?.chain().focus().undo().run(), isActive: false },
    { icon: Redo, label: 'Redo', action: () => editor?.chain().focus().redo().run(), isActive: false },
  ];

  const daysRemaining = getDaysRemaining();

  if (loading) {
    return (
      <ProtectedRoute requiredRole="student">
        <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
          <div className="text-center">
            <Loader2 className={`w-12 h-12 animate-spin mx-auto mb-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>Loading assignment...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error && !assignment) {
    return (
      <ProtectedRoute requiredRole="student">
        <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className={`text-lg mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{error}</p>
            <button onClick={() => router.push('/student/assignments')} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
              Back to Assignments
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="student">
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        <StudentSidebar isDark={isDark} isSidebarOpen={isSidebarOpen} currentPage="assignment-submit" />

        <main className="lg:ml-64">
          <header className={`sticky top-0 z-20 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b`}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4">
              <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg lg:hidden ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}>
                  <Menu className="w-5 h-5" />
                </button>
                <button onClick={() => router.push('/student/assignments')} className={`p-2 rounded-lg hidden lg:flex ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}>
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{assignment?.title}</h2>
                    {isClosed && (
                      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                        <Lock className="w-3 h-3" /> Closed
                      </span>
                    )}
                  </div>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} hidden sm:block`}>{assignment?.teacher?.full_name}</p>
                </div>
              </div>
              <button onClick={toggleTheme} className={`p-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </header>

          <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-20 lg:pb-6">

            {/* ── CLOSED BANNER ── */}
            {isClosed && !isSubmitted && (
              <div className={`rounded-xl p-4 flex items-center gap-3 ${isDark ? 'bg-slate-700/50 border border-slate-600' : 'bg-slate-100 border border-slate-300'}`}>
                <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-600' : 'bg-slate-200'}`}>
                  <Lock className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                </div>
                <div>
                  <p className={`font-semibold text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Submissions Closed</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Your teacher has closed submissions for this assignment. You can still view the instructions and discussion.</p>
                </div>
              </div>
            )}

            {/* ── SUBMITTED BANNER ── */}
            {isSubmitted && submission?.submitted_at && (
              <div className={`rounded-xl p-4 ${isDark ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'}`}>
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-600 p-2 rounded-lg">
                    <Send className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={`font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Assignment Submitted</p>
                    <p className={`text-sm ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>Submitted on {formatDate(submission.submitted_at)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── GRADE/FEEDBACK BANNER ── */}
            {submission?.grade !== null && submission?.grade !== undefined && (
              <div className={`rounded-xl p-4 sm:p-6 ${isDark ? 'bg-indigo-500/20 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className={`font-semibold ${isDark ? 'text-indigo-400' : 'text-indigo-700'}`}>Grade Received</p>
                  <span className={`text-2xl font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>{submission.grade}%</span>
                </div>
                {submission.feedback && (
                  <div>
                    <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>Teacher Feedback</p>
                    <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`} dangerouslySetInnerHTML={{ __html: submission.feedback }} />
                  </div>
                )}
              </div>
            )}

            {/* Assignment Info */}
            <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 p-2 sm:p-3 rounded-xl">
                    <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h3 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{assignment?.teacher?.full_name}</h3>
                    <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{assignment?.teacher?.email}</p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 ${
                  isClosed && !isSubmitted
                    ? isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
                    : isSubmitted
                    ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                    : isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-600'
                }`}>
                  {isClosed && !isSubmitted && <Lock className="w-4 h-4" />}
                  {isClosed && !isSubmitted ? 'Closed' : isSubmitted ? 'Submitted' : 'Pending'}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <Calendar className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Due: {formatDate(assignment?.due_date || '')}</span>
                </div>
                {!isSubmitted && !isClosed && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Clock className={`w-4 h-4 ${daysRemaining.color}`} />
                    <span className={`font-medium ${daysRemaining.color}`}>{daysRemaining.text}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Assignment Description */}
            <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
              <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Assignment Instructions</h3>
              <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`} dangerouslySetInnerHTML={{ __html: assignment?.description || '' }} />
            </div>

            {/* Teacher's Attachments */}
            {teacherAttachments.length > 0 && (
              <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Reference Materials</h3>
                <div className="space-y-2">
                  {teacherAttachments.map((file) => (
                    <div key={file.id} className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                      <div className="flex items-center gap-3">
                        <FileText className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                        <div>
                          <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{file.file_name}</p>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{(file.file_size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button onClick={() => window.open(file.file_url, '_blank')} className={`p-1.5 sm:p-2 rounded-lg ${isDark ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}><Eye className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                        <button onClick={() => downloadFile(file.file_url, file.file_name)} className={`p-1.5 sm:p-2 rounded-lg ${isDark ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}><Download className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submission Editor */}
            <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
              <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Your Submission</h3>

              {/* Closed notice inside editor */}
              {isClosed && !isSubmitted && (
                <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  <Lock className="w-4 h-4 flex-shrink-0" />
                  <p className="text-sm">Submissions are closed. You cannot submit or edit this assignment.</p>
                </div>
              )}

              {isSubmitted && (
                <div className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                  <p className="text-sm">This assignment has been submitted and cannot be edited.</p>
                </div>
              )}

              {canEdit && (
                <div className={`flex flex-wrap gap-1 p-2 rounded-t-xl border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-300'}`}>
                  {editorButtons.map((btn, idx) => (
                    <button key={idx} onClick={btn.action} type="button"
                      className={`p-1.5 sm:p-2 rounded-lg transition-colors ${btn.isActive ? isDark ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700' : isDark ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}
                      title={btn.label}
                    >
                      <btn.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  ))}
                </div>
              )}

              <div className={`${canEdit ? 'rounded-b-xl border border-t-0' : 'rounded-xl border'} min-h-[300px] ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'} ${!canEdit ? 'opacity-75' : ''}`}>
                <EditorContent editor={editor} className={`px-3 sm:px-4 py-2 sm:py-3 ${isDark ? 'text-white' : 'text-slate-900'}`} />
              </div>
            </div>

            {/* File Upload — hidden when closed and not submitted */}
            <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
              <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Attachments</h3>

              {canEdit && (
                <div className={`border-2 border-dashed rounded-xl p-6 text-center ${isDark ? 'border-slate-600 bg-slate-700/50' : 'border-slate-300 bg-slate-50'}`}>
                  <Upload className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
                  <p className={`text-xs sm:text-sm mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Drag and drop or</p>
                  <label className="inline-block">
                    <span className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 rounded-xl text-sm font-medium cursor-pointer">Browse Files</span>
                    <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>PDF, JPG, PNG, DOCX up to 10MB each</p>
                </div>
              )}

              {submissionAttachments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Uploaded Files</p>
                  {submissionAttachments.map((file) => (
                    <div key={file.id} className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                      <div className="flex items-center gap-3">
                        <File className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                        <div>
                          <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{file.file_name}</p>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{(file.file_size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => window.open(file.file_url, '_blank')} className={`p-1.5 sm:p-2 rounded-lg ${isDark ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}><Eye className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                        {canEdit && (
                          <button onClick={() => deleteSubmissionAttachment(file.id, file.file_url)} className="p-1.5 sm:p-2 rounded-lg hover:bg-red-500/20 text-red-500"><Trash2 className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {uploadedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>New Files (pending upload)</p>
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                      <div className="flex items-center gap-3">
                        <File className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                        <div>
                          <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{file.name}</p>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button onClick={() => removeFile(idx)} className="p-1.5 sm:p-2 rounded-lg hover:bg-red-500/20 text-red-500"><Trash2 className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
              <button onClick={() => setShowComments(!showComments)} className="w-full flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Discussion ({comments.length})</h3>
                </div>
                {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showComments && (
                <div className="space-y-4">
                  {comments.length > 0 && (
                    <div className="space-y-3">
                      {comments.map((comment) => (
                        <div key={comment.id} className={`p-3 sm:p-4 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <p className={`font-semibold text-xs sm:text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{comment.user?.full_name || 'Unknown'}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${comment.user?.role === 'student' ? isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600' : isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                              {comment.user?.role || 'user'}
                            </span>
                            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{formatDate(comment.created_at)}</span>
                          </div>
                          <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{comment.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Ask a question..."
                      className={`flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-sm rounded-xl border ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'} focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
                    />
                    <button onClick={handleSubmitComment} disabled={!newComment.trim()} className="p-2 sm:p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                      <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons — only shown if canEdit */}
            {canEdit && (
              <div className="flex flex-col sm:flex-row gap-3 sticky bottom-4 sm:bottom-6">
                <button onClick={handleSaveDraft} disabled={saving || submitting || uploadingFiles}
                  className={`flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl text-sm sm:text-base font-medium flex items-center justify-center gap-2 ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4 sm:w-5 sm:h-5" />Save Draft</>}
                </button>
                <button onClick={handleSubmit} disabled={saving || submitting || uploadingFiles}
                  className="flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl text-sm sm:text-base font-medium bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</> : <><Send className="w-4 h-4 sm:w-5 sm:h-5" />Submit Assignment</>}
                </button>
              </div>
            )}
          </div>
        </main>

        <style jsx global>{`
          .ProseMirror { min-height: 300px; outline: none; }
          .ProseMirror p { margin: 0.5em 0; }
          .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; margin: 0.5em 0; }
          .ProseMirror li { margin: 0.25em 0; }
          .ProseMirror strong { font-weight: 600; }
          .ProseMirror em { font-style: italic; }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
