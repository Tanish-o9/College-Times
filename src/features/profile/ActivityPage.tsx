import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getRecentlyViewed, clearRecentlyViewed } from '../../services/recentlyViewedService';
import type { RecentlyViewedItem } from '../../services/recentlyViewedService';
import { ArrowLeft, Trash2, Clock, RefreshCw, Eye, Newspaper, User, Users, Calendar, ShoppingBag, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPostById } from '../../services/postService';
import { getGroupById } from '../../services/groupService';
import { getEventById } from '../../services/eventService';
import { getOpportunityById } from '../../services/opportunityService';
import { getListingById } from '../../services/marketplaceService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface HydratedActivityItem {
  log: RecentlyViewedItem;
  title: string;
  subtitle?: string;
  link: string;
}

export const ActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [logs, setLogs] = useState<HydratedActivityItem[]>([]);

  const fetchLogs = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const items = await getRecentlyViewed(currentUser.uid, 30);
      
      const hydrated = await Promise.all(
        items.map(async (item) => {
          let title = 'Unknown Entity';
          let subtitle = '';
          let link = '#';

          try {
            switch (item.entityType) {
              case 'post': {
                const post = await getPostById(item.entityId);
                title = post?.title || post?.content || 'Post';
                subtitle = 'Post';
                link = `/feed?postId=${item.entityId}`;
                break;
              }
              case 'profile': {
                const userSnap = await getDoc(doc(db, 'users', item.entityId));
                if (userSnap.exists()) {
                  title = userSnap.data().displayName || 'Student';
                  subtitle = 'User Profile';
                  link = `/profile/${userSnap.data().username || item.entityId}`;
                }
                break;
              }
              case 'group': {
                const group = await getGroupById(item.entityId);
                title = group?.name || 'Group';
                subtitle = 'Group';
                link = `/groups/${item.entityId}`;
                break;
              }
              case 'event': {
                const ev = await getEventById(item.entityId);
                title = ev?.title || 'Event';
                subtitle = 'Event';
                link = `/events/${item.entityId}`;
                break;
              }
              case 'marketplace': {
                const list = await getListingById(item.entityId);
                title = list?.title || 'Listing';
                subtitle = 'Marketplace Listing';
                link = `/marketplace/${item.entityId}`;
                break;
              }
              case 'opportunity': {
                const opp = await getOpportunityById(item.entityId);
                title = opp?.title || 'Opportunity';
                subtitle = 'Opportunity';
                link = `/discover?tab=opportunities&id=${item.entityId}`;
                break;
              }
            }
          } catch (e) {
            // fallback
            title = `ID: ${item.entityId}`;
            subtitle = `${item.entityType.toUpperCase()}`;
          }

          return {
            log: item,
            title,
            subtitle,
            link,
          };
        })
      );

      setLogs(hydrated);
    } catch (err) {
      toast.error('Failed to load activity logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentUser]);

  const handleClearHistory = async () => {
    if (!currentUser || clearing) return;
    if (!window.confirm('Are you sure you want to clear your recently viewed history? This cannot be undone.')) return;
    setClearing(true);
    try {
      await clearRecentlyViewed(currentUser.uid);
      setLogs([]);
      toast.success('Activity history cleared.');
    } catch {
      toast.error('Failed to clear history.');
    } finally {
      setClearing(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'post': return <Newspaper className="w-4 h-4 text-sky-400" />;
      case 'profile': return <User className="w-4 h-4 text-emerald-400" />;
      case 'group': return <Users className="w-4 h-4 text-purple-400" />;
      case 'event': return <Calendar className="w-4 h-4 text-amber-400" />;
      case 'marketplace': return <ShoppingBag className="w-4 h-4 text-pink-400" />;
      case 'opportunity': return <Briefcase className="w-4 h-4 text-blue-400" />;
      default: return <Eye className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col pb-12">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-sky-400" />
            <span>Your Activity</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-mono">Recently viewed items (private to you)</p>
        </div>
        {logs.length > 0 && (
          <button
            onClick={handleClearHistory}
            disabled={clearing}
            className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-12 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Hydrating activity logs...</span>
          </div>
        )}

        {!loading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <Clock className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-sm font-bold text-slate-300">No recent activity</p>
            <p className="text-xs text-slate-500 max-w-xs">Items you view around campus will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((item, idx) => (
              <div
                key={idx}
                onClick={() => navigate(item.link)}
                className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3 hover:border-slate-700 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                  {getIcon(item.log.entityType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{item.subtitle}</p>
                </div>
                {item.log.viewedAt && (
                  <span className="text-[10px] text-slate-600 shrink-0 font-mono">
                    {new Date(item.log.viewedAt?.toMillis ? item.log.viewedAt.toMillis() : item.log.viewedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
