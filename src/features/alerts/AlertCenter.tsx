import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { isUserEligibleForAlertAudience, recordAlertReadForUser, createActiveAlert } from '../../services/activeAlertService';
import { getUserGroupIds } from '../../services/groupService';
import type { ActiveAlertDoc } from '../../types/alert';
import {
  Bell,
  RefreshCw,
  ArrowRight,
  Pin,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

export const AlertCenter: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState<ActiveAlertDoc[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Admin Publish Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertPriority, setAlertPriority] = useState<'general' | 'important' | 'emergency'>('general');
  const [alertAudienceType, setAlertAudienceType] = useState<'campus' | 'department' | 'batch' | 'community'>('campus');
  const [alertAudienceId, setAlertAudienceId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAlerts = async (isInitial = true) => {
    if (!currentUser) return;
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const gIds = await getUserGroupIds(currentUser.uid);

      const colRef = collection(db, 'activeAlerts');
      let q = query(colRef, orderBy('createdAt', 'desc'), limit(20));

      if (!isInitial && lastDoc) {
        q = query(colRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(20));
      }

      const snap = await getDocs(q);
      const rawAlerts = snap.docs.map((d) => ({
        ...(d.data() as ActiveAlertDoc),
        postId: d.id,
      }));

      // Audience filtering
      const filtered = rawAlerts.filter((a) => isUserEligibleForAlertAudience(a, userProfile, gIds));

      setAlerts((prev) => (isInitial ? filtered : [...prev, ...filtered]));
      setLastDoc(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === 20);
    } catch (err) {
      toast.error('Failed to load alert center history.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadAlerts(true);
  }, [currentUser]);

  const handleOpenAlert = async (alert: ActiveAlertDoc) => {
    if (currentUser) {
      await recordAlertReadForUser(currentUser.uid, alert.postId);
    }

    if (alert.channelId && alert.messageId) {
      navigate(`/chat/${alert.channelId}?msgId=${alert.messageId}`);
    } else {
      navigate(`/feed?postId=${alert.postId}`);
    }
  };

  const handlePublishAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submitting || !alertTitle.trim()) return;

    setSubmitting(true);
    try {
      await createActiveAlert(
        alertTitle,
        alertPriority,
        alertAudienceType,
        alertAudienceId,
        currentUser,
        userProfile
      );
      toast.success('Active alert published successfully! 📢');
      setAlertTitle('');
      setAlertAudienceId('');
      setShowAddForm(false);
      loadAlerts(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish alert.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white">Campus Alert Center</h1>
            <p className="text-[11px] text-slate-400">Real-time breaking updates & emergency alerts</p>
          </div>
        </div>

        <div className="flex gap-2">
          {userProfile?.role === 'admin' && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-455 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Publish Alert</span>
            </button>
          )}

          <button
            onClick={() => loadAlerts(true)}
            className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition-all"
            title="Refresh Alerts"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {showAddForm && userProfile?.role === 'admin' && (
          <form onSubmit={handlePublishAlert} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
            <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">Publish Active Alert</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Alert Title / Broadcast</label>
                <input
                  type="text"
                  required
                  value={alertTitle}
                  onChange={(e) => setAlertTitle(e.target.value)}
                  placeholder="e.g. Server maintenance today at 6 PM"
                  className="w-full bg-slate-950 border border-slate-805 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Priority</label>
                <select
                  value={alertPriority}
                  onChange={(e) => setAlertPriority(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-805 rounded-xl px-3 py-2 text-xs text-slate-350 focus:outline-none"
                >
                  <option value="general" className="bg-slate-950">General</option>
                  <option value="important" className="bg-slate-950">Important</option>
                  <option value="emergency" className="bg-slate-950">Emergency</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Audience Targeting</label>
                <select
                  value={alertAudienceType}
                  onChange={(e) => setAlertAudienceType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-805 rounded-xl px-3 py-2 text-xs text-slate-350 focus:outline-none"
                >
                  <option value="campus" className="bg-slate-950">All Users (Campus)</option>
                  <option value="department" className="bg-slate-950">Department</option>
                  <option value="batch" className="bg-slate-950">Batch Year</option>
                  <option value="community" className="bg-slate-950">Group/Community</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Audience ID (Filter Value)</label>
                <input
                  type="text"
                  value={alertAudienceId}
                  onChange={(e) => setAlertAudienceId(e.target.value)}
                  placeholder="e.g. computer_science, 2028, or group_123"
                  disabled={alertAudienceType === 'campus'}
                  className="w-full bg-slate-950 border border-slate-805 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none disabled:bg-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-rose-500 hover:bg-rose-455 disabled:bg-slate-850 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
            >
              Broadcast Alert
            </button>
          </form>
        )}

        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading active alerts...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-3">
            <Bell className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-xs font-semibold">No active campus alerts at this time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const isUrgent = alert.priority === 'emergency';

              return (
                <div
                  key={alert.postId}
                  onClick={() => handleOpenAlert(alert)}
                  className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${
                    isUrgent
                      ? 'bg-rose-950/40 border-rose-500/30 hover:border-rose-500/60'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase ${
                          isUrgent
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isUrgent ? '🚨 Urgent Alert' : '📢 Important Update'}
                      </span>

                      {alert.pinned && (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-mono text-[10px] font-bold flex items-center gap-1">
                          <Pin className="w-3 h-3" />
                          <span>Pinned</span>
                        </span>
                      )}

                      <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded font-mono text-[10px] font-bold uppercase">
                        {alert.audienceType}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-sm group-hover:text-sky-400 transition-colors">
                      {alert.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleOpenAlert(alert)}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-1 shadow-md"
                  >
                    <span>View Post</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {hasMore && (
              <button
                onClick={() => loadAlerts(false)}
                disabled={loadingMore}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-xs font-semibold text-sky-400 transition-all flex items-center justify-center gap-2"
              >
                {loadingMore ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Load Older Alerts</span>}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
