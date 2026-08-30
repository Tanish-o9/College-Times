import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import { Sparkles, RefreshCw, X, Megaphone, Calendar, BarChart3, UserPlus, ChevronRight, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { GroupActivityEvent } from '../../services/groupActivityService';

interface RealtimeGroupActivityProps {
  groupId: string;
  onRefresh?: () => void;
  onOpenTimeline?: () => void;
}

export const RealtimeGroupActivity: React.FC<RealtimeGroupActivityProps> = ({
  groupId,
  onRefresh,
  onOpenTimeline,
}) => {
  const navigate = useNavigate();
  const [newActivityCount, setNewActivityCount] = useState(0);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [activities, setActivities] = useState<GroupActivityEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useOverlayBackHandler(isModalOpen, () => setIsModalOpen(false));

  useEffect(() => {
    if (!groupId) return;

    const activityColRef = collection(db, 'groups', groupId, 'activity');
    const q = query(activityColRef, orderBy('createdAt', 'desc'), limit(15));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const docsList: GroupActivityEvent[] = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<GroupActivityEvent, 'id'>),
        }));

        setActivities(docsList);

        if (!initialLoaded) {
          setInitialLoaded(true);
        } else {
          // Bounded activity update indicator increment
          if (!snap.empty) {
            setNewActivityCount((prev) => prev + 1);
          }
        }
      },
      (err) => {
        console.error('Failed to listen to group activity:', err);
      }
    );

    return () => unsubscribe();
  }, [groupId, initialLoaded]);

  const handleOpenDrawer = () => {
    setNewActivityCount(0);
    setIsModalOpen(true);
    if (onRefresh) onRefresh();
  };

  const getActivityIcon = (type: GroupActivityEvent['type']) => {
    switch (type) {
      case 'announcement':
        return <Megaphone className="w-4 h-4 text-amber-400" />;
      case 'event':
        return <Calendar className="w-4 h-4 text-emerald-400" />;
      case 'poll':
        return <BarChart3 className="w-4 h-4 text-purple-400" />;
      case 'moment':
        return <Sparkles className="w-4 h-4 text-sky-400" />;
      case 'membership_change':
        return <UserPlus className="w-4 h-4 text-indigo-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleActivityClick = (act: GroupActivityEvent) => {
    setIsModalOpen(false);
    if (act.targetType === 'moment' && act.targetId) {
      navigate(`/groups/${groupId}?moment=${act.targetId}`);
    } else if (act.targetType === 'poll' && act.targetId) {
      navigate(`/groups/${groupId}?tab=polls&poll=${act.targetId}`);
    } else if (act.targetType === 'event' && act.targetId) {
      navigate(`/events/${act.targetId}`);
    } else if (onOpenTimeline) {
      onOpenTimeline();
    }
  };

  const formatTimeAgo = (createdAt: any) => {
    if (!createdAt) return 'Just now';
    let ms = 0;
    if (typeof createdAt?.toMillis === 'function') ms = createdAt.toMillis();
    else if (typeof createdAt?.toDate === 'function') ms = createdAt.toDate().getTime();
    else if (createdAt?.seconds) ms = createdAt.seconds * 1000;
    else if (typeof createdAt === 'number') ms = createdAt;
    else ms = new Date(createdAt).getTime();

    if (isNaN(ms) || ms <= 0) return 'Recently';

    const diffSec = Math.floor((Date.now() - ms) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  return (
    <>
      {/* Floating Notification Pill */}
      {newActivityCount > 0 && (
        <div className="fixed bottom-6 right-6 z-40 animate-bounce">
          <button
            onClick={handleOpenDrawer}
            className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-full shadow-2xl flex items-center gap-2 transition-all border border-sky-300 active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{newActivityCount} New Activity {newActivityCount === 1 ? 'Update' : 'Updates'}</span>
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Activity Updates Overlay Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-bottom-6 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Recent Activity Updates</h3>
                  <p className="text-[11px] text-slate-400">Latest real-time group notifications & actions</p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Activity Items List */}
            <div className="p-4 overflow-y-auto space-y-2.5 divide-y divide-slate-800/50">
              {activities.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 italic">
                  No recent activity updates found.
                </div>
              ) : (
                activities.map((act) => (
                  <div
                    key={act.id || Math.random().toString()}
                    onClick={() => handleActivityClick(act)}
                    className="pt-2.5 first:pt-0 flex items-start gap-3 p-3 rounded-2xl hover:bg-slate-800/60 cursor-pointer transition-all group"
                  >
                    {/* Actor Avatar / Icon */}
                    <div className="relative shrink-0">
                      {act.actorAvatar ? (
                        <img
                          src={act.actorAvatar}
                          alt={act.actorName}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center">
                          {act.actorName ? act.actorName.charAt(0).toUpperCase() : 'C'}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                        {getActivityIcon(act.type)}
                      </div>
                    </div>

                    {/* Activity Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200 truncate group-hover:text-sky-300">
                          {act.actorName || 'Campus Member'}
                        </span>
                        <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                          {formatTimeAgo(act.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        {act.preview || `Performed a new ${act.type} action.`}
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 shrink-0 self-center" />
                  </div>
                ))
              )}
            </div>

            {/* Footer Action */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  if (onOpenTimeline) onOpenTimeline();
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <span>View Full Group Activity Timeline</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
