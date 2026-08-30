import React, { useState } from 'react';
import type { AcademicAttendanceSubject, AcademicProfile } from '../../types/academic';
import { computeAttendanceSummary } from '../../services/academic/academicStorageService';
import {
  Calendar,
  AlertTriangle,
  Calculator,
  ChevronRight,
  RefreshCw,
  X,
  Target
} from 'lucide-react';

interface AttendanceModuleProps {
  subjects: AcademicAttendanceSubject[];
  profile: AcademicProfile | null;
  onOpenSync: () => void;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  subjects,
  profile,
  onOpenSync,
}) => {
  const alertThreshold = profile?.alertThreshold || 75;
  const summary = computeAttendanceSummary(subjects, alertThreshold);

  // Target Calculator States
  const [targetPercentage, setTargetPercentage] = useState<number>(75);
  const [missCountInput, setMissCountInput] = useState<number>(1);

  // Selected subject for detail modal
  const [selectedSubject, setSelectedSubject] = useState<AcademicAttendanceSubject | null>(null);

  // Mathematical Calculation 1: Required consecutive classes to reach target percentage
  // Formula: (Present + X) / (Total + X) >= Target / 100
  // Present + X >= (Target / 100) * Total + (Target / 100) * X
  // X * (1 - Target/100) >= (Target/100 * Total) - Present
  // X >= (Target * Total - 100 * Present) / (100 - Target)
  const calculateRequiredClasses = (present: number, total: number, target: number): number => {
    if (total === 0) return 0;
    const currentPct = (present / total) * 100;
    if (currentPct >= target) return 0;
    if (target >= 100) return 999;

    const req = Math.ceil((target * total - 100 * present) / (100 - target));
    return Math.max(0, req);
  };

  // Mathematical Calculation 2: New percentage if missing N classes
  // Formula: Present / (Total + N) * 100
  const calculateMissedImpact = (present: number, total: number, missN: number): number => {
    if (total + missN === 0) return 0;
    return Number(((present / (total + missN)) * 100).toFixed(1));
  };

  const reqConsecutive = calculateRequiredClasses(summary.presentClasses, summary.totalClasses, targetPercentage);
  const missedImpactPct = calculateMissedImpact(summary.presentClasses, summary.totalClasses, missCountInput);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Summary Badges */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <span>Subject Attendance Tracking</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Real-time attendance record from Edumarsal • Configured Alert Threshold: {alertThreshold}%
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenSync}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sync Attendance</span>
          </button>
        </div>

        {/* Global Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800 font-mono text-xs">
          <div className="p-3.5 bg-slate-950/70 border border-slate-850 rounded-2xl">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Overall Attendance</span>
            <span className="text-2xl font-black text-white mt-0.5 block">{summary.overallPercentage}%</span>
          </div>

          <div className="p-3.5 bg-slate-950/70 border border-slate-850 rounded-2xl">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Classes Attended</span>
            <span className="text-xl font-bold text-emerald-400 mt-0.5 block">
              {summary.presentClasses} / {summary.totalClasses}
            </span>
          </div>

          <div className="p-3.5 bg-slate-950/70 border border-slate-850 rounded-2xl">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Classes Absent</span>
            <span className="text-xl font-bold text-rose-400 mt-0.5 block">{summary.absentClasses}</span>
          </div>

          <div className="p-3.5 bg-slate-950/70 border border-slate-850 rounded-2xl">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Needs Attention</span>
            <span className="text-xl font-bold text-amber-400 mt-0.5 block">
              {summary.needsAttentionCount} {summary.needsAttentionCount === 1 ? 'Subject' : 'Subjects'}
            </span>
          </div>
        </div>
      </div>

      {/* Target Calculator Section */}
      <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Attendance Target & Impact Calculator</h3>
            <p className="text-[11px] text-slate-400">Plan upcoming lectures to reach your desired percentage safely</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Target Calculator 1: Reach X% */}
          <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>Reach Target Attendance Percentage</span>
            </h4>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400">Target Percentage (%)</label>
              <input
                type="number"
                min="50"
                max="99"
                value={targetPercentage}
                onChange={(e) => setTargetPercentage(Math.min(99, Math.max(50, Number(e.target.value))))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-1 font-mono">
              <span className="text-slate-400 block text-[10px]">Required Consecutive Classes:</span>
              <span className="text-base font-bold text-white">
                {reqConsecutive === 0 ? (
                  <span className="text-emerald-400">Target Already Achieved! 🎉</span>
                ) : reqConsecutive >= 999 ? (
                  <span className="text-rose-400">Target Unreachable</span>
                ) : (
                  <span>Attend <strong className="text-emerald-400 font-bold">{reqConsecutive}</strong> consecutive classes</span>
                )}
              </span>
            </div>
          </div>

          {/* Target Calculator 2: Miss N Classes */}
          <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Impact of Missing Upcoming Classes</span>
            </h4>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400">Number of Classes to Miss</label>
              <input
                type="number"
                min="1"
                max="30"
                value={missCountInput}
                onChange={(e) => setMissCountInput(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-1 font-mono">
              <span className="text-slate-400 block text-[10px]">New Overall Attendance:</span>
              <span className="text-base font-bold text-white">
                <strong className={missedImpactPct < alertThreshold ? 'text-rose-400' : 'text-amber-300'}>
                  {missedImpactPct}%
                </strong>
                <span className="text-[11px] text-slate-400 ml-2">({summary.overallPercentage - missedImpactPct > 0 ? `-${(summary.overallPercentage - missedImpactPct).toFixed(1)}%` : '0%'})</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subject-wise Attendance Cards Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span>Subject Breakdown ({subjects.length})</span>
        </h3>

        {subjects.length === 0 ? (
          <div className="p-12 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-3">
            <p className="text-xs text-slate-400">No attendance data synchronized yet.</p>
            <button
              onClick={onOpenSync}
              className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl"
            >
              Sync Edumarsal Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((sub) => {
              const isLow = sub.percentage < alertThreshold;
              const reqSub = calculateRequiredClasses(sub.presentClasses, sub.totalClasses, alertThreshold);

              return (
                <div
                  key={sub.subjectCode}
                  onClick={() => setSelectedSubject(sub)}
                  className="p-5 bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-3xl space-y-4 cursor-pointer transition-all duration-200 group shadow-lg flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 bg-slate-950 border border-slate-800 text-slate-400 font-mono text-[10px] font-bold rounded-lg">
                        {sub.subjectCode}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                          isLow
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}
                      >
                        {isLow ? 'Needs Attention' : 'Good'}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors leading-snug line-clamp-2">
                      {sub.subjectName}
                    </h4>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-baseline justify-between font-mono">
                      <div>
                        <span className="text-2xl font-black text-white">{sub.percentage}%</span>
                        <span className="text-[11px] text-slate-400 block">
                          {sub.presentClasses} / {sub.totalClasses} classes
                        </span>
                      </div>

                      <div className="text-right text-[11px] text-slate-400">
                        <span className="text-rose-400 font-bold block">{sub.absentClasses} absent</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isLow ? 'bg-amber-500' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, sub.percentage)}%` }}
                      />
                    </div>

                    {/* Requirement Note */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>
                        {reqSub > 0 ? (
                          <span className="text-amber-400">Attend {reqSub} more to reach {alertThreshold}%</span>
                        ) : (
                          <span className="text-emerald-400">Above {alertThreshold}% threshold ✓</span>
                        )}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subject Detail Drawer / Modal */}
      {selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">{selectedSubject.subjectCode}</span>
                <h3 className="text-base font-bold text-white mt-0.5">{selectedSubject.subjectName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubject(null)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-2xl">
                  <span className="text-slate-500 text-[10px] uppercase block">Total</span>
                  <span className="text-lg font-bold text-white">{selectedSubject.totalClasses}</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-2xl">
                  <span className="text-slate-500 text-[10px] uppercase block">Attended</span>
                  <span className="text-lg font-bold text-emerald-400">{selectedSubject.presentClasses}</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-2xl">
                  <span className="text-slate-500 text-[10px] uppercase block">Absent</span>
                  <span className="text-lg font-bold text-rose-400">{selectedSubject.absentClasses}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Attendance Percentage</span>
                  <span className="font-bold text-white">{selectedSubject.percentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status Badge</span>
                  <span className="font-bold text-emerald-400">{selectedSubject.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Threshold ({alertThreshold}%)</span>
                  <span className="font-bold text-amber-400">
                    {calculateRequiredClasses(selectedSubject.presentClasses, selectedSubject.totalClasses, alertThreshold) === 0
                      ? 'Met'
                      : `${calculateRequiredClasses(selectedSubject.presentClasses, selectedSubject.totalClasses, alertThreshold)} classes needed`}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedSubject(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
