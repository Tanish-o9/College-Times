import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getSavedMessages, unsaveMessage } from '../../services/savedMessageService';
import type { SavedChatMessage } from '../../types/chat';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { formatTimestamp } from '../../utils/format';
import { 
  Bookmark, 
  ExternalLink, 
  Search, 
  RefreshCw, 
  FileText, 
  Image as ImageIcon, 
  MessageSquare, 
  Trash2,
  ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

export const SavedMessagesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [savedItems, setSavedItems] = useState<SavedChatMessage[]>([]);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // Filter & Search State
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'text' | 'image' | 'file'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchInitialSavedMessages = async () => {
    if (!currentUser) return;
    setLoadingInitial(true);
    setError(null);

    try {
      const res = await getSavedMessages(currentUser.uid, 20, null);
      setSavedItems(res.items);
      setLastDoc(res.lastDocSnapshot);
      setHasMore(res.hasMore);
    } catch (err: any) {
      setError(err.message || 'Failed to load saved messages.');
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    fetchInitialSavedMessages();
  }, [currentUser]);

  const handleLoadMore = async () => {
    if (!currentUser || !lastDoc || loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const res = await getSavedMessages(currentUser.uid, 20, lastDoc);
      setSavedItems((prev) => [...prev, ...res.items]);
      setLastDoc(res.lastDocSnapshot);
      setHasMore(res.hasMore);
    } catch (err: any) {
      toast.error('Failed to load more saved messages.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRemoveBookmark = async (item: SavedChatMessage) => {
    if (!currentUser) return;

    // Optimistic UI Removal
    const previousList = [...savedItems];
    setSavedItems((prev) => prev.filter((i) => i.messageId !== item.messageId));

    try {
      await unsaveMessage(currentUser.uid, item.messageId, item.channelId, item.messageType);
      toast.success('Bookmark removed.', { id: `unsave-${item.messageId}` });
    } catch (err: any) {
      // Rollback on error
      setSavedItems(previousList);
      toast.error("Couldn't remove saved message. Please try again.");
    }
  };

  const handleNavigateToMessage = (channelId: string, messageId: string) => {
    navigate(`/chat/${channelId}?msgId=${messageId}`);
  };

  const filteredItems = savedItems.filter((item) => {
    if (selectedTypeFilter !== 'all' && item.messageType !== selectedTypeFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = (item.previewText || '').toLowerCase();
      const matchSender = (item.senderName || '').toLowerCase();
      const matchChannel = (item.channelId || '').toLowerCase();
      return matchText.includes(q) || matchSender.includes(q) || matchChannel.includes(q);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
              <Bookmark className="w-5 h-5 text-amber-400 fill-amber-400/20" />
              <span>Saved Messages</span>
            </h1>
            <p className="text-[11px] text-slate-400">Your bookmarked chat messages & files</p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* Search & Type Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved messages..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none transition-all"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            {(['all', 'text', 'image', 'file'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedTypeFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  selectedTypeFilter === type
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Loading Skeleton */}
        {loadingInitial && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl animate-pulse space-y-2">
                <div className="h-4 bg-slate-800 rounded w-1/4" />
                <div className="h-3 bg-slate-800/60 rounded w-3/4" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loadingInitial && (
          <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-center space-y-3">
            <p className="text-xs text-rose-300">{error}</p>
            <button
              onClick={fetchInitialSavedMessages}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-bold transition-all"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loadingInitial && !error && filteredItems.length === 0 && (
          <div className="p-12 border border-slate-800/80 rounded-3xl bg-slate-900/30 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Bookmark className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-sm">
              {searchQuery || selectedTypeFilter !== 'all' ? 'No matching saved messages' : 'Your saved messages will appear here.'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Bookmark important messages in any community channel to quickly find them later.
            </p>
          </div>
        )}

        {/* Saved Items List */}
        {!loadingInitial && !error && filteredItems.length > 0 && (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div
                key={item.messageId}
                className="p-4 bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all space-y-2.5 group"
              >
                {/* Item Top Bar */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-md font-mono text-[10px] font-bold truncate">
                      #{item.channelId}
                    </span>
                    <span className="font-semibold text-slate-200 truncate">{item.senderName}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">
                    {formatTimestamp(item.savedAt)}
                  </span>
                </div>

                {/* Preview Card */}
                <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center gap-2.5 text-xs text-slate-300">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center shrink-0">
                    {item.messageType === 'file' ? (
                      <FileText className="w-4 h-4 text-rose-400" />
                    ) : item.messageType === 'image' ? (
                      <ImageIcon className="w-4 h-4 text-sky-400" />
                    ) : (
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <p className="min-w-0 truncate italic flex-1">{item.previewText}</p>
                </div>

                {/* Item Action Footer */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => handleRemoveBookmark(item)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 text-xs flex items-center gap-1.5 transition-colors"
                    title="Remove from saved messages"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Remove</span>
                  </button>

                  <button
                    onClick={() => handleNavigateToMessage(item.channelId, item.messageId)}
                    className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-500/20 flex items-center gap-1.5 transition-all"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* Pagination Load More Button */}
            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-2xl text-xs font-bold transition-all inline-flex items-center gap-2"
                >
                  {loadingMore && <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />}
                  <span>Load More Saved Messages</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
