import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getNotificationsPaginated,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notificationService';
import type { NotificationItem, NotificationCategory } from '../types/notification';
import { formatTimestamp } from '../utils/format';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  MessageSquare,
  Heart,
  Calendar,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { DocumentSnapshot } from 'firebase/firestore';

export const NotificationCenter: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchInitial = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await getNotificationsPaginated(currentUser.uid, { limitCount: 20 });
      setNotifications(res.notifications);
      setLastDoc(res.lastDoc);
      setHasMore(res.hasMore);
    } catch (err) {
      toast.error('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitial();
  }, [currentUser]);

  const handleLoadMore = async () => {
    if (!currentUser || !lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getNotificationsPaginated(currentUser.uid, {
        limitCount: 20,
        startAfterDoc: lastDoc,
      });
      setNotifications((prev) => [...prev, ...res.notifications]);
      setLastDoc(res.lastDoc);
      setHasMore(res.hasMore);
    } catch (err) {
      toast.error('Failed to load more notifications.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    await markNotificationAsRead(id);
  };

  const handleMarkAllRead = async () => {
    if (!currentUser) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsAsRead(currentUser.uid);
    toast.success('All notifications marked as read.');
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.read) {
      handleMarkAsRead(item.id);
    }

    if (item.deepLink) {
      navigate(item.deepLink);
    } else if (item.incidentId) {
      navigate(`/incidents/${item.incidentId}`);
    } else if (item.eventId) {
      navigate(`/events/${item.eventId}`);
    } else if (item.channelId) {
      navigate(`/chat/${item.channelId}`);
    } else if (item.postId) {
      navigate(`/?postId=${item.postId}`);
    }
  };

  // Category Filter Function
  const filteredNotifications = notifications.filter((item) => {
    if (activeCategory === 'unread') return !item.read;
    if (activeCategory === 'mentions') return item.type === 'mention' || item.type === 'reply';
    if (activeCategory === 'chat') return item.type === 'mention' || item.type === 'reply' || item.type === 'reaction' || item.type === 'chat_activity';
    if (activeCategory === 'alerts') return item.type === 'campus_incident' || item.type === 'admin_broadcast';
    if (activeCategory === 'events') return item.type === 'event_created' || item.type === 'event_reminder' || item.type === 'event_rsvp';
    if (activeCategory === 'social') return item.type === 'post_like' || item.type === 'post_comment' || item.type === 'lost_found';
    return true;
  });

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'campus_incident':
      case 'admin_broadcast':
        return <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'event_created':
      case 'event_reminder':
      case 'event_rsvp':
        return <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'post_like':
      case 'post_comment':
        return <Heart className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'mention':
      case 'reply':
      case 'chat_activity':
        return <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Tabs Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-xs">
          {(['all', 'unread', 'mentions', 'chat', 'alerts', 'events', 'social'] as NotificationCategory[]).map(
            (cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full font-bold uppercase text-[10px] transition-all whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-sky-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.replace('_', ' ')}
              </button>
            )
          )}
        </div>

        <button
          onClick={handleMarkAllRead}
          className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0"
        >
          <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Mark All Read</span>
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Loading notifications...</span>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-2">
          <Bell className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-slate-400 text-xs font-semibold">No notifications found in this category.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNotificationClick(item)}
              className={`p-4 rounded-3xl border transition-all cursor-pointer flex items-center justify-between gap-4 group ${
                item.read
                  ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  : 'bg-slate-900 border-sky-500/40 hover:border-sky-500/60 shadow-lg'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                {getItemIcon(item.type)}
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!item.read && (
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    )}
                    {item.severity && (
                      <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {item.severity}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatTimestamp(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-white group-hover:text-sky-400 transition-colors">
                    {item.title || item.message}
                  </p>
                  {item.title && (
                    <p className="text-[11px] text-slate-400 line-clamp-1">{item.message}</p>
                  )}
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
            </div>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="pt-2 text-center">
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
                  <span>Load More Notifications</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
