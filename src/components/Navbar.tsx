import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useGlobalCache } from '../context/GlobalCacheContext';
import { subscribeToActivityState } from '../services/activityStateService';
import { searchUnifiedCampus } from '../services/searchService';
import type { SearchSuggestion } from '../types/search';
import { SearchSuggestions } from '../features/search/SearchSuggestions';
import { NotificationTray } from './NotificationTray';
import { BugReportModal } from './BugReportModal';
import {
  Compass,
  Newspaper,
  LogIn,
  User as UserIcon,
  Bell,
  Search,
  Calendar,
  Bug,
  MessageSquare,
  Bookmark,
  Users,
  X,
  Settings,
  Activity,
  Menu,
} from 'lucide-react';

import { useChatAccess } from '../hooks/useChatAccess';
import { useChatUnreadState } from '../hooks/useChatUnreadState';
import { getMyChannels } from '../services/channelService';
import type { Channel } from '../types/chat';

export const Navbar: React.FC = () => {
  const { currentUser } = useAuth();
  const { joinedGroupIds } = useGlobalCache();
  const navigate = useNavigate();
  const { isEligible: isChatEligible } = useChatAccess();
  const [myChannels, setMyChannels] = useState<Channel[]>([]);
  const { totalUnreadCount } = useChatUnreadState(myChannels);
  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global Navbar Search State
  const [navSearchQuery, setNavSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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
      setNotificationsUnread(0);
      setMessagesUnread(0);
      return;
    }

    const unsubNotifs = subscribeToActivityState(currentUser.uid, 'notifications', (state) => {
      setNotificationsUnread(state.unreadCount);
    });

    const unsubMessages = subscribeToActivityState(currentUser.uid, 'messages', (state) => {
      setMessagesUnread(state.unreadCount);
    });

    return () => {
      unsubNotifs();
      unsubMessages();
    };
  }, [currentUser]);

  // Ctrl+K / Cmd+K Keyboard Shortcut Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        } else {
          navigate('/search');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  useEffect(() => {
    if (!navSearchQuery.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchUnifiedCampus(navSearchQuery, 'all', 10, currentUser, joinedGroupIds);
        setSuggestions(results.suggestions);
        setShowSuggestions(results.suggestions.length > 0);
      } catch (err) {
        console.error('Navbar search error:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [navSearchQuery, currentUser, joinedGroupIds]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
      isActive
        ? 'bg-sky-500/15 text-sky-400 font-bold border border-sky-500/30 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
        : 'text-slate-400 hover:text-white hover:bg-slate-800/60 hover:-translate-y-0.5'
    }`;

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
      isActive
        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold'
        : 'text-slate-300 hover:bg-slate-800/60'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 shadow-lg">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <NavLink to="/" className="flex items-center gap-2 font-black text-base text-white tracking-tight shrink-0 hover:scale-105 transition-transform duration-200">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-500 p-0.5 shadow-md shadow-sky-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-sky-400">
              <Compass className="w-4 h-4 animate-spin-slow" />
            </div>
          </div>
          <span className="hidden xs:inline bg-gradient-to-r from-white via-slate-200 to-sky-400 bg-clip-text text-transparent">
            College Times
          </span>
        </NavLink>

        {/* Global Desktop Search Input */}
        <div ref={searchContainerRef} className="relative hidden md:block flex-1 max-w-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (navSearchQuery.trim()) {
                setShowSuggestions(false);
                navigate(`/search?q=${encodeURIComponent(navSearchQuery.trim())}`);
              }
            }}
            className="relative"
          >
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={navSearchQuery}
              onChange={(e) => setNavSearchQuery(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Search feed, groups, events... (Ctrl+K)"
              className="w-full pl-9 pr-8 py-1.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
            />
            {navSearchQuery ? (
              <button
                type="button"
                onClick={() => setNavSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="absolute right-3 top-2 px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-[10px] text-slate-500 font-mono rounded">
                Ctrl+K
              </span>
            )}
          </form>

          {showSuggestions && (
            <SearchSuggestions
              suggestions={suggestions}
              query={navSearchQuery}
              onSelect={(url) => {
                setShowSuggestions(false);
                setNavSearchQuery('');
                navigate(url);
              }}
              onViewAll={() => {
                setShowSuggestions(false);
                navigate(`/search?q=${encodeURIComponent(navSearchQuery.trim())}`);
              }}
            />
          )}
        </div>

        {/* Navigation Items (Desktop) */}
        <nav className="hidden lg:flex items-center gap-1 sm:gap-2 shrink-0">
          <NavLink to="/" className={linkClass}>
            <Newspaper className="w-4 h-4" />
            <span>Feed</span>
          </NavLink>

          <NavLink to="/discover" className={linkClass}>
            <Search className="w-4 h-4 text-emerald-400" />
            <span>Discover</span>
          </NavLink>

          <NavLink to="/groups" className={linkClass}>
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Groups</span>
          </NavLink>

          <NavLink to="/events" className={linkClass}>
            <Calendar className="w-4 h-4 text-purple-400" />
            <span>Events</span>
          </NavLink>

          <NavLink to="/activity" className={linkClass}>
            <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
            <span>Activity</span>
          </NavLink>

          {isChatEligible && (
            <NavLink to="/channels" className={linkClass}>
              <div className="relative flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <span>Channels</span>
                {totalUnreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-sky-500 text-white font-mono text-[9px] font-bold animate-pulse shadow-md shrink-0">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </div>
            </NavLink>
          )}

          {currentUser && (
            <NavLink to="/messages" className={linkClass}>
              <div className="relative flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-pink-400" />
                <span>DMs</span>
                {messagesUnread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-pink-500 text-white font-mono text-[9px] font-bold animate-pulse shrink-0">
                    {messagesUnread}
                  </span>
                )}
              </div>
            </NavLink>
          )}

          <NavLink to="/saved" className={linkClass}>
            <Bookmark className="w-4 h-4 text-amber-400" />
            <span>Saved</span>
          </NavLink>

          <button
            onClick={() => setIsBugModalOpen(true)}
            className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800/60 transition-colors"
            title="Report a Bug"
          >
            <Bug className="w-4 h-4" />
          </button>

          {currentUser ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="relative">
                <button
                  onClick={() => setIsTrayOpen(!isTrayOpen)}
                  className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/60 transition-colors relative"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4 text-sky-400" />
                  {notificationsUnread > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-sky-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
                  )}
                </button>

                <NotificationTray isOpen={isTrayOpen} onClose={() => setIsTrayOpen(false)} />
              </div>

              <NavLink
                to="/account"
                className="flex items-center gap-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
              >
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 font-bold text-xs flex items-center justify-center border border-sky-500/30">
                  {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : <UserIcon className="w-4 h-4" />}
                </div>
              </NavLink>
              
              <NavLink
                to="/settings"
                className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/60 transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </NavLink>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-sky-500/20 ml-2"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login</span>
            </NavLink>
          )}
        </nav>

        {/* Mobile Header Quick Actions */}
        <div className="flex lg:hidden items-center gap-1">
          <NavLink to="/search" className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60">
            <Search className="w-5 h-5 text-sky-400" />
          </NavLink>

          {currentUser && (
            <div className="relative">
              <button
                onClick={() => setIsTrayOpen(!isTrayOpen)}
                className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/60 relative"
              >
                <Bell className="w-5 h-5 text-sky-400" />
                {notificationsUnread > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-sky-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
                )}
              </button>

              <NotificationTray isOpen={isTrayOpen} onClose={() => setIsTrayOpen(false)} />
            </div>
          )}

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/60"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6 text-sky-400" /> : <Menu className="w-6 h-6 text-slate-200" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-xl p-4 space-y-2 animate-in slide-in-from-top-4 duration-200 shadow-2xl">
          <NavLink to="/" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkClass}>
            <Newspaper className="w-5 h-5 text-sky-400" />
            <span>Campus Feed</span>
          </NavLink>

          <NavLink to="/discover" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkClass}>
            <Search className="w-5 h-5 text-emerald-400" />
            <span>Discover & Search</span>
          </NavLink>

          <NavLink to="/groups" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkClass}>
            <Users className="w-5 h-5 text-indigo-400" />
            <span>Groups & Clubs</span>
          </NavLink>

          <NavLink to="/events" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkClass}>
            <Calendar className="w-5 h-5 text-purple-400" />
            <span>Campus Events</span>
          </NavLink>

          <NavLink to="/activity" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkClass}>
            <Activity className="w-5 h-5 text-sky-400 animate-pulse" />
            <span>Activity Center</span>
          </NavLink>

          {isChatEligible && (
            <NavLink to="/channels" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkClass}>
              <MessageSquare className="w-5 h-5 text-sky-400" />
              <span>Group Channels</span>
            </NavLink>
          )}

          {currentUser && (
            <NavLink to="/messages" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkClass}>
              <MessageSquare className="w-5 h-5 text-pink-400" />
              <span>Direct Messages</span>
            </NavLink>
          )}

          <NavLink to="/saved" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkClass}>
            <Bookmark className="w-5 h-5 text-amber-400" />
            <span>Saved Items</span>
          </NavLink>

          {currentUser ? (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between px-2">
              <NavLink
                to="/account"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 text-sm font-bold text-slate-200"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                  {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : <UserIcon className="w-4 h-4" />}
                </div>
                <span>{currentUser.displayName || 'Profile Account'}</span>
              </NavLink>

              <NavLink
                to="/settings"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-white bg-slate-900 rounded-lg border border-slate-800"
              >
                <Settings className="w-4 h-4" />
              </NavLink>
            </div>
          ) : (
            <NavLink
              to="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-3 bg-sky-500 text-slate-950 font-bold text-sm rounded-xl"
            >
              <LogIn className="w-4 h-4" />
              <span>Login to Campus Account</span>
            </NavLink>
          )}
        </div>
      )}

      <BugReportModal isOpen={isBugModalOpen} onClose={() => setIsBugModalOpen(false)} />
    </header>
  );
};
