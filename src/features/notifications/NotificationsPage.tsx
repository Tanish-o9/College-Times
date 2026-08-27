import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getUserNotificationsPage,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
  type NotificationCategory,
} from '../../services/notificationService';
import { Bell, CheckCheck, Sparkles, ArrowLeft, RefreshCw, MessageSquare, Users, Calendar, ShieldAlert, Heart } from 'lucide-react';
import toast from 'react-hot-toast';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<NotificationCategory | 'all'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const loadNotifications = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const items = await getUserNotificationsPage(
        currentUser.uid,
        activeTab === 'all' ? undefined : activeTab,
        20
      );
      setNotifications(items);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [currentUser, activeTab]);

  const handleMarkAllRead = async () => {
    if (!currentUser || actionBusy) return;
    setActionBusy(true);
    try {
      await markAllNotificationsRead(currentUser.uid);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('All notifications marked as read.');
    } catch (err) {
      toast.error('Failed to mark notifications read.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    if (currentUser && !n.read) {
      markNotificationRead(currentUser.uid, n.id);
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
    }
    if (n.deepLink) {
      navigate(n.deepLink);
    }
  };

  const tabs: { id: NotificationCategory | 'all'; label: string; icon: any }[] = [
    { id: 'all', label: 'All', icon: Bell },
    { id: 'mentions', label: 'Mentions', icon: Sparkles },
    { id: 'social', label: 'Social', icon: Heart },
    { id: 'groups', label: 'Groups', icon: Users },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'system', label: 'System', icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-sky-400" />
              <span>Unified Activity Center 2.0</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Real-time Campus Notifications</p>
          </div>
        </div>

        <button
          onClick={handleMarkAllRead}
          disabled={actionBusy}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-sky-400 rounded-xl flex items-center gap-1.5"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Mark All Read</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-sky-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading campus notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
            No notifications in this category.
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl divide-y divide-slate-800/60 overflow-hidden shadow-xl">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                  !n.read ? 'bg-sky-500/5 hover:bg-sky-500/10' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    {n.senderAvatar ? (
                      <img src={n.senderAvatar} alt={n.senderName} className="w-10 h-10 rounded-2xl object-cover border border-slate-700" />
                    ) : (
                      <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-sm">
                        {n.senderName ? n.senderName[0].toUpperCase() : 'C'}
                      </div>
                    )}
                    {!n.read && <span className="absolute -top-1 -right-1 w-3 h-3 bg-sky-400 rounded-full ring-4 ring-slate-900" />}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{n.senderName || 'Campus Admin'}</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-slate-800 text-sky-300">
                        {n.category}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 truncate mt-0.5">{n.message}</p>
                  </div>
                </div>

                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                  Tap to open
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
