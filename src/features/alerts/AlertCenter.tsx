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
import { isUserEligibleForAlertAudience, recordAlertReadForUser } from '../../services/activeAlertService';
import { getUserGroupIds } from '../../services/groupService';
import type { ActiveAlertDoc } from '../../types/alert';
import {
  Bell,
  RefreshCw,
  ArrowRight,
  Pin
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

        <button
          onClick={() => loadAlerts(true)}
          className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition-all"
          title="Refresh Alerts"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-4">
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
