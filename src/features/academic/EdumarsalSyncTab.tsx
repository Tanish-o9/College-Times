import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type {
  AcademicProfile,
  AcademicSyncMetadata,
  AcademicSyncHistoryRecord,
  EdumarsalConnectConfig,
} from '../../types/academic';
import { EdumarsalProvider } from '../../services/academic/EdumarsalProvider';
import {
  saveAcademicProfile,
  saveAcademicAttendance,
  saveAcademicMarks,
  saveSyncMetadata,
  addSyncHistoryRecord,
  getSyncHistory
} from '../../services/academic/academicStorageService';
import {
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  UserCheck,
  X,
  History
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EdumarsalSyncTabProps {
  profile: AcademicProfile | null;
  metadata: AcademicSyncMetadata | null;
  onRefreshData: () => void;
}

export const EdumarsalSyncTab: React.FC<EdumarsalSyncTabProps> = ({
  profile,
  metadata,
  onRefreshData,
}) => {
  const { currentUser } = useAuth();

  // Form setup state
  const [studentId, setStudentId] = useState<string>(profile?.studentId || '');
  const [collegeEmail, setCollegeEmail] = useState<string>(profile?.collegeEmail || currentUser?.email || '');
  const [department, setDepartment] = useState<string>(profile?.department || 'Computer Science');
  const [batch, setBatch] = useState<string>(profile?.batch || '2028');
  const [semester, setSemester] = useState<number>(profile?.semester || 4);

  // Sync / Verification states
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncHistoryList, setSyncHistoryList] = useState<AcademicSyncHistoryRecord[]>([]);

  const loadHistory = async () => {
    if (!currentUser) return;
    const list = await getSyncHistory(currentUser.uid, 10);
    setSyncHistoryList(list);
  };

  useEffect(() => {
    loadHistory();
  }, [currentUser]);

  const handleStartConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim()) {
      toast.error('Student ID or Enrollment Number is required.');
      return;
    }
    setIsVerifying(true);
  };

  const handleConfirmAndSync = async () => {
    if (!currentUser) return;
    setIsVerifying(false);
    setIsSyncing(true);

    const provider = new EdumarsalProvider();
    const config: EdumarsalConnectConfig = {
      studentId: studentId.trim(),
      collegeEmail: collegeEmail.trim(),
      department: department.trim(),
      batch: batch.trim(),
      semester,
      collegeName: 'AKGEC Campus',
    };

    try {
      // 1. Connect provider
      await provider.connect(config);

      // 2. Fetch academic data from authorized integration adapter
      const result = await provider.fetchAcademicData(config);

      // 3. Identity Verification Gate
      if (result.profile.studentId.toUpperCase() !== studentId.trim().toUpperCase()) {
        const failMeta: AcademicSyncMetadata = {
          lastSyncedAt: Date.now(),
          syncStatus: 'identity_mismatch',
          recordsCount: { attendance: 0, marks: 0 },
          source: provider.name,
          lastError: 'Student ID returned by Edumarsal did not match your account profile.',
        };
        await saveSyncMetadata(currentUser.uid, failMeta);
        await addSyncHistoryRecord(currentUser.uid, {
          timestamp: Date.now(),
          status: 'identity_mismatch',
          attendanceCount: 0,
          marksCount: 0,
          source: provider.name,
          errorSummary: failMeta.lastError,
        });
        toast.error('Identity Mismatch: Returned academic record does not match your student ID.');
        return;
      }

      // 4. Save normalized records to owner-scoped Firestore
      await Promise.all([
        saveAcademicProfile(currentUser.uid, result.profile),
        saveAcademicAttendance(currentUser.uid, result.attendance),
        saveAcademicMarks(currentUser.uid, result.marks),
        saveSyncMetadata(currentUser.uid, result.metadata),
        addSyncHistoryRecord(currentUser.uid, {
          timestamp: Date.now(),
          status: 'success',
          attendanceCount: result.attendance.length,
          marksCount: result.marks.length,
          source: provider.name,
        }),
      ]);

      toast.success('Edumarsal academic data synchronized successfully! 🎉');
      onRefreshData();
      loadHistory();
    } catch (err: any) {
      console.error('Edumarsal sync failed:', err);
      const errMessage = err.message || 'Edumarsal synchronization failed.';
      toast.error(errMessage);

      if (currentUser) {
        await addSyncHistoryRecord(currentUser.uid, {
          timestamp: Date.now(),
          status: 'failed',
          attendanceCount: 0,
          marksCount: 0,
          source: provider.name,
          errorSummary: errMessage,
        });
        loadHistory();
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl mx-auto">
      {/* Top Info Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Edumarsal Integration & Data Sync</h2>
              <p className="text-xs text-slate-400 font-mono">
                Securely sync attendance and marks into your private College Times dashboard
              </p>
            </div>
          </div>

          {metadata?.lastSyncedAt && (
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-mono font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Synced Today
            </span>
          )}
        </div>
      </div>

      {/* Connect & Setup Form */}
      <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-6 shadow-2xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <UserCheck className="w-4 h-4 text-emerald-400" />
          <span>Academic Connection Profile</span>
        </h3>

        <form onSubmit={handleStartConnection} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 font-semibold">Student ID / Roll Number *</label>
              <input
                type="text"
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. 2100270100089"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 font-semibold">College Email</label>
              <input
                type="email"
                value={collegeEmail}
                onChange={(e) => setCollegeEmail(e.target.value)}
                placeholder="student@akgec.ac.in"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 font-semibold">Department *</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="Computer Science">Computer Science & Engineering</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Electronics & Comm">Electronics & Comm Engg</option>
                <option value="Mechanical Engg">Mechanical Engineering</option>
                <option value="Electrical Engg">Electrical & Electronics Engg</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 font-semibold">Batch Year *</label>
              <select
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="2028">Batch 2028</option>
                <option value="2027">Batch 2027</option>
                <option value="2026">Batch 2026</option>
                <option value="2025">Batch 2025</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 font-semibold">Current Semester *</label>
              <select
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value={1}>Semester 1</option>
                <option value={2}>Semester 2</option>
                <option value={3}>Semester 3</option>
                <option value={4}>Semester 4</option>
                <option value={5}>Semester 5</option>
                <option value={6}>Semester 6</option>
                <option value={7}>Semester 7</option>
                <option value={8}>Semester 8</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSyncing}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span>{profile?.isConnected ? 'Save & Sync Edumarsal Now' : 'Connect & Sync Account'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Verification Gate Confirmation Modal */}
      {isVerifying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Verify Academic Connection Details</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsVerifying(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs p-4 bg-slate-950 border border-slate-850 rounded-2xl">
              <div className="flex justify-between">
                <span className="text-slate-400">Student ID</span>
                <span className="font-bold text-white">{studentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Department</span>
                <span className="font-bold text-sky-300">{department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Batch</span>
                <span className="font-bold text-purple-300">Batch {batch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Semester</span>
                <span className="font-bold text-emerald-400">Semester {semester}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Upon confirmation, College Times will securely normalize your attendance and marks data from Edumarsal and store it in your owner-scoped private profile.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsVerifying(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmAndSync}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20"
              >
                Confirm & Fetch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync History Audit Log */}
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-400" />
          <span>Edumarsal Sync History</span>
        </h3>

        {syncHistoryList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 italic">No sync operations recorded yet.</div>
        ) : (
          <div className="space-y-2.5 font-mono text-xs">
            {syncHistoryList.map((h) => (
              <div
                key={h.id}
                className="p-3 bg-slate-950/70 border border-slate-850 rounded-2xl flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2.5">
                  {h.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold text-white block leading-tight">
                      {h.status === 'success' ? `Synced ${h.attendanceCount} subjects & ${h.marksCount} marks` : 'Sync Failed'}
                    </span>
                    <span className="text-[10px] text-slate-500">{h.source}</span>
                  </div>
                </div>

                <span className="text-[10px] text-slate-400 text-right">
                  {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
