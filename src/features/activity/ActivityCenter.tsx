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
    if (act.groupId && !joinedGroupIds.includes(act.groupId) && act.actorId !== currentUser?.uid) {
      return false;
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
    <div className="min-h-screen bg-slate-950 text-white max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative overflow-hidden">
      {/* Ambient Gradient Aura */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-80 bg-gradient-to-r from-sky-500/20 via-purple-500/20 to-pink-500/20 blur-3xl opacity-80 pointer-events-none rounded-full animate-gradient-x animate-float-slow" />

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500/20 via-purple-500/20 to-pink-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/10">
              <Activity className="w-5.5 h-5.5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <span className="bg-gradient-to-r from-sky-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                  Campus Activity Center
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-extrabold shadow-md shadow-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>LIVE TRACKER</span>
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Unified real-time campus event & interaction stream</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search activity timeline..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-sky-500 shadow-md"
          />
        </div>
      </header>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar relative z-10">
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
            className={`px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all duration-200 cursor-pointer shadow-md ${
              activeCategory === tab.id
                ? 'bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 text-white shadow-lg shadow-sky-500/20 scale-105 border border-sky-300'
                : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main List */}
      {loading ? (
        <div className="p-12 bg-slate-900/80 border-2 border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs shadow-2xl relative z-10">
          <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
          <span className="font-bold">Loading activity timeline...</span>
        </div>
      ) : hasError ? (
        <div className="p-12 bg-slate-900/80 border-2 border-rose-500/20 rounded-3xl text-center space-y-3 shadow-2xl relative z-10">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto animate-bounce" />
          <p className="text-slate-300 text-sm font-bold">Unable to load campus activity. Please try again.</p>
          <button
            onClick={() => initRealtimeSubscription()}
            className="px-5 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-2xl text-xs font-extrabold transition-all inline-flex items-center gap-2 shadow-lg cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Connection</span>
          </button>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="p-12 bg-slate-900/80 border-2 border-slate-800 rounded-3xl text-center shadow-2xl relative z-10 space-y-2">
          <Activity className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-slate-300 font-bold text-sm">No recent activities matching this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full relative z-10">
          {filteredActivities.map((act) => (
            <div
              key={act.id}
              onClick={() => handleItemClick(act)}
              className="p-5 bg-slate-900/90 backdrop-blur-xl border-2 border-slate-800 hover:border-sky-500/50 hover:-translate-y-1 hover:shadow-2xl hover:shadow-sky-500/15 rounded-3xl cursor-pointer transition-all duration-300 flex flex-col justify-between gap-3 shadow-2xl group relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 opacity-70 group-hover:opacity-100 transition-opacity" />

              <div className="flex items-start gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  {getActivityIcon(act.type)}
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-black text-white font-sans group-hover:text-sky-300 transition-colors">
                      {act.actorName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatTimestamp(act.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {act.action}{' '}
                    {act.targetTitle && (
                      <span className="text-sky-400 font-bold">"{act.targetTitle}"</span>
                    )}
                  </p>
                  {act.previewText && (
                    <p className="text-[11px] text-slate-400 italic line-clamp-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-850 mt-1">
                      {act.previewText}
                    </p>
                  )}
                </div>
              </div>

              {act.groupName && (
                <div className="border-t border-slate-800/80 pt-2.5 mt-1 flex items-center justify-between">
                  <span className="inline-block text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
                    👥 {act.groupName}
                  </span>
                  <span className="text-[10px] text-sky-400 font-mono font-bold group-hover:underline">View →</span>
                </div>
              )}
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
