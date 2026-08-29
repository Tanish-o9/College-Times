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
  Activity
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

  // Phase 36: Global Navbar Search State
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

  // Phase 36: Ctrl+K / Cmd+K Keyboard Shortcut Listener
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

  // Phase 36: Debounced Search Suggestions Trigger
  useEffect(() => {
    const clean = navSearchQuery.trim();
    if (!clean || clean.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await searchUnifiedCampus(clean, 'all', 10, currentUser, joinedGroupIds);
        setSuggestions(res.suggestions);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [navSearchQuery, currentUser, joinedGroupIds]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (navSearchQuery.trim()) {
      setShowSuggestions(false);
      navigate(`/search?q=${encodeURIComponent(navSearchQuery.trim())}`);
    }
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
    }`;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-800/80 px-4 py-3 relative">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <NavLink to="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform duration-200">
            <Compass className="w-5 h-5 text-white animate-[spin_10s_linear_infinite]" />
          </div>
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-white via-slate-100 to-sky-400 bg-clip-text text-transparent">
              COLLEGE TIMES
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Campus Feed
            </span>
          </div>
        </NavLink>

        {/* Phase 36: Global Navbar Search Bar (Desktop) */}
        <div ref={searchContainerRef} className="hidden md:block flex-1 max-w-md relative">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={navSearchQuery}
              onChange={(e) => setNavSearchQuery(e.target.value)}
              onFocus={() => navSearchQuery.trim().length >= 2 && setShowSuggestions(true)}
              placeholder="Search campus, students, groups... (Ctrl+K)"
              className="w-full bg-slate-950/80 border border-slate-800/90 rounded-2xl pl-10 pr-16 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 shadow-inner"
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

          {/* Search Suggestions Popover */}
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

        {/* Navigation Items */}
        <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Mobile Search Icon */}
          <NavLink to="/search" className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors">
            <Search className="w-5 h-5 text-sky-400" />
          </NavLink>

          <NavLink to="/" className={linkClass}>
            <Newspaper className="w-4 h-4" />
            <span className="hidden sm:inline">Feed</span>
          </NavLink>

          <NavLink to="/discover" className={linkClass}>
            <Search className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Discover</span>
          </NavLink>

          <NavLink to="/groups" className={linkClass}>
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Groups</span>
          </NavLink>

          <NavLink to="/events" className={linkClass}>
            <Calendar className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">Events</span>
          </NavLink>

          <NavLink to="/activity" className={linkClass}>
            <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
            <span className="hidden sm:inline">Activity</span>
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

          {currentUser && (
            <NavLink to="/messages" className={linkClass}>
              <div className="relative flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-pink-400" />
                <span className="hidden sm:inline">DMs</span>
                {messagesUnread > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full bg-pink-500 text-white font-mono text-[9px] font-bold animate-pulse shrink-0"
                  >
                    {messagesUnread}
                  </span>
                )}
              </div>
            </NavLink>
          )}

          <NavLink to="/saved" className={linkClass}>
            <Bookmark className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Saved</span>
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
              {/* Notification Bell Icon */}
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

                <NotificationTray
                  isOpen={isTrayOpen}
                  onClose={() => setIsTrayOpen(false)}
                />
              </div>

              <NavLink
                to="/account"
                className="flex items-center gap-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all duration-200"
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
      </div>

      <BugReportModal
        isOpen={isBugModalOpen}
        onClose={() => setIsBugModalOpen(false)}
      />
    </header>
  );
};
