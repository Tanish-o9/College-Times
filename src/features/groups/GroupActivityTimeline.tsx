import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGroupActivityTimeline, markGroupActivitySeen, type GroupActivityEvent } from '../../services/groupActivityService';
import { Sparkles, Calendar, BarChart3, Megaphone, UserPlus, RefreshCw, ChevronRight } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

interface GroupActivityTimelineProps {
  groupId: string;
  userId?: string;
}

export const GroupActivityTimeline: React.FC<GroupActivityTimelineProps> = ({ groupId, userId }) => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<GroupActivityEvent[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const loadActivities = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await getGroupActivityTimeline(groupId, 20);
      setActivities(res.activities);
      setLastDoc(res.lastDoc);
      if (userId && res.activities.length > 0) {
        markGroupActivitySeen(groupId, userId, res.activities[0].id);
      }
    } catch (err) {
      console.error('Failed to load group activity timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!groupId || !lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getGroupActivityTimeline(groupId, 20, lastDoc);
      setActivities((prev) => [...prev, ...res.activities]);
      setLastDoc(res.lastDoc);
    } catch (err) {
      console.error('Failed to load more activities:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [groupId]);

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
        return <Sparkles className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleNavigateTarget = (act: GroupActivityEvent) => {
    if (act.targetType === 'moment' && act.targetId) {
      navigate(`/groups/${groupId}?moment=${act.targetId}`);
    } else if (act.targetType === 'poll' && act.targetId) {
      navigate(`/groups/${groupId}?tab=polls&poll=${act.targetId}`);
    } else if (act.targetType === 'event' && act.targetId) {
      navigate(`/events/${act.targetId}`);
    } else {
      navigate(`/groups/${groupId}`);
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
        <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
        <span>Loading activity timeline...</span>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
        No persistent activity logged in this group timeline yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl divide-y divide-slate-800/60 overflow-hidden">
        {activities.map((act) => (
          <div
            key={act.id}
            onClick={() => handleNavigateTarget(act)}
            className="p-4 hover:bg-slate-800/40 cursor-pointer flex items-center justify-between gap-3 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                {getActivityIcon(act.type)}
              </div>
              <div>
                <p className="text-xs font-semibold text-white">
                  <span className="font-bold text-sky-300">{act.actorName}</span>{' '}
                  <span className="text-slate-300">
                    {act.type === 'announcement'
                      ? 'created an announcement'
                      : act.type === 'event'
                      ? 'created an event'
                      : act.type === 'poll'
                      ? 'started a new poll'
                      : act.type === 'moment'
                      ? 'shared a Group Moment'
                      : 'updated group activity'}
                  </span>
                </p>
                {act.preview && <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">{act.preview}</p>}
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors shrink-0" />
          </div>
        ))}
      </div>

      {lastDoc && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 rounded-2xl transition-colors flex items-center justify-center gap-2"
        >
          {loadingMore ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
          <span>Load More Activity</span>
        </button>
      )}
    </div>
  );
};
