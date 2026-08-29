import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationsPaginated,
} from '../services/notificationService';
import { rankNotifications } from '../services/notificationRankingService';
import { approveJoinRequest, rejectJoinRequest } from '../services/groupManagementService';
import { toggleRsvpStatus } from '../services/eventService';
import { acceptOffer, rejectOffer } from '../services/marketplaceOfferService';
import type { NotificationItem, NotificationCategory } from '../types/notification';
import { formatTimestamp } from '../utils/format';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  MessageSquare,
  Calendar,
  ChevronRight,
  ShieldAlert,
  Megaphone,
  Users,
  Search,
  Check,
  X,
  Briefcase,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const NotificationCenter: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Real-time subscription to notifications (first 30, newest first)
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToNotifications(currentUser.uid, (items) => {
      setNotifications(items);
      setLoading(false);
    });
    return () => unsubscribe();
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

  const handleDelete = async (id: string) => {
    if (!currentUser) return;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(currentUser.uid, id);
    toast.success('Notification dismissed.');
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.read && currentUser) {
      handleMarkAsRead(item.id);
    }

    if (item.deepLink) {
      navigate(item.deepLink);
    } else if (item.groupId) {
      navigate(`/groups/${item.groupId}`);
    } else if (item.eventId) {
      navigate(`/events/${item.eventId}`);
    } else if (item.postId) {
      navigate(`/?postId=${item.postId}`);
    }
  };

  const handleAction = async (item: NotificationItem, action: 'approve' | 'reject' | 'rsvp_going' | 'rsvp_maybe' | 'accept_offer' | 'reject_offer') => {
    if (!currentUser) return;
    setActioningId(item.id);
    try {
      if (action === 'approve' && item.groupId && item.actorId) {
        await approveJoinRequest(item.groupId, item.actorId, currentUser as any);
        toast.success('Join request approved!');
      } else if (action === 'reject' && item.groupId && item.actorId) {
        await rejectJoinRequest(item.groupId, item.actorId, currentUser as any);
        toast.success('Join request declined.');
      } else if (action === 'rsvp_going' && item.eventId) {
        await toggleRsvpStatus(item.eventId, currentUser.uid, 'going');
        toast.success('You are going to this event!');
      } else if (action === 'rsvp_maybe' && item.eventId) {
        await toggleRsvpStatus(item.eventId, currentUser.uid, 'maybe');
        toast.success('RSVP updated.');
      } else if (action === 'accept_offer' && item.actionable?.entityId) {
        await acceptOffer(item.actionable.entityId, currentUser.uid);
        toast.success('Offer accepted!');
      } else if (action === 'reject_offer' && item.actionable?.entityId) {
        await rejectOffer(item.actionable.entityId, currentUser.uid);
        toast.success('Offer declined.');
      }

      // Mark notification as read and clear actionable state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, read: true, actionable: undefined } : n
        )
      );
      await markNotificationAsRead(item.id, currentUser.uid);
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setActioningId(null);
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // Category Tab Filter
      if (activeCategory === 'unread' && item.read) return false;
      if (activeCategory === 'mentions' && !['mention', 'group_mention', 'reply', 'group_reply'].includes(item.type)) return false;
      if (activeCategory === 'messages' && item.category !== 'messages') return false;
      if (activeCategory === 'groups' && item.category !== 'groups') return false;
      if (activeCategory === 'events' && item.category !== 'events') return false;
      if (activeCategory === 'opportunities' && item.category !== 'opportunities') return false;
      if (activeCategory === 'marketplace' && item.category !== 'marketplace') return false;
      if (activeCategory === 'system' && item.category !== 'system') return false;

      // Text Search Filter
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(queryLower);
        const matchesBody = item.message.toLowerCase().includes(queryLower);
        if (!matchesTitle && !matchesBody) return false;
      }

      return true;
    });
  }, [notifications, activeCategory, searchQuery]);

  const groupedNotifications = useMemo(() => {
    const result: NotificationItem[] = [];
    const likeGroups: Record<string, NotificationItem[]> = {};
    const commentGroups: Record<string, NotificationItem[]> = {};
    const rsvpGroups: Record<string, NotificationItem[]> = {};

    filteredNotifications.forEach((item) => {
      if ((item.type === 'post_like' || item.type === 'like' || item.type === 'reaction') && item.postId) {
        const key = `like_${item.postId}`;
        if (!likeGroups[key]) likeGroups[key] = [];
        likeGroups[key].push(item);
      } else if ((item.type === 'post_comment' || item.type === 'comment') && item.postId) {
        const key = `comment_${item.postId}`;
        if (!commentGroups[key]) commentGroups[key] = [];
        commentGroups[key].push(item);
      } else if (item.type === 'event_rsvp' && item.eventId) {
        const key = `rsvp_${item.eventId}`;
        if (!rsvpGroups[key]) rsvpGroups[key] = [];
        rsvpGroups[key].push(item);
      } else {
        result.push(item);
      }
    });

    const getGroupedText = (items: NotificationItem[], actionText: string) => {
      const names = items.map((i) => i.senderName || 'A peer');
      const uniqueNames = Array.from(new Set(names));
      if (uniqueNames.length === 1) {
        return `${uniqueNames[0]} ${actionText}`;
      } else if (uniqueNames.length === 2) {
        return `${uniqueNames[0]} and ${uniqueNames[1]} ${actionText}`;
      } else {
        const count = uniqueNames.length - 2;
        return `${uniqueNames[0]}, ${uniqueNames[1]} and ${count} others ${actionText}`;
      }
    };

    Object.entries(likeGroups).forEach(([, items]) => {
      if (items.length === 1) {
        result.push(items[0]);
      } else if (items.length > 1) {
        const first = items[0];
        result.push({
          ...first,
          message: getGroupedText(items, 'liked your post'),
          groupCount: items.length,
        });
      }
    });

    Object.entries(commentGroups).forEach(([, items]) => {
      if (items.length === 1) {
        result.push(items[0]);
      } else if (items.length > 1) {
        const first = items[0];
        result.push({
          ...first,
          message: getGroupedText(items, 'commented on your post'),
          groupCount: items.length,
        });
      }
    });

    Object.entries(rsvpGroups).forEach(([, items]) => {
      if (items.length === 1) {
        result.push(items[0]);
      } else if (items.length > 1) {
        const first = items[0];
        result.push({
          ...first,
          message: getGroupedText(items, 'registered for your event'),
          groupCount: items.length,
        });
      }
    });

    return rankNotifications(result);
  }, [filteredNotifications]);

  const notificationsByCategory = useMemo(() => {
    const groups: Record<string, NotificationItem[]> = {
      'Likes & Comments': [],
      'Group Invites & Access': [],
      'Campus Events': [],
      'Marketplace Offers': [],
      'Career Opportunities': [],
      'Other Alerts': [],
    };

    groupedNotifications.forEach((item) => {
      if (item.type === 'like' || item.type === 'comment' || item.type === 'reply' || item.type === 'reaction') {
        groups['Likes & Comments'].push(item);
      } else if (item.category === 'groups' || item.type === 'group_join' || item.type === 'group_invite') {
        groups['Group Invites & Access'].push(item);
      } else if (item.category === 'events' || item.type === 'event_rsvp' || item.type === 'event_invite') {
        groups['Campus Events'].push(item);
      } else if (item.category === 'marketplace' || item.type === 'offer' || item.type === 'marketplace_deal') {
        groups['Marketplace Offers'].push(item);
      } else if (item.category === 'opportunities' || item.type === 'opportunity') {
        groups['Career Opportunities'].push(item);
      } else {
        groups['Other Alerts'].push(item);
      }
    });

    return groups;
  }, [groupedNotifications]);

  const getItemIcon = (category: string) => {
    switch (category) {
      case 'emergency':
      case 'security':
        return <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'system':
        return <Megaphone className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'events':
        return <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'groups':
        return <Users className="w-4 h-4 text-sky-400 shrink-0" />;
      case 'messages':
        return <MessageSquare className="w-4 h-4 text-purple-400 shrink-0" />;
      case 'opportunities':
        return <Briefcase className="w-4 h-4 text-indigo-400 shrink-0" />;
      case 'marketplace':
        return <ShoppingBag className="w-4 h-4 text-amber-500 shrink-0" />;
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
              'messages',
              'groups',
              'events',
              'opportunities',
              'marketplace',
              'system',
            ] as NotificationCategory[]
          ).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full font-bold uppercase text-[10px] transition-all whitespace-nowrap ${
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

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notifications history..."
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
        />
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Loading notifications...</span>
        </div>
      ) : groupedNotifications.length === 0 ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-2">
          <Bell className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-slate-400 text-xs font-semibold">No notifications found in this category.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(notificationsByCategory).map(([catName, items]) => {
            if (items.length === 0) return null;
            const isCollapsed = collapsedCategories[catName] ?? false;

            return (
              <div key={catName} className="border border-slate-800 rounded-3xl bg-slate-900/40 overflow-hidden shadow-lg">
                <button
                  type="button"
                  onClick={() => setCollapsedCategories(prev => ({ ...prev, [catName]: !isCollapsed }))}
                  className="w-full flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800/60 hover:bg-slate-850/60 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase font-mono">{catName}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] text-sky-400 font-bold font-mono">
                      {items.length}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                </button>

                {!isCollapsed && (
                  <div className="p-3 space-y-2.5 bg-slate-955/20">
                    {items.map((item) => {
                      const isExpired = item.expiresAt && (item.expiresAt.toDate ? item.expiresAt.toDate().getTime() : Number(item.expiresAt)) < Date.now();
                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-3xl border transition-all flex flex-col gap-3 group ${
                            item.read
                              ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                              : 'bg-slate-900 border-sky-500/40 hover:border-sky-500/60 shadow-lg'
                          }`}
                        >
                          <div
                            onClick={() => handleNotificationClick(item)}
                            className="flex items-start justify-between gap-4 cursor-pointer w-full"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              {getItemIcon(item.category)}
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
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(item.id);
                                }}
                                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-rose-455 transition-colors"
                                title="Dismiss Alert"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <ChevronRight className="w-4 h-4 text-slate-650 group-hover:text-slate-305 transition-colors" />
                            </div>
                          </div>

                          {/* Actionable Controls */}
                          {item.actionable && !item.read && (
                            <div className="flex gap-2 justify-end pt-2 border-t border-slate-800/80">
                              {isExpired ? (
                                <span className="text-[10px] text-slate-500 italic">This action request has expired</span>
                              ) : (
                                <>
                                  {item.actionable.actionType === 'group_join' && (
                                    <>
                                      <button
                                        disabled={actioningId === item.id}
                                        onClick={() => handleAction(item, 'approve')}
                                        className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold text-[10px] rounded-lg flex items-center gap-1"
                                      >
                                        <Check className="w-3 h-3" />
                                        <span>Approve</span>
                                      </button>
                                      <button
                                        disabled={actioningId === item.id}
                                        onClick={() => handleAction(item, 'reject')}
                                        className="px-3 py-1 bg-slate-800 text-slate-300 font-bold text-[10px] rounded-lg flex items-center gap-1 border border-slate-700"
                                      >
                                        <X className="w-3 h-3" />
                                        <span>Decline</span>
                                      </button>
                                    </>
                                  )}
                                  {item.actionable.actionType === 'event_rsvp' && (
                                    <>
                                      <button
                                        disabled={actioningId === item.id}
                                        onClick={() => handleAction(item, 'rsvp_going')}
                                        className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold text-[10px] rounded-lg flex items-center gap-1"
                                      >
                                        <span>Going</span>
                                      </button>
                                      <button
                                        disabled={actioningId === item.id}
                                        onClick={() => handleAction(item, 'rsvp_maybe')}
                                        className="px-3 py-1 bg-slate-800 text-slate-300 font-bold text-[10px] rounded-lg border border-slate-700"
                                      >
                                        <span>Maybe</span>
                                      </button>
                                    </>
                                  )}
                                  {item.actionable.actionType === 'marketplace_offer' && (
                                    <>
                                      <button
                                        disabled={actioningId === item.id}
                                        onClick={() => handleAction(item, 'accept_offer')}
                                        className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold text-[10px] rounded-lg"
                                      >
                                        <span>Accept Offer</span>
                                      </button>
                                      <button
                                        disabled={actioningId === item.id}
                                        onClick={() => handleAction(item, 'reject_offer')}
                                        className="px-3 py-1 bg-slate-800 text-slate-300 font-bold text-[10px] rounded-lg border border-slate-700"
                                      >
                                        <span>Reject Offer</span>
                                      </button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

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
