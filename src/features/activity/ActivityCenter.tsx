import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useGlobalCache } from '../../context/GlobalCacheContext';
import {
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
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useScrollRestoration('activity', !loading);

  const loadActivities = async (reset: boolean = false) => {
    if (!currentUser) return;
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await getCampusActivitiesPaginated(
        joinedGroupIds,
        blockedUserIds,
        activeCategory,
        20,
        reset ? null : lastDoc
      );

      if (reset) {
        setActivities(res.activities);
      } else {
        setActivities((prev) => [...prev, ...res.activities]);
      }
      setLastDoc(res.lastDoc);
    } catch {
      toast.error('Failed to load campus activity logs.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadActivities(true);
  }, [currentUser, activeCategory]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const filteredActivities = activities.filter((act) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      act.actorName.toLowerCase().includes(q) ||
      act.action.toLowerCase().includes(q) ||
      act.previewText?.toLowerCase().includes(q) ||
      act.targetTitle?.toLowerCase().includes(q)
    );
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
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-0.5">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Activity className="w-5.5 h-5.5 text-sky-400 animate-pulse" />
            <span>Campus Activity Center</span>
          </h2>
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
              className="p-4 bg-slate-900/60 border border-slate-850 hover:border-slate-700/65 rounded-3xl cursor-pointer transition-all flex items-start gap-4 shadow-md"
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
          {lastDoc && (
            <div className="pt-4 text-center">
              <button
                onClick={() => loadActivities(false)}
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
