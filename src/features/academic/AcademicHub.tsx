import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getSubjectsList,
  getUserAssignments,
  createUserAssignment,
  updateAssignmentStatus,
  type Subject,
  type UserAssignment
} from '../../services/academicService';
import { BookOpen, ListTodo, Plus, RefreshCw, Send, CheckCircle2, Circle } from 'lucide-react';
import toast from 'react-hot-toast';

export const AcademicHub: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'subjects' | 'assignments'>('subjects');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // New Assignment Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignSubject, setAssignSubject] = useState('');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [subs, assigns] = await Promise.all([
        getSubjectsList(),
        getUserAssignments(currentUser.uid),
      ]);
      setSubjects(subs);
      setAssignments(assigns);
    } catch {
      toast.error('Failed to load academic workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submitting || !assignTitle.trim() || !assignSubject.trim() || !assignDeadline) return;

    setSubmitting(true);
    try {
      const deadlineTs = new Date(assignDeadline).getTime();
      await createUserAssignment(currentUser.uid, {
        title: assignTitle.trim(),
        subjectCode: assignSubject.trim(),
        deadline: deadlineTs,
      });

      toast.success('Assignment added to your personal tracker!');
      setAssignTitle('');
      setAssignSubject('');
      setAssignDeadline('');
      setShowAddForm(false);
      loadData();
    } catch {
      toast.error('Failed to add assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAssignment = async (id: string, currentStatus: string) => {
    if (!currentUser) return;
    try {
      const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      await updateAssignmentStatus(currentUser.uid, id, nextStatus);
      setAssignments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: nextStatus } : a))
      );
      toast.success(nextStatus === 'completed' ? 'Marked task as completed! 🎉' : 'Task restored.');
    } catch {
      toast.error('Failed to update status.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="relative p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-white tracking-tight uppercase font-mono">Academic Hub</h1>
          </div>
          <p className="text-xs text-slate-400">
            Collaborate on subjects, download lecture materials, ask doubts, and track deadlines.
          </p>
        </div>

        <div className="flex gap-2">
          {activeTab === 'assignments' && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-405 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
          )}
          <button
            onClick={loadData}
            className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-300 rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('subjects')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
            activeTab === 'subjects'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Subjects & Notes</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
            activeTab === 'assignments'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5" />
          <span>Assignment Tracker</span>
        </button>
      </div>

      {/* New Assignment Modal Form */}
      {showAddForm && activeTab === 'assignments' && (
        <form onSubmit={handleCreateAssignment} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">Add Assignment Deadline</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Title</label>
              <input
                type="text"
                required
                value={assignTitle}
                onChange={(e) => setAssignTitle(e.target.value)}
                placeholder="e.g. DBMS Lab Report 4"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Subject Code</label>
              <input
                type="text"
                required
                value={assignSubject}
                onChange={(e) => setAssignSubject(e.target.value)}
                placeholder="e.g. CS-302"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Deadline Date</label>
              <input
                type="date"
                required
                value={assignDeadline}
                onChange={(e) => setAssignDeadline(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-405 disabled:bg-slate-850 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Save Assignment</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Main Lists Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Loading academic records...</div>
      ) : activeTab === 'subjects' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((sub) => (
            <div
              key={sub.id}
              onClick={() => navigate(`/academic/subjects/${sub.id}`)}
              className="p-5 bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-emerald-500/40 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(52,211,153,0.15)] rounded-3xl cursor-pointer transition-all duration-200 flex flex-col justify-between gap-4 shadow-lg group"
            >
              <div className="space-y-2">
                <span className="px-2.5 py-0.5 bg-slate-950 border border-slate-850 text-emerald-400 rounded-full font-mono text-[9px] font-bold">
                  {sub.code}
                </span>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors leading-snug">
                  {sub.name}
                </h3>
                <p className="text-[10px] text-slate-500 font-mono">
                  {sub.department} • Semester {sub.semester}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono">
                <span>View Resources</span>
                <Plus className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs italic bg-slate-900 border border-slate-850 rounded-3xl">
              All assignments completed! You're caught up. 🚀
            </div>
          ) : (
            assignments.map((item) => {
              const isCompleted = item.status === 'completed';
              const isOverdue = !isCompleted && item.deadline < Date.now();

              return (
                <div
                  key={item.id}
                  className="p-4 bg-slate-900 border border-slate-850 rounded-2xl flex items-center justify-between gap-4 shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleAssignment(item.id!, item.status)}
                      className="text-slate-450 hover:text-emerald-400 transition-all shrink-0"
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    <div className="space-y-1">
                      <h4
                        className={`text-xs font-bold text-white ${
                          isCompleted ? 'line-through text-slate-500 font-medium' : ''
                        }`}
                      >
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Subject: {item.subjectCode} • Due:{' '}
                        <span className={isOverdue ? 'text-rose-500 font-bold' : ''}>
                          {new Date(item.deadline).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                  </div>

                  {isCompleted ? (
                    <span className="px-2 py-0.5 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-[9px] font-bold font-mono rounded-full">
                      DONE
                    </span>
                  ) : isOverdue ? (
                    <span className="px-2 py-0.5 bg-rose-950/20 border border-rose-900/30 text-rose-455 text-[9px] font-bold font-mono rounded-full">
                      OVERDUE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-950 border border-slate-850 text-slate-400 text-[9px] font-bold font-mono rounded-full">
                      PENDING
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
