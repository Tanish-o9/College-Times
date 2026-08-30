import React, { useEffect, useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { Post } from '../../types';
import type { FeedMode } from '../../types/feed';
import { getPostsPage } from '../../services/postService';
import { getForYouFeed, getFollowingFeed } from '../../services/feedPersonalizationService';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { StoryBar } from '../stories/StoryBar';
import { PostCard } from './PostCard';
import { CreatePostModal } from './CreatePostModal';
import { TrendingPosts } from './TrendingPosts';
import { FeedPreferencesModal } from './FeedPreferencesModal';
import { FAB } from '../../components/FAB';
import { useIsVisible } from '../../hooks/useIsVisible';
import { Skeleton } from '../../components/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useScrollRestoration } from '../../hooks/useScrollRestoration';
import { 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  Inbox, 
  Filter,
  Info,
  Calendar,
  AlertTriangle,
  Search,
  CheckCircle2,
  Flame,
  Sliders,
  Star,
  Bookmark,
  Users,
  Lock,
  PlusCircle,
} from 'lucide-react';

import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type CategoryFilter = 'All' | 'General' | 'Event' | 'Mishap' | 'LostFound';

export const Feed: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const targetPostId = searchParams.get('postId');

  const [posts, setPosts] = useState<Post[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useScrollRestoration('feed', !loadingInitial);

  const [feedMode, setFeedMode] = useState<FeedMode>('latest');
  const [isPrefModalOpen, setIsPrefModalOpen] = useState<boolean>(false);

  const [pendingRecentPosts, setPendingRecentPosts] = useState<Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Phase 11 & 26: Intersection Observer Sentinel Hook
  const [sentinelRef, isSentinelVisible] = useIsVisible<HTMLDivElement>({ threshold: 0.5 });

  // Ref to the scroll container for programmatic scroll-to-top
  const feedScrollRef = useRef<HTMLDivElement>(null);

  // Keep a stable ref of current post IDs so the realtime listener doesn't need posts in deps
  const postIdsRef = useRef<Set<string>>(new Set());


  // Keep postIdsRef in sync with posts so the stable realtime listener can deduplicate
  useEffect(() => {
    postIdsRef.current = new Set(posts.map((p) => p.id).filter(Boolean) as string[]);
  }, [posts]);

  // Bounded Realtime Listener — auto-merges new posts at the top (limit 5, no pill needed)
  useEffect(() => {
    if (!currentUser) return; // Wait until authenticated to avoid permission errors
    const postsRef = collection(db, 'posts');
    // Order by timestamp desc only to avoid composite index requirements
    const q = query(
      postsRef,
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Filter in-memory to only include active posts
      const recent = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Post) }))
        .filter((p) => p.status === 'active');
      // Use stable ref — no stale closure issue, no listener recreation
      const newPosts = recent.filter((r) => r.id && !postIdsRef.current.has(r.id));
      if (newPosts.length > 0) {
        // Auto-merge directly into the top of the feed — no pill needed
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const toAdd = newPosts.filter((p) => !existingIds.has(p.id!));
          if (toAdd.length === 0) return prev;
          return [...toAdd, ...prev];
        });
        // Only scroll to top if user is near the top (within 200px)
        if ((feedScrollRef.current?.scrollTop ?? 0) < 200) {
          requestAnimationFrame(() => {
            feedScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          });
        } else {
          // Show pill for users further down the feed
          setPendingRecentPosts((prev) => [
            ...newPosts.filter((p) => !prev.some((x) => x.id === p.id)),
            ...prev,
          ]);
        }
      }
    }, (err) => console.error('Feed listener error:', err));

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]); // Stable — re-run when auth resolves



  const mergeNewPosts = () => {
    if (pendingRecentPosts.length === 0) return;
    setPosts((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const filtered = pendingRecentPosts.filter((p) => p.id && !existingIds.has(p.id));
      return [...filtered, ...prev];
    });
    setPendingRecentPosts([]);
    requestAnimationFrame(() => {
      feedScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  // Handle deep-linked target postId navigation
  useEffect(() => {
    if (!targetPostId || loadingInitial) return;

    let isSubscribed = true;

    const handleDeepLink = async () => {
      let target = posts.find((p) => p.id === targetPostId);

      if (!target) {
        try {
          const snap = await getDoc(doc(db, 'posts', targetPostId));
          if (snap.exists() && isSubscribed) {
            const data = snap.data();
            if (data.status === 'deleted' || data.status === 'hidden') {
              toast.error('This campus update is no longer available.', { id: 'deeplink-unavailable' });
              return;
            }
            target = { id: snap.id, ...(data as Post) };
            setPosts((prev) => [target!, ...prev.filter((p) => p.id !== targetPostId)]);
          } else if (!snap.exists() && isSubscribed) {
            toast.error('This campus update is no longer available.', { id: 'deeplink-unavailable' });
            return;
          }
        } catch (err) {
          toast.error('This campus update is no longer available.', { id: 'deeplink-unavailable' });
        }
      }

      setTimeout(() => {
        const elem = document.getElementById(`post-${targetPostId}`);
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          elem.classList.add('ring-4', 'ring-sky-500', 'ring-offset-2', 'ring-offset-slate-950');
          setTimeout(() => {
            if (elem) {
              elem.classList.remove('ring-4', 'ring-sky-500', 'ring-offset-2', 'ring-offset-slate-950');
            }
          }, 3000);
        }
      }, 400);
    };

    handleDeepLink();

    return () => {
      isSubscribed = false;
    };
  }, [targetPostId, loadingInitial]);

  // Initial / Mode reset fetch
  const fetchInitialPosts = async (mode: FeedMode = feedMode, cat: CategoryFilter = selectedCategory) => {
    setLoadingInitial(true);
    setError(null);
    setLastDoc(null);
    setHasMore(true);

    try {
      let targetCategory = cat;
      if (mode === 'events') targetCategory = 'Event';
      if (mode === 'lost_found') targetCategory = 'LostFound';

      let fetched: Post[] = [];

      if (mode === 'personalized') {
        // Use feedPersonalizationService for personalised For You feed
        fetched = await getForYouFeed(currentUser?.uid || '', 20);
        setHasMore(false); // Personalized feed is fully scored in one call
      } else if (mode === 'following') {
        // Use feedPersonalizationService for friends-only Following feed
        fetched = await getFollowingFeed(currentUser?.uid || '', 20);
        setHasMore(false);
      } else if (mode === 'saved') {
        const { getUserSavedPosts } = await import('../../services/postBookmarkService');
        const savedIds = await getUserSavedPosts(currentUser?.uid || '');
        if (savedIds.length > 0) {
          const docsPromise = savedIds.slice(0, 40).map((id) => getDoc(doc(db, 'posts', id)));
          const snaps = await Promise.all(docsPromise);
          fetched = snaps
            .filter((s) => s.exists())
            .map((s) => ({ id: s.id, ...(s.data() as Post) }))
            .filter((p) => p.status !== 'deleted' && p.status !== 'hidden' && p.status !== 'moderated');
        }
        setHasMore(false);
      } else {
        const result = await getPostsPage(20, targetCategory, null);
        fetched = result.posts;
        setLastDoc(result.lastDoc);
        if (result.posts.length < 20) {
          setHasMore(false);
        }
      }

      // Apply mode-specific transformations for standard modes
      if (mode === 'important') {
        fetched = fetched.filter((p) => p.isImportant || p.isOfficial);
      } else if (mode === 'trending') {
        const { getTrendingPosts } = await import('../../services/trendingService');
        fetched = await getTrendingPosts(20);
        setHasMore(false);
      } else if (mode === 'groups') {
        fetched = fetched.filter((p) => !!p.groupId);
      }

      setPosts(fetched);
    } catch (err: any) {
      console.error('Failed to load feed:', err);
      setError(err.message || 'Failed to load posts.');
    } finally {
      setLoadingInitial(false);
    }
  };

  // Fetch next page via cursor pagination
  const fetchNextPage = async () => {
    if (!hasMore || loadingMore || loadingInitial || !lastDoc || feedMode === 'saved') return;

    setLoadingMore(true);
    try {
      let targetCategory = selectedCategory;
      if (feedMode === 'events') targetCategory = 'Event';
      if (feedMode === 'lost_found') targetCategory = 'LostFound';

      const result = await getPostsPage(20, targetCategory, lastDoc);
      let nextBatch = result.posts;

      if (feedMode === 'important') {
        nextBatch = nextBatch.filter((p) => p.isImportant || p.isOfficial);
      }

      setPosts((prevPosts) => {
        const existingIds = new Set(prevPosts.map((p) => p.id));
        const newPosts = nextBatch.filter((p) => p.id && !existingIds.has(p.id));
        const combined = [...prevPosts, ...newPosts];

        if (feedMode === 'personalized') {
          const sorted = [...combined].sort((a, b) => ((b.likeCount || 0) + (b.commentCount || 0)) - ((a.likeCount || 0) + (a.commentCount || 0)));
          return sorted;
        }
        return combined;
      });

      setLastDoc(result.lastDoc);
      if (result.posts.length < 20) {
        setHasMore(false);
      }
    } catch (err: any) {
      console.error('Failed to load next page:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return; // Wait until authenticated to avoid permission errors
    fetchInitialPosts(feedMode, selectedCategory);
  }, [feedMode, selectedCategory, currentUser]);

  // Infinite Scroll Trigger on Sentinel Intersection
  useEffect(() => {
    if (isSentinelVisible && hasMore && !loadingMore && !loadingInitial) {
      fetchNextPage();
    }
  }, [isSentinelVisible, hasMore, loadingMore, loadingInitial]);

  const handleModeSelect = (mode: FeedMode) => {
    if (feedMode === mode) return;
    setFeedMode(mode);
  };

  const handlePostCreated = useCallback((newPost: Post & { _replaceOptimisticId?: string; _removeOptimisticId?: string }) => {
    if (newPost._removeOptimisticId) {
      // Remove failed optimistic post
      setPosts((prev) => prev.filter((p) => p.id !== newPost._removeOptimisticId));
      return;
    }
    if (newPost._replaceOptimisticId) {
      // Replace temp post with confirmed real post
      setPosts((prev) =>
        prev.map((p) => (p.id === newPost._replaceOptimisticId ? { ...newPost, _replaceOptimisticId: undefined } : p))
      );
      return;
    }
    // New optimistic post — prepend to top and scroll there
    setPosts((prev) => [newPost, ...prev]);
    setPendingRecentPosts([]);
    requestAnimationFrame(() => {
      feedScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);

  const feedModes: { mode: FeedMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'personalized', label: 'For You', icon: <Star className="w-3 h-3 text-amber-400" /> },
    { mode: 'following', label: 'Following', icon: <Sparkles className="w-3 h-3 text-sky-400" /> },
    { mode: 'trending', label: 'Trending', icon: <Flame className="w-3 h-3 text-amber-500" /> },
    { mode: 'groups', label: 'Groups', icon: <Users className="w-3 h-3 text-indigo-400" /> },
    { mode: 'saved', label: 'Saved', icon: <Bookmark className="w-3 h-3 text-amber-400" /> },
  ];

  const categories: { label: CategoryFilter; icon?: React.ReactNode }[] = [
    { label: 'All', icon: <Filter className="w-3 h-3" /> },
    { label: 'General', icon: <Info className="w-3 h-3" /> },
    { label: 'Event', icon: <Calendar className="w-3 h-3" /> },
    { label: 'Mishap', icon: <AlertTriangle className="w-3 h-3" /> },
    { label: 'LostFound', icon: <Search className="w-3 h-3" /> },
  ];

  return (
    <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-20">
      {/* Top Feed Header & Mode Bar */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-sky-500/10 via-purple-500/10 to-pink-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-purple-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center shadow-inner shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                Campus Live Feed
                <span className="px-2 py-0.5 text-[10px] font-mono font-extrabold uppercase rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  Realtime
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Discover posts, campus updates, and discussions in real-time.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 hover:from-sky-400 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all hover:scale-105 cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Post</span>
          </button>
        </div>

        {/* Mode Selector & Category Sub-Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-800/80 relative z-10">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {feedModes.map((item) => {
              const isSelected = feedMode === item.mode;
              return (
                <button
                  key={item.mode}
                  onClick={() => handleModeSelect(item.mode)}
                  className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md ${
                    isSelected
                      ? 'bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25 scale-105 border border-sky-300'
                      : 'bg-slate-950/80 text-slate-300 border border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            {(feedMode === 'latest' || feedMode === 'personalized') && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.label;
                  return (
                    <button
                      key={cat.label}
                      onClick={() => setSelectedCategory(cat.label)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 border ${
                        isSelected
                          ? 'bg-gradient-to-r from-sky-500/20 to-purple-500/20 text-sky-300 border-sky-400/50 shadow-md shadow-sky-500/20'
                          : 'bg-slate-950/70 border-slate-850 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat.icon}
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setIsPrefModalOpen(true)}
              className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-sky-400 rounded-xl border border-slate-800 transition-all text-xs flex items-center gap-1"
              title="Feed Preferences"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => fetchInitialPosts(feedMode, selectedCategory)}
              disabled={loadingInitial}
              className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all text-xs flex items-center gap-1"
              title="Refresh Feed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingInitial ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Floating New Posts Available Pill */}
      {pendingRecentPosts.length > 0 && (
        <div className="sticky top-20 z-40 flex justify-center pointer-events-none">
          <button
            onClick={mergeNewPosts}
            className="pointer-events-auto px-4 py-2 bg-sky-500 text-slate-950 font-bold text-xs rounded-full shadow-2xl flex items-center gap-2 border border-sky-300 animate-bounce hover:bg-sky-400 transition-all"
          >
            <Sparkles className="w-4 h-4 fill-slate-950 text-slate-950" />
            <span>{pendingRecentPosts.length} New Campus Post{pendingRecentPosts.length > 1 ? 's' : ''} Available — Click to View</span>
          </button>
        </div>
      )}

      {/* 3-Column Desktop Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Sidebar (Desktop Only) */}
        <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-20">
          {/* User Profile Mini Widget */}
          <div className="p-5 bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 rounded-3xl space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-extrabold text-sm flex items-center justify-center border border-sky-400/30 shadow-md shrink-0">
                {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
              </div>
              <div className="overflow-hidden">
                <h3 className="text-xs font-bold text-white truncate">{currentUser?.displayName || 'Campus Student'}</h3>
                <p className="text-[10px] text-slate-400 font-mono truncate">{currentUser?.email || 'Student'}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-center text-[10px] font-mono">
              <div className="p-2 bg-slate-950/80 rounded-xl border border-slate-800">
                <div className="text-sky-400 font-bold text-xs">{posts.length}</div>
                <div className="text-slate-500 uppercase">Posts Loaded</div>
              </div>
              <div className="p-2 bg-slate-950/80 rounded-xl border border-slate-800">
                <div className="text-emerald-400 font-bold text-xs">Live</div>
                <div className="text-slate-500 uppercase">Network</div>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="p-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 rounded-3xl space-y-2 shadow-xl text-xs font-semibold">
            <button
              onClick={() => navigate('/confessions')}
              className="w-full p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-300 flex items-center justify-between transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400" />
                <span>Campus Confessions</span>
              </div>
              <span className="text-[10px] font-mono text-purple-400 font-bold">100% Secret ↗</span>
            </button>

            <button
              onClick={() => navigate('/groups')}
              className="w-full p-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Campus Groups</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 font-bold">Explore</span>
            </button>

            <button
              onClick={() => navigate('/events')}
              className="w-full p-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Campus Events</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 font-bold">Calendar</span>
            </button>
          </div>
        </aside>

        {/* Center Main Feed */}
        <main className="col-span-12 lg:col-span-6 space-y-4">
          {/* Phase 32: Campus 24-Hour Stories Bar */}
          <StoryBar />

          {/* Quick Post Prompt Bar */}
          <div
            onClick={() => setIsModalOpen(true)}
            className="p-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 hover:border-sky-500/40 rounded-3xl flex items-center gap-3 cursor-pointer shadow-xl hover:shadow-sky-500/5 transition-all group"
          >
            <div className="w-9 h-9 rounded-2xl bg-sky-500/20 border border-sky-500/30 text-sky-400 font-bold text-xs flex items-center justify-center shrink-0">
              {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
            </div>
            <div className="flex-1 bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-2 text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
              What's happening on campus today? Post an update...
            </div>
            <button
              type="button"
              className="p-2 bg-sky-500 group-hover:bg-sky-400 text-slate-950 font-bold rounded-xl transition-all shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>

          {/* Error State */}
          {error && (
            <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-rose-300 text-sm text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="font-semibold">{error}</p>
              <button
                onClick={() => fetchInitialPosts(feedMode, selectedCategory)}
                className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-xl text-xs font-semibold"
              >
                Retry Fetching
              </button>
            </div>
          )}

          {/* Initial Loading Skeletons */}
          {loadingInitial && (
            <div className="w-full space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton variant="button" className="w-28" />
                    <Skeleton variant="text" className="w-20" />
                  </div>
                  <Skeleton variant="text" className="h-8 w-3/4" />
                  <div className="space-y-2">
                    <Skeleton variant="text" />
                    <Skeleton variant="text" className="w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loadingInitial && !error && posts.length === 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 text-center w-full shadow-2xl space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
                <Inbox className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">No {feedMode} Posts</h2>
                <p className="text-slate-400 text-xs mt-1">
                  Be the first to publish a post in this mode!
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-sky-500/20 inline-flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Create First Post</span>
              </button>
            </div>
          )}

          {/* Posts List with Infinite Scroll Sentinel */}
          {!loadingInitial && !error && posts.length > 0 && (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="w-full">
                  <PostCard post={post} />
                </div>
              ))}

              {/* Pagination Loading & Caught Up Footer */}
              <div ref={sentinelRef} className="py-8 flex flex-col items-center justify-center space-y-2">
                {loadingMore && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-full text-xs font-medium text-sky-400 shadow-xl">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading more posts...</span>
                  </div>
                )}

                {!hasMore && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-full text-xs font-semibold text-slate-400 shadow-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>You're all caught up!</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar (Desktop Only) */}
        <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-20">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2 font-mono uppercase tracking-wider">
              <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>Campus Trending</span>
            </h3>
            <TrendingPosts
              onSelectPost={(postId) => {
                const elem = document.getElementById(`post-${postId}`);
                if (elem) {
                  elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
            />
          </div>
        </aside>
      </div>

      {/* Floating Action Button */}
      <FAB onClick={() => setIsModalOpen(true)} label="Create Post" />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPostCreated={handlePostCreated}
      />

      {/* Feed Preferences Customization Modal */}
      <FeedPreferencesModal
        isOpen={isPrefModalOpen}
        onClose={() => setIsPrefModalOpen(false)}
        onPreferencesUpdated={() => {
          fetchInitialPosts(feedMode, selectedCategory);
        }}
      />
    </div>
  );
};
