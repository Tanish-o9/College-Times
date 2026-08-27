import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { Post } from '../../types';
import { getPostsPage } from '../../services/postService';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { PostCard } from './PostCard';
import { CreatePostModal } from './CreatePostModal';
import { FAB } from '../../components/FAB';
import { useIsVisible } from '../../hooks/useIsVisible';
import { Skeleton } from '../../components/Skeleton';
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
  CheckCircle2
} from 'lucide-react';

import { useSearchParams } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type CategoryFilter = 'All' | 'General' | 'Event' | 'Mishap' | 'LostFound';

const PAGE_SIZE = 10;

export const Feed: React.FC = () => {
  const [searchParams] = useSearchParams();
  const targetPostId = searchParams.get('postId');

  const [posts, setPosts] = useState<Post[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingRecentPosts, setPendingRecentPosts] = useState<Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Phase 11 & 26: Intersection Observer Sentinel Hook
  const [sentinelRef, isSentinelVisible] = useIsVisible<HTMLDivElement>({ threshold: 0.5 });

  // Bounded Realtime Listener for Recent Posts (limit: 5)
  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('timestamp', 'desc'), limit(5));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recent = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Post) }));
      const activeIds = new Set(posts.map((p) => p.id));
      const newUnseen = recent.filter((r) => r.id && !activeIds.has(r.id));
      setPendingRecentPosts(newUnseen);
    });

    return () => unsubscribe();
  }, [posts]);

  const mergeNewPosts = () => {
    if (pendingRecentPosts.length === 0) return;
    setPosts((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const filtered = pendingRecentPosts.filter((p) => p.id && !existingIds.has(p.id));
      return [...filtered, ...prev];
    });
    setPendingRecentPosts([]);
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

  // Initial / Category reset fetch
  const fetchInitialPosts = async (cat: CategoryFilter = selectedCategory) => {
    setLoadingInitial(true);
    setError(null);
    setLastDoc(null);
    setHasMore(true);

    try {
      const result = await getPostsPage(PAGE_SIZE, cat, null);
      setPosts(result.posts);
      setLastDoc(result.lastDoc);
      if (result.posts.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (err: any) {
      console.error('Failed to load feed:', err);
      setError(err.message || 'Failed to load posts.');
    } finally {
      setLoadingInitial(false);
    }
  };

  // Fetch next page via cursor pagination
  const fetchNextPage = async () => {
    if (!hasMore || loadingMore || loadingInitial || !lastDoc) return;

    setLoadingMore(true);
    try {
      const result = await getPostsPage(PAGE_SIZE, selectedCategory, lastDoc);
      
      // Duplicate guard using document ID
      setPosts((prevPosts) => {
        const existingIds = new Set(prevPosts.map((p) => p.id));
        const newPosts = result.posts.filter((p) => p.id && !existingIds.has(p.id));
        return [...prevPosts, ...newPosts];
      });

      setLastDoc(result.lastDoc);
      if (result.posts.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (err: any) {
      console.error('Failed to load next page:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchInitialPosts(selectedCategory);
  }, [selectedCategory]);

  // Infinite Scroll Trigger on Sentinel Intersection
  useEffect(() => {
    if (isSentinelVisible && hasMore && !loadingMore && !loadingInitial) {
      fetchNextPage();
    }
  }, [isSentinelVisible, hasMore, loadingMore, loadingInitial]);

  const handleCategorySelect = (cat: CategoryFilter) => {
    if (selectedCategory === cat) return;
    setSelectedCategory(cat);
  };

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const categories: { label: CategoryFilter; icon?: React.ReactNode }[] = [
    { label: 'All', icon: <Filter className="w-3 h-3" /> },
    { label: 'General', icon: <Info className="w-3 h-3" /> },
    { label: 'Event', icon: <Calendar className="w-3 h-3" /> },
    { label: 'Mishap', icon: <AlertTriangle className="w-3 h-3" /> },
    { label: 'LostFound', icon: <Search className="w-3 h-3" /> },
  ];

  return (
    <div className="relative w-full h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden">
      {/* Category Filter Bar */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.label;
            return (
              <button
                key={cat.label}
                onClick={() => handleCategorySelect(cat.label)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => fetchInitialPosts(selectedCategory)}
          disabled={loadingInitial}
          className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all text-xs flex items-center gap-1 shrink-0"
          title="Refresh Feed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingInitial ? 'animate-spin text-sky-400' : ''}`} />
        </button>
      </div>

      {/* Floating New Posts Available Pill */}
      {pendingRecentPosts.length > 0 && (
        <div className="absolute top-14 inset-x-0 z-40 flex justify-center pointer-events-none">
          <button
            onClick={mergeNewPosts}
            className="pointer-events-auto px-4 py-2 bg-sky-500 text-slate-950 font-bold text-xs rounded-full shadow-2xl flex items-center gap-2 border border-sky-300 animate-bounce hover:bg-sky-400 transition-all"
          >
            <Sparkles className="w-4 h-4 fill-slate-950 text-slate-950" />
            <span>{pendingRecentPosts.length} New Campus Post{pendingRecentPosts.length > 1 ? 's' : ''} Available — Click to View</span>
          </button>
        </div>
      )}

      {/* Snap-Scroll Container */}
      <div className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-smooth w-full">
        {/* Error State */}
        {error && (
          <div className="h-full flex items-center justify-center p-4">
            <div className="max-w-md w-full p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-rose-300 text-sm text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="font-semibold">{error}</p>
              <button
                onClick={() => fetchInitialPosts(selectedCategory)}
                className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-xl text-xs font-semibold"
              >
                Retry Fetching
              </button>
            </div>
          </div>
        )}

        {/* Initial Loading Skeletons */}
        {loadingInitial && (
          <div className="w-full">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="snap-start h-[calc(100vh-4.5rem)] shrink-0 flex items-center justify-center p-4 sm:p-6"
              >
                <div className="w-full max-w-xl h-full max-h-[82vh] bg-slate-900/50 border border-slate-800/60 rounded-3xl p-8 space-y-6 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Skeleton variant="button" className="w-28" />
                      <Skeleton variant="text" className="w-20" />
                    </div>
                    <Skeleton variant="text" className="h-8 w-3/4" />
                    <div className="space-y-2">
                      <Skeleton variant="text" />
                      <Skeleton variant="text" className="w-5/6" />
                      <Skeleton variant="text" className="w-2/3" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between">
                    <Skeleton variant="rectangular" className="w-32 h-8" />
                    <Skeleton variant="rectangular" className="w-24 h-8" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loadingInitial && !error && posts.length === 0 && (
          <div className="snap-start h-full flex items-center justify-center p-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 text-center max-w-md w-full shadow-2xl space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
                <Inbox className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">No {selectedCategory !== 'All' ? selectedCategory : ''} Posts</h2>
                <p className="text-slate-400 text-xs mt-1">
                  Be the first to publish a post in this category!
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
          </div>
        )}

        {/* Posts List with Infinite Scroll Sentinel */}
        {!loadingInitial && !error && posts.length > 0 && (
          <>
            {posts.map((post) => (
              <div
                key={post.id}
                className="snap-start h-[calc(100vh-4.5rem)] shrink-0 flex items-center justify-center p-3 sm:p-6"
              >
                <PostCard post={post} />
              </div>
            ))}

            {/* Pagination Loading & Caught Up Footer */}
            <div ref={sentinelRef} className="snap-start py-8 flex flex-col items-center justify-center space-y-2">
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
          </>
        )}
      </div>

      {/* Floating Action Button */}
      <FAB onClick={() => setIsModalOpen(true)} label="Create Post" />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPostCreated={handlePostCreated}
      />
    </div>
  );
};
