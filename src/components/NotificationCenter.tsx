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
  Sparkles,
  Calendar,
  ChevronRight,
  ShieldAlert,
  BarChart3,
  Megaphone,
  UserCheck,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { DocumentSnapshot } from 'firebase/firestore';

export const NotificationCenter: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchInitial = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await getNotificationsPaginated(currentUser.uid, { limitCount: 20 });
      setNotifications(res.notifications as any);
      setLastDoc(res.lastDoc);
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
        lastDoc,
      });
      setNotifications((prev) => [...prev, ...(res.notifications as any)]);
      setLastDoc(res.lastDoc);
    } catch (err) {
      toast.error('Failed to load more notifications.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    await markNotificationAsRead(id, currentUser?.uid || '');
  };

  const handleMarkAllRead = async () => {
    if (!currentUser) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsAsRead(currentUser.uid);
    toast.success('All notifications marked as read.');
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.read && currentUser) {
      handleMarkAsRead(item.id);
    }

    if (item.deepLink) {
      navigate(item.deepLink);
    } else if (item.groupId) {
      navigate(`/groups/${item.groupId}`);
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

  const filteredNotifications = notifications.filter((item) => {
    if (activeCategory === 'unread') return !item.read;
    if (activeCategory === 'mentions') return item.type === 'mention' || item.type === 'group_mention' || item.type === 'reply' || item.type === 'group_reply';
    if (activeCategory === 'group_chat') return item.type === 'group_chat_message' || item.type === 'group_mention';
    if (activeCategory === 'moments') return item.type === 'moment_created' || item.type === 'moment_comment' || item.type === 'moment_reaction';
    if (activeCategory === 'polls') return item.type === 'poll_created' || item.type === 'poll_result';
    if (activeCategory === 'events') return item.type === 'event_created' || item.type === 'event_reminder' || item.type === 'event_rsvp';
    if (activeCategory === 'announcements') return item.type === 'group_announcement' || item.type === 'admin_broadcast';
    if (activeCategory === 'moderation') return item.type === 'group_moderation' || item.type === 'campus_incident';
    if (activeCategory === 'membership') return item.type === 'join_request' || item.type === 'membership_change' || item.type === 'group_invite';
    return true;
  });

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'campus_incident':
      case 'group_moderation':
        return <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'group_announcement':
      case 'admin_broadcast':
        return <Megaphone className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'event_created':
      case 'event_reminder':
      case 'event_rsvp':
        return <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'moment_created':
      case 'moment_comment':
      case 'moment_reaction':
        return <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />;
      case 'poll_created':
      case 'poll_result':
        return <BarChart3 className="w-4 h-4 text-indigo-400 shrink-0" />;
      case 'join_request':
      case 'membership_change':
        return <UserCheck className="w-4 h-4 text-sky-400 shrink-0" />;
      case 'mention':
      case 'group_mention':
      case 'reply':
      case 'group_reply':
      case 'group_chat_message':
        return <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  const getPriorityBadge = (priority?: string) => {
    if (priority === 'critical') {
      return (
        <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
          CRITICAL
        </span>
      );
    }
    if (priority === 'high') {
      return (
        <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
          HIGH
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Category Tabs Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-xs">
          {(
            [
              'all',
              'unread',
              'mentions',
              'group_chat',
              'moments',
              'polls',
              'events',
              'announcements',
              'moderation',
              'membership',
            ] as NotificationCategory[]
          ).map((cat) => (
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
          ))}
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
                    {item.groupName && (
                      <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase bg-slate-800 text-sky-300 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{item.groupName}</span>
                      </span>
                    )}
                    {getPriorityBadge(item.priority)}
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
          {lastDoc && (
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
