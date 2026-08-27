import React, { useState, useEffect } from 'react';
import { getTrendingPosts } from '../../services/trendingService';
import type { Post } from '../../types/models';
import { formatTimestamp } from '../../utils/format';
import { Flame, MessageSquare, Heart, RefreshCw } from 'lucide-react';

interface TrendingPostsProps {
  onSelectPost?: (postId: string) => void;
}

export const TrendingPosts: React.FC<TrendingPostsProps> = ({ onSelectPost }) => {
  const [trending, setTrending] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrendingPosts(5)
      .then((data) => setTrending(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-xs text-slate-400">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
        <span>Loading trending posts...</span>
      </div>
    );
  }

  if (trending.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Flame className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Trending on Campus</h3>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Live Engagement Ranking</span>
      </div>

      {/* Horizontal Carousel */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
        {trending.map((post, idx) => (
          <div
            key={post.id}
            onClick={() => post.id && onSelectPost?.(post.id)}
            className="snap-start min-w-[240px] max-w-[280px] p-4 bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl cursor-pointer transition-all space-y-2.5 shrink-0 group relative overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-extrabold uppercase font-mono flex items-center gap-1">
                <Flame className="w-3 h-3 fill-amber-300 text-amber-300" />
                <span>#{idx + 1} Trending</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {formatTimestamp(post.timestamp)}
              </span>
            </div>

            <h4 className="text-xs font-bold text-white line-clamp-2 group-hover:text-amber-400 transition-colors leading-snug">
              {post.title}
            </h4>

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
              <span className="truncate max-w-[120px] font-semibold text-slate-300">
                {post.authorName || 'Student'}
              </span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3 text-rose-400 fill-rose-400" />
                  <span>{post.likeCount || 0}</span>
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-sky-400" />
                  <span>{post.commentCount || 0}</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
