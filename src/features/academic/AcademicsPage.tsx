import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type {
  AcademicProfile,
  AcademicAttendanceSubject,
  AcademicMarksRecord,
  AcademicSyncMetadata,
} from '../../types/academic';
import {
  getAcademicProfile,
  getAcademicAttendance,
  getAcademicMarks,
  getSyncMetadata,
  getSubjectsList,
  getUserAssignments,
  createUserAssignment,
  updateAssignmentStatus,
  type Subject,
  type UserAssignment,
} from '../../services/academicService';
import { AcademicDashboardTab } from './AcademicDashboardTab';
import { AttendanceModule } from './AttendanceModule';
import { MarksModule } from './MarksModule';
import { EdumarsalSyncTab } from './EdumarsalSyncTab';
import {
  GraduationCap,
  Calendar,
  Award,
  BookOpen,
  ListTodo,
  RefreshCw,
  Zap,
  Plus,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

type AcademicsTab = 'dashboard' | 'attendance' | 'marks' | 'subjects' | 'notes' | 'doubts' | 'assignments' | 'sync';

export const AcademicsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = (searchParams.get('tab') as AcademicsTab) || 'dashboard';

  const setTab = (tab: AcademicsTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  // State
  const [profile, setProfile] = useState<AcademicProfile | null>(null);
  const [attendance, setAttendance] = useState<AcademicAttendanceSubject[]>([]);
  const [marks, setMarks] = useState<AcademicMarksRecord[]>([]);
  const [metadata, setMetadata] = useState<AcademicSyncMetadata | null>(null);
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Assignment Modal
  const [showAddAssign, setShowAddAssign] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignSubject, setAssignSubject] = useState('');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  const loadAllAcademicData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [prof, att, mrk, meta, subs, assigns] = await Promise.all([
        getAcademicProfile(currentUser.uid),
        getAcademicAttendance(currentUser.uid),
        getAcademicMarks(currentUser.uid),
        getSyncMetadata(currentUser.uid),
        getSubjectsList(),
        getUserAssignments(currentUser.uid),
      ]);

      setProfile(prof);
      setAttendance(att);
      setMarks(mrk);
      setMetadata(meta);
      setSubjectsList(subs);
      setAssignments(assigns);
    } catch (err) {
      console.error('Failed to load academic workspace:', err);
      toast.error('Failed to load academic data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAcademicData();
  }, [currentUser]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submittingAssign || !assignTitle.trim() || !assignSubject.trim() || !assignDeadline) return;

    setSubmittingAssign(true);
    try {
      const deadlineTs = new Date(assignDeadline).getTime();
      await createUserAssignment(currentUser.uid, {
        title: assignTitle.trim(),
        subjectCode: assignSubject.trim(),
        deadline: deadlineTs,
      });

      toast.success('Assignment added to personal tracker!');
      setAssignTitle('');
      setAssignSubject('');
      setAssignDeadline('');
      setShowAddAssign(false);
      loadAllAcademicData();
    } catch {
      toast.error('Failed to add assignment.');
    } finally {
      setSubmittingAssign(false);
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
    <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <GraduationCap className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Academics Workspace</h1>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Attendance, Marks, Edumarsal Sync, Subjects, Notes & Question Board
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setTab('sync')}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Edumarsal</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs Strip */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-x-auto scrollbar-none">
        <button
          onClick={() => setTab('dashboard')}
          className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center gap-1.5 ${
            currentTab === 'dashboard'
              ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setTab('attendance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center gap-1.5 ${
            currentTab === 'attendance'
              ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Attendance</span>
        </button>

        <button
          onClick={() => setTab('marks')}
          className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center gap-1.5 ${
            currentTab === 'marks'
              ? 'bg-purple-500 text-slate-950 font-extrabold shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Marks</span>
        </button>

        <button
          onClick={() => setTab('subjects')}
          className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center gap-1.5 ${
            currentTab === 'subjects'
              ? 'bg-sky-500 text-slate-950 font-extrabold shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Subjects</span>
        </button>

        <button
          onClick={() => setTab('assignments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center gap-1.5 ${
            currentTab === 'assignments'
              ? 'bg-pink-500 text-slate-950 font-extrabold shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5" />
          <span>Deadlines</span>
        </button>

        <button
          onClick={() => setTab('sync')}
          className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all shrink-0 flex items-center gap-1.5 ${
            currentTab === 'sync'
              ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Edumarsal Sync</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="p-12 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Loading academic records...</p>
        </div>
      ) : (
        <div>
          {currentTab === 'dashboard' && (
            <AcademicDashboardTab
              profile={profile}
              attendance={attendance}
              marks={marks}
              onNavigateTab={(tab) => setTab(tab as AcademicsTab)}
              onOpenSyncModal={() => setTab('sync')}
            />
          )}

          {currentTab === 'attendance' && (
            <AttendanceModule
              subjects={attendance}
              profile={profile}
              onOpenSync={() => setTab('sync')}
            />
          )}

          {currentTab === 'marks' && (
            <MarksModule
              marks={marks}
              profile={profile}
              onOpenSync={() => setTab('sync')}
            />
          )}

          {currentTab === 'sync' && (
            <EdumarsalSyncTab
              profile={profile}
              metadata={metadata}
              onRefreshData={loadAllAcademicData}
            />
          )}

          {currentTab === 'subjects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-sky-400" />
                  <span>Campus Subjects ({subjectsList.length})</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subjectsList.map((sub) => (
                  <div
                    key={sub.id || sub.code}
                    onClick={() => navigate(`/academic/subjects/${sub.id}`)}
                    className="p-5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-sky-500/40 rounded-3xl flex items-center justify-between gap-4 cursor-pointer transition-all group shadow-lg"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-950 border border-slate-850 text-sky-300 font-mono text-[10px] font-bold rounded-md">
                          {sub.code}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Sem {sub.semester}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">{sub.name}</h4>
                      <p className="text-[11px] text-slate-400">{sub.department}</p>
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-sky-400 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentTab === 'assignments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-pink-400" />
                  <span>Personal Assignment Tracker ({assignments.length})</span>
                </h3>

                <button
                  type="button"
                  onClick={() => setShowAddAssign(!showAddAssign)}
                  className="px-3 py-1.5 bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Deadline</span>
                </button>
              </div>

              {showAddAssign && (
                <form onSubmit={handleCreateAssignment} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Assignment Title..."
                      value={assignTitle}
                      onChange={(e) => setAssignTitle(e.target.value)}
                      className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Subject Code (e.g. CS-401)..."
                      value={assignSubject}
                      onChange={(e) => setAssignSubject(e.target.value)}
                      className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
                    />
                    <input
                      type="datetime-local"
                      required
                      value={assignDeadline}
                      onChange={(e) => setAssignDeadline(e.target.value)}
                      className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500 font-mono"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAssign(false)}
                      className="px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingAssign}
                      className="px-4 py-2 bg-pink-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-pink-500/20"
                    >
                      Save Task
                    </button>
                  </div>
                </form>
              )}

              {assignments.length === 0 ? (
                <div className="p-12 bg-slate-900 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
                  No upcoming deadlines recorded yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {assignments.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => a.id && handleToggleAssignment(a.id, a.status)}
                      className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            a.status === 'completed'
                              ? 'bg-pink-500 border-pink-500 text-slate-950'
                              : 'border-slate-700'
                          }`}
                        >
                          {a.status === 'completed' && <Plus className="w-3.5 h-3.5 rotate-45 stroke-[3]" />}
                        </div>

                        <div>
                          <h4
                            className={`text-xs font-bold ${
                              a.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'
                            }`}
                          >
                            {a.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">{a.subjectCode}</span>
                        </div>
                      </div>

                      <span className="text-[10px] text-pink-400 font-mono">
                        Due: {new Date(a.deadline).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
