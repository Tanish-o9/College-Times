import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  subscribeToActiveAlerts,
  dismissAlertForUser,
  recordAlertReadForUser,
} from '../../services/activeAlertService';
import { getUserGroupIds } from '../../services/groupService';
import type { ActiveAlertDoc } from '../../types/alert';
import {
  AlertTriangle,
  X,
  ArrowRight,
  ChevronRight,
  Pin
} from 'lucide-react';

export const BreakingAlertBanner: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [activeAlerts, setActiveAlerts] = useState<ActiveAlertDoc[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Load joined group IDs for community audience filtering
  useEffect(() => {
    if (!currentUser) return;
    getUserGroupIds(currentUser.uid)
      .then((ids) => setJoinedGroupIds(ids))
      .catch(() => setJoinedGroupIds([]));
  }, [currentUser]);

  // Subscribe to real-time active alerts
  useEffect(() => {
    if (!currentUser) {
      setActiveAlerts([]);
      return;
    }

    const unsub = subscribeToActiveAlerts(
      currentUser,
      userProfile,
      joinedGroupIds,
      (alerts) => {
        setActiveAlerts(alerts);
      }
    );

    return () => {
      unsub();
    };
  }, [currentUser, userProfile, joinedGroupIds]);

  if (!currentUser || activeAlerts.length === 0) {
    return null;
  }

  // Filter out locally dismissed alerts during current session
  const visibleAlerts = activeAlerts.filter((a) => !dismissedIds.has(a.postId));
  if (visibleAlerts.length === 0) return null;

  const displayStack = visibleAlerts.slice(0, 3);
  const remainingCount = visibleAlerts.length - displayStack.length;

  const handleDismiss = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => new Set([...prev, postId]));
    if (currentUser) {
      await dismissAlertForUser(currentUser.uid, postId);
    }
  };

  const handleViewAlert = async (alert: ActiveAlertDoc) => {
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
    <div className="w-full space-y-2 mb-4">
      {displayStack.map((alert) => {
        const isUrgent = alert.priority === 'emergency';
        const ariaLive = isUrgent ? 'assertive' : 'polite';

        return (
          <div
            key={alert.postId}
            role="alert"
            aria-live={ariaLive}
            onClick={() => handleViewAlert(alert)}
            className={`w-full p-3.5 sm:p-4 rounded-2xl border backdrop-blur-xl shadow-xl transition-all cursor-pointer flex items-center justify-between gap-3 group relative overflow-hidden ${
              isUrgent
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-100 shadow-rose-500/10'
                : 'bg-amber-950/90 border-amber-500/40 text-amber-100 shadow-amber-500/10'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  isUrgent
                    ? 'bg-rose-500/20 border-rose-400/30 text-rose-400 animate-pulse'
                    : 'bg-amber-500/20 border-amber-400/30 text-amber-400'
                }`}
              >
                {alert.pinned ? <Pin className="w-4 h-4 text-amber-300" /> : <AlertTriangle className="w-4 h-4" />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-black/40 border border-white/10">
                    {isUrgent ? '🚨 URGENT CAMPUS ALERT' : '📢 IMPORTANT UPDATE'}
                  </span>

                  <span className="text-[10px] font-mono opacity-75 uppercase">
                    {alert.audienceType}
                  </span>
                </div>

                <p className="text-xs font-bold text-white truncate mt-0.5">
                  {alert.title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleViewAlert(alert)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all hidden sm:flex items-center gap-1 border ${
                  isUrgent
                    ? 'bg-rose-500 text-slate-950 border-rose-400 hover:bg-rose-400'
                    : 'bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400'
                }`}
              >
                <span>View Update</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={(e) => handleDismiss(alert.postId, e)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                title="Dismiss Alert"
                aria-label="Dismiss Alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      {remainingCount > 0 && (
        <button
          onClick={() => navigate('/alerts')}
          className="w-full py-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-sky-400 transition-all flex items-center justify-center gap-1.5"
        >
          <span>+{remainingCount} More Campus Alerts</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
