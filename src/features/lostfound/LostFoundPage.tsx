import React, { useEffect, useState, useMemo } from 'react';
import type { Post } from '../../types';
import { getLostFoundPosts } from '../../services/postService';
import { LostFoundCard } from './LostFoundCard';
import { LostFoundForm } from './LostFoundForm';
import { FAB } from '../../components/FAB';
import { 
  Search, 
  AlertCircle, 
  Inbox, 
  Plus,
  Sparkles
} from 'lucide-react';

type StatusFilter = 'Active' | 'Resolved' | 'All';
type TypeFilter = 'All' | 'Lost' | 'Found';

export const LostFoundPage: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Active');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  // Debounce search query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchLostFound = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLostFoundPosts(30);
      setPosts(data);
    } catch (err: any) {
      console.error('Failed to load lost and found feed:', err);
      setError(err.message || 'Failed to load Lost & Found posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLostFound();
  }, []);

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostResolved = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, status: 'resolved' } : p))
    );
  };

  // Client-side filtering over already fetched array
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      // Type Filter ("lost" | "found" | "All")
      if (typeFilter === 'Lost' && p.postType !== 'lost') return false;
      if (typeFilter === 'Found' && p.postType !== 'found') return false;

      // Status Filter ("Active" | "Resolved" | "All")
      const postStatus = p.status || 'active';
      if (statusFilter === 'Active' && postStatus === 'resolved') return false;
      if (statusFilter === 'Resolved' && postStatus !== 'resolved') return false;

      // Debounced Search Match
      if (debouncedSearch) {
        const titleMatch = p.title.toLowerCase().includes(debouncedSearch);
        const contentMatch = p.content.toLowerCase().includes(debouncedSearch);
        if (!titleMatch && !contentMatch) return false;
      }

      return true;
    });
  }, [posts, typeFilter, statusFilter, debouncedSearch]);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Search className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Campus Lost & Found</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Lost an item or found someone's belongings? Post a notice or contact directly via WhatsApp.
          </p>
        </div>

        <button
          onClick={() => setIsFormOpen(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Post Notice</span>
        </button>
      </div>

      {/* Control Bar: Debounced Search Input & Category Filters */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lost items by title or description..."
            className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-2xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
          />
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Type Filter Chips */}
          <div className="flex items-center gap-2">
            {(['All', 'Lost', 'Found'] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  typeFilter === t
                    ? t === 'Lost'
                      ? 'bg-rose-500 text-white border-rose-400'
                      : t === 'Found'
                      ? 'bg-emerald-500 text-white border-emerald-400'
                      : 'bg-amber-500 text-white border-amber-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            {(['Active', 'Resolved', 'All'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                  statusFilter === s
                    ? 'bg-slate-700 text-white border-slate-600'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main List Area */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-slate-900/50 border border-slate-800 rounded-3xl animate-pulse p-6 space-y-3">
              <div className="w-28 h-6 bg-slate-800 rounded-full" />
              <div className="w-1/2 h-6 bg-slate-800 rounded-xl" />
              <div className="w-3/4 h-4 bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-rose-300 text-sm text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p>{error}</p>
          <button onClick={fetchLostFound} className="px-4 py-2 bg-rose-500/20 rounded-xl text-xs font-semibold">
            Retry
          </button>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="p-12 bg-slate-900/60 border border-slate-800 rounded-3xl text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Inbox className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">No Notices Found</h3>
            <p className="text-xs text-slate-400 mt-1">
              No Lost & Found posts match your current search or filter criteria.
            </p>
          </div>
          <button
            onClick={() => setIsFormOpen(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>Create Notice</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <LostFoundCard
              key={post.id}
              post={post}
              onPostResolved={handlePostResolved}
            />
          ))}
        </div>
      )}

      {/* FAB Button */}
      <FAB onClick={() => setIsFormOpen(true)} label="Post Notice" />

      {/* Create Modal Form */}
      <LostFoundForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onPostCreated={handlePostCreated}
      />
    </div>
  );
};
