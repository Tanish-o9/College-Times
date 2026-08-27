import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useOverlayBackHandler } from '../hooks/useOverlayBackHandler';
import { getNotificationsPaginated, markAllAsRead } from '../services/notificationService';
import type { NotificationItem } from '../types/notification';
import { NotificationCard } from './NotificationCard';
import { Bell, X, Inbox } from 'lucide-react';

interface NotificationTrayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationTray: React.FC<NotificationTrayProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  useOverlayBackHandler(isOpen, onClose);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const trayRef = useRef<HTMLDivElement>(null);
  const hasMarkedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!currentUser || !isOpen) {
      hasMarkedRef.current = false;
      return;
    }

    // Call markAllAsRead once on open if not already marked
    if (!hasMarkedRef.current) {
      hasMarkedRef.current = true;
      markAllAsRead(currentUser.uid);
    }

    let isMounted = true;
    getNotificationsPaginated(currentUser.uid).then((res: any) => {
      if (isMounted) {
        setNotifications(Array.isArray(res) ? res : res.notifications || []);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentUser, isOpen]);

  // Click outside to close tray
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      ref={trayRef}
      className="absolute top-14 right-4 sm:right-6 z-50 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] text-sky-400 font-semibold">{unreadCount} unread</span>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List Body */}
      <div className="max-h-96 overflow-y-auto p-4 space-y-2.5 scrollbar-thin">
        {notifications.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-slate-400 flex items-center justify-center mx-auto">
              <Inbox className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-slate-300">No notifications yet</p>
            <p className="text-[11px] text-slate-500">Activity on your posts will appear here.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationCard key={n.id} notification={n} />
          ))
        )}
      </div>
    </div>
  );
};
