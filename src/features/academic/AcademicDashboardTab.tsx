import React from 'react';
import type {
  AcademicProfile,
  AcademicAttendanceSubject,
  AcademicMarksRecord,
} from '../../types/academic';
import { computeAttendanceSummary, computeMarksSummary } from '../../services/academic/academicStorageService';
import {
  GraduationCap,
  Award,
  BookOpen,
  Calendar,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Zap,
  ShieldCheck,
  ListTodo
} from 'lucide-react';

interface AcademicDashboardTabProps {
  profile: AcademicProfile | null;
  attendance: AcademicAttendanceSubject[];
  marks: AcademicMarksRecord[];
  onNavigateTab: (tab: string) => void;
  onOpenSyncModal: () => void;
}

export const AcademicDashboardTab: React.FC<AcademicDashboardTabProps> = ({
  profile,
  attendance,
  marks,
  onNavigateTab,
  onOpenSyncModal,
}) => {
  const attSummary = computeAttendanceSummary(attendance, profile?.alertThreshold || 75);
  const marksSummary = computeMarksSummary(marks);

  const needsAttention = attSummary.overallPercentage < (profile?.alertThreshold || 75);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Student Identity Header Card */}
      <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl relative overflow-hidden shadow-2xl space-y-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-emerald-500/10 via-sky-500/10 to-purple-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-sky-500 p-0.5 shadow-lg shadow-emerald-500/20 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center text-emerald-400">
                <GraduationCap className="w-8 h-8" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white">
                  {profile ? `Student ID: ${profile.studentId}` : 'Academic Profile Not Connected'}
                </h2>
                {profile?.isConnected ? (
                  <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Connected Edumarsal
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-[10px] font-bold">
                    Setup Required
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {profile
                  ? `${profile.department} • Batch ${profile.batch} • Semester ${profile.semester}`
                  : 'Connect your academic details to enable automated attendance & marks sync'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {profile?.isConnected ? (
              <button
                type="button"
                onClick={onOpenSyncModal}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Edumarsal</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenSyncModal}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Connect Account</span>
              </button>
            )}
          </div>
        </div>

        {/* Overview Badges Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800 text-xs font-mono">
          <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-2xl">
            <span className="text-slate-500 text-[10px] uppercase font-bold block">College</span>
            <span className="text-white font-bold truncate block mt-0.5">{profile?.collegeName || 'AKGEC Campus'}</span>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-2xl">
            <span className="text-slate-500 text-[10px] uppercase font-bold block">Current Semester</span>
            <span className="text-emerald-400 font-bold block mt-0.5">Semester {profile?.semester || 4}</span>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-2xl">
            <span className="text-slate-500 text-[10px] uppercase font-bold block">Department</span>
            <span className="text-sky-300 font-bold truncate block mt-0.5">{profile?.department || 'Computer Science'}</span>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-2xl">
            <span className="text-slate-500 text-[10px] uppercase font-bold block">Last Synced</span>
            <span className="text-slate-300 font-bold block mt-0.5">
              {profile?.lastSyncedAt
                ? new Date(profile.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Not synced'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Low Attendance Attention Banner */}
      {needsAttention && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-amber-300">Attendance needs attention</h4>
              <p className="text-slate-300 text-[11px] mt-0.5">
                Overall attendance is currently <span className="font-bold text-amber-300">{attSummary.overallPercentage}%</span> (below target {profile?.alertThreshold || 75}%). Use the Target Calculator to plan upcoming classes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('attendance')}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shrink-0 transition-all"
          >
            Target Calculator →
          </button>
        </div>
      )}

      {/* 3. Summary Grid: Attendance & Marks Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Summary Widget */}
        <div
          onClick={() => onNavigateTab('attendance')}
          className="p-6 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-3xl space-y-4 cursor-pointer transition-all duration-200 group shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">Attendance Summary</h3>
                <p className="text-[11px] text-slate-400 font-mono">{attSummary.totalSubjects} Registered Subjects</p>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <div>
              <span className="text-3xl font-black text-white tracking-tight">{attSummary.overallPercentage}%</span>
              <span className="text-xs text-slate-400 block mt-0.5 font-mono">
                {attSummary.presentClasses} / {attSummary.totalClasses} classes attended
              </span>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                needsAttention
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
            >
              {needsAttention ? 'Needs Attention' : 'Good Standing'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full h-2 bg-slate-950 border border-slate-850 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  needsAttention ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'
                }`}
                style={{ width: `${Math.min(100, attSummary.overallPercentage)}%` }}
              />
            </div>
          </div>

          {/* Subject Extremes */}
          {attSummary.lowestSubject && (
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Lowest: <span className="text-slate-200 font-bold">{attSummary.lowestSubject.name}</span></span>
              <span className="font-bold text-amber-400">{attSummary.lowestSubject.percentage}%</span>
            </div>
          )}
        </div>

        {/* Marks Summary Widget */}
        <div
          onClick={() => onNavigateTab('marks')}
          className="p-6 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-3xl space-y-4 cursor-pointer transition-all duration-200 group shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">Marks & Internal Summary</h3>
                <p className="text-[11px] text-slate-400 font-mono">{marksSummary.totalSubjects} Evaluated Subjects</p>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <div>
              <span className="text-3xl font-black text-white tracking-tight">{marksSummary.overallPercentage}%</span>
              <span className="text-xs text-slate-400 block mt-0.5 font-mono">
                Average across evaluated assessments
              </span>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-purple-500/10 border border-purple-500/30 text-purple-300">
              Grade Average
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full h-2 bg-slate-950 border border-slate-850 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${Math.min(100, marksSummary.overallPercentage)}%` }}
              />
            </div>
          </div>

          {/* Highest Subject */}
          {marksSummary.highestSubject && (
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Highest: <span className="text-slate-200 font-bold">{marksSummary.highestSubject.name}</span></span>
              <span className="font-bold text-purple-400">{marksSummary.highestSubject.percentage}%</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Quick Actions Panel */}
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <span>Quick Academic Actions</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('attendance')}
            className="p-3.5 bg-slate-950/80 hover:bg-slate-950 border border-slate-850 hover:border-emerald-500/30 rounded-2xl flex flex-col items-center text-center space-y-2 transition-all group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-300">Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('marks')}
            className="p-3.5 bg-slate-950/80 hover:bg-slate-950 border border-slate-850 hover:border-purple-500/30 rounded-2xl flex flex-col items-center text-center space-y-2 transition-all group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Award className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-purple-300">Marks</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('subjects')}
            className="p-3.5 bg-slate-950/80 hover:bg-slate-950 border border-slate-850 hover:border-sky-500/30 rounded-2xl flex flex-col items-center text-center space-y-2 transition-all group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-sky-300">Subjects</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('notes')}
            className="p-3.5 bg-slate-950/80 hover:bg-slate-950 border border-slate-850 hover:border-amber-500/30 rounded-2xl flex flex-col items-center text-center space-y-2 transition-all group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300">Study Notes</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('assignments')}
            className="p-3.5 bg-slate-950/80 hover:bg-slate-950 border border-slate-850 hover:border-pink-500/30 rounded-2xl flex flex-col items-center text-center space-y-2 transition-all group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ListTodo className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-pink-300">Deadlines</span>
          </button>

          <button
            type="button"
            onClick={onOpenSyncModal}
            className="p-3.5 bg-slate-950/80 hover:bg-slate-950 border border-slate-850 hover:border-emerald-500/30 rounded-2xl flex flex-col items-center text-center space-y-2 transition-all group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <RefreshCw className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-300">Sync Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
