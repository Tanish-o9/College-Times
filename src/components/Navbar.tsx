import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { subscribeToNotifications } from '../services/notificationService';
import { NotificationTray } from './NotificationTray';
import { BugReportModal } from './BugReportModal';
import { Newspaper, LogIn, User as UserIcon, Shield, Radio, Bell, Search, Calendar, Trophy, Bug, Lock, MessageSquare, Bookmark, Users } from 'lucide-react';

import { useChatAccess } from '../hooks/useChatAccess';
import { useChatUnreadState } from '../hooks/useChatUnreadState';
import { getMyChannels } from '../services/channelService';
import type { Channel } from '../types/chat';

export const Navbar: React.FC = () => {
  const { currentUser } = useAuth();
  const { isEligible: isChatEligible } = useChatAccess();
  const [myChannels, setMyChannels] = useState<Channel[]>([]);
  const { totalUnreadCount } = useChatUnreadState(myChannels);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setMyChannels([]);
      return;
    }
    getMyChannels(currentUser.uid)
      .then((ch) => setMyChannels(ch))
      .catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }

    const unsubscribe = subscribeToNotifications(currentUser.uid, (items) => {
      const count = items.filter((item) => !item.read).length;
      setUnreadCount(count);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
    }`;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-800/80 px-4 py-3 relative">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform duration-200">
            <Newspaper className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-white via-slate-100 to-sky-400 bg-clip-text text-transparent">
              AKGEC TIMES
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Campus Feed
            </span>
          </div>
        </NavLink>

        <nav className="flex items-center gap-1 sm:gap-2">
          <NavLink to="/" className={linkClass}>
            <Newspaper className="w-4 h-4" />
            <span className="hidden sm:inline">Feed</span>
          </NavLink>

          <NavLink to="/lost-found" className={linkClass}>
            <Search className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Lost & Found</span>
          </NavLink>

          <NavLink to="/events" className={linkClass}>
            <Calendar className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">Events</span>
          </NavLink>

          {isChatEligible && (
            <NavLink to="/channels" className={linkClass}>
              <div className="relative flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <span className="hidden sm:inline">Channels</span>
                {totalUnreadCount > 0 && (
                  <span 
                    aria-label={`${totalUnreadCount} total unread chat messages`}
                    className="px-1.5 py-0.5 rounded-full bg-sky-500 text-white font-mono text-[9px] font-bold animate-pulse shadow-md shadow-sky-500/50 shrink-0"
                  >
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </div>
            </NavLink>
          )}

          <NavLink to="/leaderboard" className={linkClass}>
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Leaderboard</span>
          </NavLink>

          {currentUser && (
            <NavLink to="/groups" className={linkClass} title="Campus Groups">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Groups</span>
            </NavLink>
          )}

          {currentUser && (
            <NavLink to="/saved-messages" className={linkClass} title="Saved Messages">
              <Bookmark className="w-4 h-4 text-amber-400" />
              <span className="hidden lg:inline">Saved</span>
            </NavLink>
          )}

          {/* Notification Center NavLink & Tray Button */}
          {currentUser && (
            <div className="flex items-center gap-1">
              <NavLink to="/notifications" className={linkClass} title="Notification Center">
                <div className="relative flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-sky-400" />
                  <span className="hidden sm:inline">Alerts</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-sky-500 text-white font-mono text-[9px] font-bold animate-pulse shadow-md shrink-0">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
              </NavLink>

              <button
                onClick={() => {
                  if (!isTrayOpen) setUnreadCount(0);
                  setIsTrayOpen(!isTrayOpen);
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
                title="Quick Notification Tray"
              >
                <Bell className="w-4 h-4" />
              </button>
            </div>
          )}

          {!currentUser && (
            <NavLink to="/login" className={linkClass}>
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Login</span>
            </NavLink>
          )}

          {/* Bug Report & Privacy Buttons */}
          {currentUser && (
            <button
              onClick={() => setIsBugModalOpen(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 transition-all"
              title="Report a Bug"
            >
              <Bug className="w-4 h-4" />
            </button>
          )}

          <NavLink to="/privacy" className={linkClass} title="Privacy Policy">
            <Lock className="w-4 h-4 text-slate-400" />
            <span className="hidden xl:inline">Privacy</span>
          </NavLink>

          <NavLink to="/account" className={linkClass}>
            <UserIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Account</span>
          </NavLink>
          <NavLink to="/admin-portal" className={linkClass}>
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Admin</span>
          </NavLink>
        </nav>

        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/50 text-xs text-slate-300">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>asia-south1 (Mumbai)</span>
        </div>
      </div>

      {/* Notification Dropdown Tray */}
      <NotificationTray isOpen={isTrayOpen} onClose={() => setIsTrayOpen(false)} />

      {/* Bug Report Modal */}
      <BugReportModal isOpen={isBugModalOpen} onClose={() => setIsBugModalOpen(false)} />
    </header>
  );
};
