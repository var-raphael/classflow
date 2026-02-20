'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { 
  Sun,
  Moon,
  Menu,
  ArrowLeft,
  Trash2,
  Upload,
  Bold,
  Italic,
  List,
  ListOrdered,
  Send,
  Save,
  File,
  Calendar,
  Clock,
  Undo,
  Redo,
  X
} from 'lucide-react';
import TeacherSidebar from '@/components/TeacherSidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

interface Student {
  id: string;
  name: string;
  email: string;
}

interface ExistingFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
}

export default function TeacherAssignmentCreate() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('id');
  const isEditMode = !!assignmentId;
  
  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');

  // TipTap Editor
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Describe the assignment, requirements, and grading criteria...</p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none focus:outline-none ${
          isDark ? 'prose-invert' : ''
        }`,
      },
    },
  });

  // Load theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
    }
  }, []);

  // Fetch students
  useEffect(() => {
    if (user) {
      fetchStudents();
    }
  }, [user]);

  // Load assignment data if editing
  useEffect(() => {
    if (assignmentId && editor && students.length > 0) {
      loadAssignment(assignmentId);
    }
  }, [assignmentId, editor, students]);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      const { data, error: studentsError } = await supabase
        .from('teacher_students')
        .select(`
          profiles:student_id (
            id,
            email,
            full_name
          )
        `)
        .eq('teacher_id', user?.id);

      if (studentsError) throw studentsError;

      const studentsList = (data || []).map((ts: any) => ({
        id: ts.profiles.id,
        name: ts.profiles.full_name || 'Unknown',
        email: ts.profiles.email
      }));

      setStudents(studentsList);
    } catch (err: any) {
      console.error('Error fetching students:', err);
      setError('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignment = async (id: string) => {
    try {
      setError(null);

      const { data, error: loadError } = await supabase
        .from('assignments')
        .select(`
          *,
          assignment_students (student_id),
          assignment_attachments (id, file_name, file_url, file_size, file_type)
        `)
        .eq('id', id)
        .eq('teacher_id', user?.id)
        .single();

      if (loadError) {
        setError('Failed to load assignment. It may not exist or you do not have permission.');
        return;
      }

      // Pre-fill form with existing data
      setTitle(data.title);

      const dateObj = new Date(data.due_date);
      setDueDate(dateObj.toISOString().split('T')[0]);
      setDueTime(dateObj.toTimeString().substring(0, 5));

      if (editor) {
        editor.commands.setContent(data.description || '');
      }

      const assignedStudentIds = data.assignment_students?.map((s: any) => s.student_id) || [];
      setSelectedStudents(assignedStudentIds);

      // Load existing attachments
      setExistingFiles(data.assignment_attachments || []);

    } catch (err: any) {
      setError('Failed to load assignment');
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
    setSelectAll(!selectAll);
  };

  const toggleStudent = (id: string) => {
    if (selectedStudents.includes(id)) {
      setSelectedStudents(selectedStudents.filter(sid => sid !== id));
    } else {
      setSelectedStudents([...selectedStudents, id]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      // Check file size (10MB limit per file)
      const validFiles = newFiles.filter(file => file.size <= 10 * 1024 * 1024);
      if (validFiles.length !== newFiles.length) {
        setError('Some files were too large (max 10MB per file)');
      }
      setUploadedFiles([...uploadedFiles, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const removeExistingFile = async (file: ExistingFile) => {
    try {
      // Extract file path from URL for storage deletion
      const url = new URL(file.file_url);
      const pathParts = url.pathname.split('/assignment-files/');
      const storagePath = pathParts[1];

      // Delete from storage bucket
      if (storagePath) {
        await supabase.storage
          .from('assignment-files')
          .remove([storagePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from('assignment_attachments')
        .delete()
        .eq('id', file.id);

      if (error) {
        setError('Failed to delete file');
        return;
      }

      // Remove from UI
      setExistingFiles(prev => prev.filter(f => f.id !== file.id));

    } catch (err: any) {
      setError('Failed to delete file');
    }
  };

  const validateForm = () => {
    if (!title.trim()) {
      setError('Please enter an assignment title');
      return false;
    }
    if (!dueDate) {
      setError('Please select a due date');
      return false;
    }
    if (!dueTime) {
      setError('Please select a due time');
      return false;
    }
    if (!editor?.getHTML() || editor.getHTML() === '<p></p>') {
      setError('Please enter assignment description');
      return false;
    }
    if (selectedStudents.length === 0) {
      setError('Please select at least one student');
      return false;
    }
    return true;
  };

  const handleSubmit = async (isDraft: boolean) => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      setError(null);

      const dueDateTime = new Date(`${dueDate}T${dueTime}`).toISOString();
      const newStatus = isDraft ? 'draft' : 'active';

      if (isEditMode && assignmentId) {
        // ── UPDATE existing assignment ──
        const { error: updateError } = await supabase
          .from('assignments')
          .update({
            title: title.trim(),
            description: editor?.getHTML(),
            due_date: dueDateTime,
            status: newStatus
          })
          .eq('id', assignmentId);

        if (updateError) {
          setError(`Database error: ${updateError.message}`);
          setSubmitting(false);
          return;
        }

        // Update assigned students:
        // Delete old ones and re-insert new selection
        await supabase
          .from('assignment_students')
          .delete()
          .eq('assignment_id', assignmentId);

        if (selectedStudents.length > 0) {
          const { error: assignError } = await supabase
            .from('assignment_students')
            .insert(
              selectedStudents.map(studentId => ({
                assignment_id: assignmentId,
                student_id: studentId,
                status: 'unseen'
              }))
            );

          if (assignError) {
            setError(`Failed to update students: ${assignError.message}`);
            setSubmitting(false);
            return;
          }
        }

        // Upload any new files added during edit
        if (uploadedFiles.length > 0) {
          for (const file of uploadedFiles) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${assignmentId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('assignment-files')
              .upload(filePath, file);

            if (uploadError) continue;

            const { data: { publicUrl } } = supabase.storage
              .from('assignment-files')
              .getPublicUrl(filePath);

            await supabase
              .from('assignment_attachments')
              .insert({
                assignment_id: assignmentId,
                file_name: file.name,
                file_url: publicUrl,
                file_size: file.size,
                file_type: file.type
              });
          }
        }

        router.push('/teacher/assignments');

      } else {
        // ── CREATE new assignment ──
        const { data: assignment, error: assignmentError } = await supabase
          .from('assignments')
          .insert({
            teacher_id: user?.id,
            title: title.trim(),
            description: editor?.getHTML(),
            due_date: dueDateTime,
            status: newStatus
          })
          .select()
          .single();

        if (assignmentError) {
          setError(`Database error: ${assignmentError.message}`);
          setSubmitting(false);
          return;
        }

        // Upload files to Supabase Storage
        if (uploadedFiles.length > 0) {
          for (const file of uploadedFiles) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${assignment.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('assignment-files')
              .upload(filePath, file);

            if (uploadError) continue;

            const { data: { publicUrl } } = supabase.storage
              .from('assignment-files')
              .getPublicUrl(filePath);

            await supabase
              .from('assignment_attachments')
              .insert({
                assignment_id: assignment.id,
                file_name: file.name,
                file_url: publicUrl,
                file_size: file.size,
                file_type: file.type
              });
          }
        }

        // Assign to selected students
        const assignmentStudents = selectedStudents.map(studentId => ({
          assignment_id: assignment.id,
          student_id: studentId,
          status: 'unseen'
        }));

        const { error: assignError } = await supabase
          .from('assignment_students')
          .insert(assignmentStudents);

        if (assignError) {
          setError(`Failed to assign students: ${assignError.message}`);
          setSubmitting(false);
          return;
        }

        router.push('/teacher/assignments');
      }

    } catch (err: any) {
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!editor) {
    return null;
  }

  const editorButtons = [
    { 
      icon: Bold, 
      label: 'Bold',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold')
    },
    { 
      icon: Italic, 
      label: 'Italic',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic')
    },
    { 
      icon: List, 
      label: 'Bullet List',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList')
    },
    { 
      icon: ListOrdered, 
      label: 'Numbered List',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList')
    },
    { 
      icon: Undo, 
      label: 'Undo',
      action: () => editor.chain().focus().undo().run(),
      isActive: false
    },
    { 
      icon: Redo, 
      label: 'Redo',
      action: () => editor.chain().focus().redo().run(),
      isActive: false
    },
  ];

  return (
    <ProtectedRoute requiredRole="teacher">
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
        <TeacherSidebar 
          isDark={isDark}
          isSidebarOpen={isSidebarOpen}
          currentPage="assignments"
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
                  className={`p-2 rounded-lg lg:hidden ${
                    isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <Menu className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => router.back()}
                  className={`p-2 rounded-lg hidden lg:flex ${
                    isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isEditMode ? 'Edit Assignment' : 'Create Assignment'}
                  </h2>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} hidden sm:block`}>
                    {isEditMode ? 'Update your assignment details' : 'Create and send assignments to your students'}
                  </p>
                </div>
              </div>

              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg ${
                  isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </header>

          {/* Assignment Form */}
          <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
            {/* Error Message */}
            {error && (
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

            {/* Loading State */}
            {loading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
                <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Loading students...</p>
              </div>
            )}

            {!loading && (
              <>
                {/* Title */}
                <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${
                  isDark ? 'bg-slate-800' : 'bg-white'
                } shadow-sm`}>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Assignment Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Essay on Climate Change"
                    className={`w-full px-4 py-3 rounded-xl border transition-colors ${
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-emerald-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                    } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                  />
                </div>

                {/* Due Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${
                    isDark ? 'bg-slate-800' : 'bg-white'
                  } shadow-sm`}>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Due Date *
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border transition-colors ${
                        isDark
                          ? 'bg-slate-700 border-slate-600 text-white focus:border-emerald-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                      } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                    />
                  </div>

                  <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${
                    isDark ? 'bg-slate-800' : 'bg-white'
                  } shadow-sm`}>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      <Clock className="w-4 h-4 inline mr-2" />
                      Due Time *
                    </label>
                    <input
                      type="time"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border transition-colors ${
                        isDark
                          ? 'bg-slate-700 border-slate-600 text-white focus:border-emerald-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                      } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                    />
                  </div>
                </div>

                {/* Description with TipTap WYSIWYG */}
                <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${
                  isDark ? 'bg-slate-800' : 'bg-white'
                } shadow-sm`}>
                  <label className={`block text-sm font-medium mb-3 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Assignment Description *
                  </label>
                  
                  {/* TipTap Editor Toolbar */}
                  <div className={`flex flex-wrap gap-1 p-2 rounded-t-xl border ${
                    isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-300'
                  }`}>
                    {editorButtons.map((btn, idx) => (
                      <button
                        key={idx}
                        onClick={btn.action}
                        className={`p-2 rounded-lg transition-colors ${
                          btn.isActive
                            ? isDark
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-100 text-emerald-700'
                            : isDark
                            ? 'hover:bg-slate-600 text-slate-300'
                            : 'hover:bg-slate-200 text-slate-600'
                        }`}
                        title={btn.label}
                        type="button"
                      >
                        <btn.icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>

                  {/* TipTap Editor Content */}
                  <div className={`rounded-b-xl border border-t-0 min-h-[300px] ${
                    isDark
                      ? 'bg-slate-700 border-slate-600'
                      : 'bg-white border-slate-300'
                  }`}>
                    <EditorContent 
                      editor={editor} 
                      className={`px-4 py-3 ${isDark ? 'text-white' : 'text-slate-900'}`}
                    />
                  </div>
                </div>

                {/* File Attachments */}
                <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${
                  isDark ? 'bg-slate-800' : 'bg-white'
                } shadow-sm`}>
                  <label className={`block text-sm font-medium mb-3 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Attachments (PDF, Images)
                  </label>

                  {/* Existing files - only shown in edit mode */}
                  {isEditMode && existingFiles.length > 0 && (
                    <div className="mb-4">
                      <p className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Current Files
                      </p>
                      <div className="space-y-2">
                        {existingFiles.map((file) => (
                          <div key={file.id} className={`flex items-center justify-between p-3 rounded-xl border ${
                            isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'
                          }`}>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <File className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                              <div className="min-w-0">
                                <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {file.file_name}
                                </p>
                                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {(file.file_size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <a
                                href={file.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`p-2 rounded-lg text-xs font-medium ${
                                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-600' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                                }`}
                              >
                                View
                              </a>
                              <button
                                onClick={() => removeExistingFile(file)}
                                className="p-2 rounded-lg hover:bg-red-500/20 text-red-500"
                                type="button"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload new files */}
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center ${
                    isDark ? 'border-slate-600 bg-slate-700/50' : 'border-slate-300 bg-slate-50'
                  }`}>
                    <Upload className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
                    <p className={`text-sm mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {isEditMode ? 'Add more files' : 'Drag and drop files here or'}
                    </p>
                    <label className="inline-block">
                      <span className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-medium cursor-pointer">
                        Browse Files
                      </span>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      PDF, JPG, PNG up to 10MB each
                    </p>
                  </div>

                  {/* Newly added files */}
                  {uploadedFiles.length > 0 && (
                    <div className="mt-4">
                      {isEditMode && (
                        <p className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          New Files (will be uploaded on save)
                        </p>
                      )}
                      <div className="space-y-2">
                        {uploadedFiles.map((file, idx) => (
                          <div key={idx} className={`flex items-center justify-between p-3 rounded-xl ${
                            isDark ? 'bg-slate-700' : 'bg-slate-100'
                          }`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <File className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                              <div className="min-w-0">
                                <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {file.name}
                                </p>
                                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {(file.size / 1024 / 1024).toFixed(2)} MB · New
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeFile(idx)}
                              className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 flex-shrink-0"
                              type="button"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Student Selection */}
                <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${
                  isDark ? 'bg-slate-800' : 'bg-white'
                } shadow-sm`}>
                  <div className="flex items-center justify-between mb-4">
                    <label className={`text-sm font-medium ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Send to Students * ({selectedStudents.length} selected)
                    </label>
                    {students.length > 0 && (
                      <button
                        onClick={handleSelectAll}
                        className={`text-sm font-medium ${
                          isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'
                        }`}
                        type="button"
                      >
                        {selectAll ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>

                  {students.length === 0 ? (
                    <div className="text-center py-8">
                      <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        No students added yet. Add students in the Students page first.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {students.map((student) => (
                        <label
                          key={student.id}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                            selectedStudents.includes(student.id)
                              ? isDark
                                ? 'bg-emerald-600/20 border-2 border-emerald-600'
                                : 'bg-emerald-50 border-2 border-emerald-600'
                              : isDark
                              ? 'bg-slate-700 border-2 border-transparent hover:bg-slate-600'
                              : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.id)}
                            onChange={() => toggleStudent(student.id)}
                            className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="flex-1">
                            <p className={`font-medium text-sm ${
                              isDark ? 'text-white' : 'text-slate-900'
                            }`}>
                              {student.name}
                            </p>
                            <p className={`text-xs ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              {student.email}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 sticky bottom-4 sm:bottom-6">
                  <button 
                    type="button"
                    onClick={() => handleSubmit(true)}
                    disabled={submitting || students.length === 0}
                    className={`flex-1 py-3 px-6 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                      isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Save as Draft
                      </>
                    )}
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleSubmit(false)}
                    disabled={submitting || students.length === 0}
                    className="flex-1 py-3 px-6 rounded-xl font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                        {isEditMode ? 'Updating...' : 'Sending...'}
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        {isEditMode ? 'Update Assignment' : 'Send Assignment'}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </main>

        <style jsx global>{`
          .ProseMirror {
            min-height: 300px;
            outline: none;
          }
          
          .ProseMirror p {
            margin: 0.5em 0;
          }
          
          .ProseMirror ul,
          .ProseMirror ol {
            padding-left: 1.5em;
            margin: 0.5em 0;
          }
          
          .ProseMirror li {
            margin: 0.25em 0;
          }
          
          .ProseMirror strong {
            font-weight: 600;
          }
          
          .ProseMirror em {
            font-style: italic;
          }
          
          .ProseMirror h1,
          .ProseMirror h2,
          .ProseMirror h3 {
            font-weight: 700;
            margin: 1em 0 0.5em;
          }
          
          .ProseMirror h1 {
            font-size: 1.5em;
          }
          
          .ProseMirror h2 {
            font-size: 1.25em;
          }
          
          .ProseMirror h3 {
            font-size: 1.1em;
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
