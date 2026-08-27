import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  searchChannelMessages, 
  searchMyAccessibleMessages, 
  normalizeSearchQuery,
  type SearchResult 
} from '../../services/chatSearchService';
import { getMyChannels } from '../../services/channelService';
import type { ChatMessage, Channel } from '../../types/chat';
import { formatTimestamp } from '../../utils/format';
import { logAnalyticsEvent } from '../../lib/firebase';
import { 
  Search, 
  X, 
  Calendar, 
  Hash, 
  User, 
  Image as ImageIcon, 
  MessageSquare, 
  RefreshCw, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';

interface ChatSearchProps {
  currentChannelId?: string;
  onClose?: () => void;
  onSelectResult?: (message: ChatMessage) => void;
}

export const ChatSearch: React.FC<ChatSearchProps> = ({
  currentChannelId,
  onClose,
  onSelectResult,
}) => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [rawQuery, setRawQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [selectedChannelId, setSelectedChannelId] = useState<string>(currentChannelId || '');

  const [joinedChannels, setJoinedChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Fetch joined channels on mount
  useEffect(() => {
    if (!currentUser?.uid) return;
    getMyChannels(currentUser.uid)
      .then((channels) => setJoinedChannels(channels))
      .catch((err) => console.error('Error loading channels for search:', err));
  }, [currentUser?.uid]);

  // Debounce search query input (400ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(rawQuery);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [rawQuery]);

  // Calculate Date Filters
  const getDateRange = useCallback(() => {
    if (dateFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { startDate: today };
    }
    if (dateFilter === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { startDate: d };
    }
    if (dateFilter === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { startDate: d };
    }
    return {};
  }, [dateFilter]);

  // Execute Search
  const executeSearch = useCallback(async () => {
    const q = normalizeSearchQuery(debouncedQuery);
    if (!q || q.length < 2) {
      setMessages([]);
      setLastDoc(null);
      setHasMore(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { startDate } = getDateRange();
    const isAdmin = userProfile?.role === 'admin';
    const joinedIds = joinedChannels.map((c) => c.id!).filter(Boolean);

    try {
      let result: SearchResult;

      if (scope === 'current' && selectedChannelId) {
        result = await searchChannelMessages({
          channelId: selectedChannelId,
          queryText: q,
          startDate,
          pageSize: 20,
          isAdmin,
        });
      } else {
        result = await searchMyAccessibleMessages({
          joinedChannelIds: joinedIds,
          channelId: selectedChannelId || undefined,
          queryText: q,
          startDate,
          pageSize: 20,
          isAdmin,
        });
      }

      setMessages(result.messages);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (err: any) {
      console.error('Search failed:', err);
      setError('Search failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, scope, selectedChannelId, dateFilter, joinedChannels, userProfile?.role, getDateRange]);

  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  // Load More Results (Pagination)
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    setLoadingMore(true);
    const q = normalizeSearchQuery(debouncedQuery);
    const { startDate } = getDateRange();
    const isAdmin = userProfile?.role === 'admin';
    const joinedIds = joinedChannels.map((c) => c.id!).filter(Boolean);

    try {
      let result: SearchResult;
      if (scope === 'current' && selectedChannelId) {
        result = await searchChannelMessages({
          channelId: selectedChannelId,
          queryText: q,
          startDate,
          pageSize: 20,
          cursor: lastDoc,
          isAdmin,
        });
      } else {
        result = await searchMyAccessibleMessages({
          joinedChannelIds: joinedIds,
          channelId: selectedChannelId || undefined,
          queryText: q,
          startDate,
          pageSize: 20,
          cursor: lastDoc,
          isAdmin,
        });
      }

      setMessages((prev) => [...prev, ...result.messages]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (err: any) {
      console.error('Load more search failed:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Handle Result Click
  const handleResultClick = (msg: ChatMessage, index: number) => {
    logAnalyticsEvent('chat_search_result_opened', {
      channelId: msg.channelId,
      resultPosition: index + 1,
    });

    if (onSelectResult) {
      onSelectResult(msg);
    } else {
      navigate(`/chat/${msg.channelId}?msgId=${msg.id}`);
    }

    if (onClose) onClose();
  };

  // Safe React Text Segmentation & Highlighting (NO dangerouslySetInnerHTML)
  const renderHighlightedContent = (content: string, queryText: string) => {
    if (!queryText || queryText.length < 2) return <span>{content}</span>;

    const lowerContent = content.toLowerCase();
    const lowerQuery = queryText.toLowerCase();
    const parts: React.ReactNode[] = [];
    let start = 0;

    let index = lowerContent.indexOf(lowerQuery, start);
    while (index !== -1) {
      // Non-matching text before
      if (index > start) {
        parts.push(content.slice(start, index));
      }
      // Matching text segment
      const matchText = content.slice(index, index + lowerQuery.length);
      parts.push(
        <mark key={index} className="bg-amber-400/30 text-amber-200 font-semibold px-0.5 rounded">
          {matchText}
        </mark>
      );
      start = index + lowerQuery.length;
      index = lowerContent.indexOf(lowerQuery, start);
    }

    if (start < content.length) {
      parts.push(content.slice(start));
    }

    return <>{parts}</>;
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
      {/* Top Header & Search Bar */}
      <div className="p-4 sm:p-6 bg-slate-950/80 border-b border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-white">Search Community Chat</h2>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              title="Close Search"
              aria-label="Close search overlay"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Input Box */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Type at least 2 characters to search messages..."
            aria-label="Search messages input"
            className="w-full pl-11 pr-10 py-3 bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-2xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-500"
          />
          {rawQuery && (
            <button
              onClick={() => setRawQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
              title="Clear Search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Scope Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setScope('current')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                scope === 'current'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Current Channel
            </button>
            <button
              onClick={() => setScope('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                scope === 'all'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Joined Channels
            </button>
          </div>

          {/* Channel Selector Filter */}
          {joinedChannels.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-300">
              <Hash className="w-3.5 h-3.5 text-sky-400" />
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                aria-label="Filter search by specific channel"
                className="bg-transparent text-xs text-slate-200 font-semibold focus:outline-none cursor-pointer max-w-[140px] truncate"
              >
                <option value="" className="bg-slate-900 text-white">All Channels</option>
                {joinedChannels.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    #{c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
            <select
              value={dateFilter}
              onChange={(e: any) => setDateFilter(e.target.value)}
              aria-label="Filter search by date range"
              className="bg-transparent text-xs text-slate-200 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Time</option>
              <option value="today" className="bg-slate-900 text-white">Today</option>
              <option value="7days" className="bg-slate-900 text-white">Last 7 Days</option>
              <option value="30days" className="bg-slate-900 text-white">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Search Results Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
        {/* Helper State: Under 2 Chars */}
        {!loading && normalizeSearchQuery(debouncedQuery).length < 2 && (
          <div className="text-center py-12 space-y-3">
            <Search className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">Search Community Chat Messages</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Type at least 2 characters to search across topics, discussions, and shared campus notes.
            </p>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="text-center py-12 space-y-3">
            <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Searching messages...</p>
          </div>
        )}

        {/* Error View */}
        {error && !loading && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center text-rose-300 text-xs flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty Results View */}
        {!loading && !error && normalizeSearchQuery(debouncedQuery).length >= 2 && messages.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-white">No matching messages found</p>
            <p className="text-xs text-slate-400">
              Try adjusting your search query or filters.
            </p>
          </div>
        )}

        {/* Result Cards */}
        {!loading && !error && messages.length > 0 && (
          messages.map((msg, index) => (
            <div
              key={msg.id || index}
              onClick={() => handleResultClick(msg, index)}
              className="p-4 bg-slate-950/80 border border-slate-800 hover:border-sky-500/40 rounded-2xl transition-all cursor-pointer space-y-2 group"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="font-bold text-white truncate">{msg.senderName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                    {msg.senderRole}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 shrink-0">
                  <Hash className="w-3 h-3 text-purple-400" />
                  <span>{msg.channelId}</span>
                  <span>•</span>
                  <span>{formatTimestamp(msg.createdAt)}</span>
                </div>
              </div>

              {/* Message Content Preview with Match Highlighting */}
              <p className="text-xs text-slate-300 leading-relaxed font-sans line-clamp-3">
                {renderHighlightedContent(msg.content, debouncedQuery)}
              </p>

              {/* Attachments & Indicators */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <div className="flex items-center gap-3">
                  {msg.imageUrl && (
                    <span className="flex items-center gap-1 text-sky-400">
                      <ImageIcon className="w-3 h-3" />
                      <span>Image</span>
                    </span>
                  )}
                  {msg.replyToMessageId && (
                    <span className="flex items-center gap-1 text-purple-400">
                      <MessageSquare className="w-3 h-3" />
                      <span>Reply</span>
                    </span>
                  )}
                </div>

                <span className="group-hover:text-sky-400 flex items-center gap-1 font-semibold transition-colors">
                  <span>Jump to message</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))
        )}

        {/* Load More Button */}
        {hasMore && !loading && (
          <div className="text-center pt-3 pb-2">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 mx-auto transition-all"
            >
              {loadingMore ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>{loadingMore ? 'Loading more...' : 'Load More Search Results'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
