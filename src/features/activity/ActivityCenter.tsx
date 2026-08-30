import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useGlobalCache } from '../../context/GlobalCacheContext';
import {
  subscribeCampusActivities,
  getCampusActivitiesPaginated,
  type CampusActivityItem,
} from '../../services/activityCenterService';
import {
  Activity,
  Users,
  Calendar,
  ShoppingBag,
  Briefcase,
  BookOpen,
  HelpCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  AlertCircle,
} from 'lucide-react';
import { formatTimestamp } from '../../utils/format';
import toast from 'react-hot-toast';
import { useScrollRestoration } from '../../hooks/useScrollRestoration';

export const ActivityCenter: React.FC = () => {
  const { currentUser } = useAuth();
  const { joinedGroupIds, blockedUserIds } = useGlobalCache();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activities, setActivities] = useState<CampusActivityItem[]>([]);
  const [lastDocSnap, setLastDocSnap] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useScrollRestoration('activity', !loading);

  const initRealtimeSubscription = () => {
    if (!currentUser) return () => {};

    setLoading(true);
    setHasError(false);

    const unsubscribe = subscribeCampusActivities(
      (newActivities, lastSnap) => {
        setActivities(newActivities);
        setLastDocSnap(lastSnap);
        setLoading(false);
        setHasError(false);
      },
      (err) => {
        console.error('[ACTIVITY DEBUG] Failed to subscribe to activities:', err);
        setLoading(false);
        setHasError(true);
      },
      30
    );

    return unsubscribe;
  };

  useEffect(() => {
    const unsub = initRealtimeSubscription();
    return () => unsub();
  }, [currentUser]);

  const handleLoadMore = async () => {
    if (!currentUser || !lastDocSnap || loadingMore) return;
    setLoadingMore(true);

    try {
      const res = await getCampusActivitiesPaginated(20, lastDocSnap);
      setActivities((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newUnique = res.activities.filter((a) => a.id && !existingIds.has(a.id));
        return [...prev, ...newUnique];
      });
      setLastDocSnap(res.lastDoc);
    } catch (err) {
      toast.error('Failed to load older activities.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const filteredActivities = activities.filter((act) => {
    // 1. Blocked User Filter
    if (blockedUserIds.includes(act.actorId)) return false;

    // 2. Group Privacy Filter
    if (act.groupId && act.isPrivate) {
      if (!joinedGroupIds.includes(act.groupId)) return false;
    }

    // 3. Category Filter
    if (activeCategory !== 'all') {
      if (activeCategory === 'friend') {
        if (act.type !== 'friend' && act.actorId !== currentUser?.uid) return false;
      } else if (act.type !== activeCategory) {
        return false;
      }
    }

    // 4. Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchActor = act.actorName?.toLowerCase().includes(q);
      const matchAction = act.action?.toLowerCase().includes(q);
      const matchTarget = act.targetTitle?.toLowerCase().includes(q);
      const matchPreview = act.previewText?.toLowerCase().includes(q);
      const matchGroup = act.groupName?.toLowerCase().includes(q);
      if (!matchActor && !matchAction && !matchTarget && !matchPreview && !matchGroup) {
        return false;
      }
    }

    return true;
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'friend':
        return <Users className="w-4 h-4 text-emerald-450" />;
      case 'group':
        return <Users className="w-4 h-4 text-purple-400" />;
      case 'event':
        return <Calendar className="w-4 h-4 text-sky-400" />;
      case 'marketplace':
        return <ShoppingBag className="w-4 h-4 text-amber-400" />;
      case 'opportunity':
        return <Briefcase className="w-4 h-4 text-indigo-400" />;
      case 'academic':
        return <BookOpen className="w-4 h-4 text-pink-400" />;
      case 'support':
        return <HelpCircle className="w-4 h-4 text-sky-300" />;
      case 'system':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleItemClick = (act: CampusActivityItem) => {
    if (act.groupId) {
      navigate(`/groups/${act.groupId}`);
    } else if (act.targetId) {
      if (act.type === 'event') navigate(`/events/${act.targetId}`);
      else if (act.type === 'marketplace') navigate(`/marketplace`);
      else if (act.type === 'opportunity') navigate(`/opportunities`);
      else if (act.type === 'academic') navigate(`/academic`);
      else if (act.type === 'support') navigate(`/support`);
      else navigate(`/feed`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Activity className="w-5.5 h-5.5 text-sky-400" />
              <span>Campus Activity Center</span>
            </h2>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE</span>
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono uppercase">Unified real-time feed tracker</p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Filter activities..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-sky-500"
          />
        </div>
      </header>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {[
          { id: 'all', label: 'All Activities' },
          { id: 'friend', label: 'Friends' },
          { id: 'group', label: 'Groups' },
          { id: 'event', label: 'Events' },
          { id: 'marketplace', label: 'Marketplace' },
          { id: 'opportunity', label: 'Opportunities' },
          { id: 'academic', label: 'Academic' },
          { id: 'support', label: 'Support' },
          { id: 'system', label: 'Alerts' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
              activeCategory === tab.id
                ? 'bg-sky-500 text-slate-950 border-sky-400'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main List */}
      {loading ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Loading activity timeline...</span>
        </div>
      ) : hasError ? (
        <div className="p-12 bg-slate-900/40 border border-rose-500/20 rounded-3xl text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-slate-300 text-xs font-medium">Unable to load campus activity. Please try again.</p>
          <button
            onClick={() => initRealtimeSubscription()}
            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-2xl text-xs font-bold transition-all inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center">
          <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-450 text-xs">No recent activities matching this filter.</p>
        </div>
      ) : (
        <div className="space-y-3.5 max-w-3xl mx-auto">
          {filteredActivities.map((act) => (
            <div
              key={act.id}
              onClick={() => handleItemClick(act)}
              className="p-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 hover:border-sky-500/40 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(56,189,248,0.15)] rounded-3xl cursor-pointer transition-all duration-200 flex items-start gap-4 shadow-lg group"
            >
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-2xl shrink-0">
                {getActivityIcon(act.type)}
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white font-sans">
                    {act.actorName}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {formatTimestamp(act.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  {act.action}{' '}
                  {act.targetTitle && (
                    <span className="text-sky-400 font-bold">"{act.targetTitle}"</span>
                  )}
                </p>
                {act.previewText && (
                  <p className="text-[11px] text-slate-450 italic line-clamp-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                    {act.previewText}
                  </p>
                )}
                {act.groupName && (
                  <span className="inline-block text-[9px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full font-mono mt-1">
                    👥 {act.groupName}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Load More */}
          {lastDocSnap && (
            <div className="pt-4 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 mx-auto"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <span>Load More Activities</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
