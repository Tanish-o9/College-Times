import React, { useState, useEffect } from 'react';
import type { Post } from '../../types';
import { formatTimestamp } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import { hasUserLiked, toggleLike } from '../../services/likeService';
import { CommentSheet } from './CommentSheet';
import toast from 'react-hot-toast';
import { 
  Clock, 
  User, 
  Heart, 
  MessageSquare, 
  AlertTriangle, 
  Calendar, 
  Info, 
  Search,
  Share2,
  Shield
} from 'lucide-react';

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const { currentUser, userProfile } = useAuth();

  // Like state
  const [liked, setLiked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(post.likeCount ?? 0);
  const [isLiking, setIsLiking] = useState<boolean>(false);
  const [likeAnimating, setLikeAnimating] = useState<boolean>(false);

  // Comment sheet state
  const [isCommentSheetOpen, setIsCommentSheetOpen] = useState<boolean>(false);
  const [commentCount, setCommentCount] = useState<number>(post.commentCount ?? 0);

  // Sync post prop counts
  useEffect(() => {
    setLikeCount(post.likeCount ?? 0);
    setCommentCount(post.commentCount ?? 0);
  }, [post.likeCount, post.commentCount]);

  // Fetch initial liked status on mount
  useEffect(() => {
    let mounted = true;
    if (currentUser && post.id) {
      hasUserLiked(post.id, currentUser.uid).then((isLiked) => {
        if (mounted) {
          setLiked(isLiked);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [currentUser, post.id]);

  // Optimistic Like Toggle with Failure Rollback
  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !post.id || isLiking) return;

    // Snapshot previous state for rollback
    const prevLiked = liked;
    const prevCount = likeCount;

    // Optimistic state flip
    const nextLiked = !prevLiked;
    const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);
    setLiked(nextLiked);
    setLikeCount(nextCount);
    setLikeAnimating(true);
    setIsLiking(true);

    setTimeout(() => setLikeAnimating(false), 300);

    try {
      const result = await toggleLike(post.id, currentUser.uid, post.authorId, userProfile);
      setLiked(result.liked);
      setLikeCount(result.newLikeCount);
    } catch (err: any) {
      // Rollback on failure
      setLiked(prevLiked);
      setLikeCount(prevCount);
      toast.error('Failed to update like state. Rolled back.', { id: 'like-error' });
    } finally {
      setIsLiking(false);
    }
  };

  const getCategoryBadge = (category: Post['category']) => {
    switch (category) {
      case 'Mishap':
        return {
          color: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
        };
      case 'Event':
        return {
          color: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
          icon: <Calendar className="w-3.5 h-3.5" />,
        };
      case 'LostFound':
        return {
          color: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          icon: <Search className="w-3.5 h-3.5" />,
        };
      case 'General':
      default:
        return {
          color: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
          icon: <Info className="w-3.5 h-3.5" />,
        };
    }
  };

  const badgeStyle = getCategoryBadge(post.category);

  return (
    <>
      <article id={post.id ? `post-${post.id}` : undefined} className="w-full max-w-xl h-full max-h-[82vh] sm:max-h-[85vh] bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
        {/* Background ambient glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        {/* Card Header (Flexbox layout reserving space for up to 3 lines of title) */}
        <div className="shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Official Broadcast Badge */}
              {post.isOfficial && (
                <span className="px-3 py-1 bg-purple-500/20 border border-purple-400/40 text-purple-300 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-md shadow-purple-500/10 animate-pulse">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  <span>Official</span>
                </span>
              )}

              {/* Category Badge */}
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${badgeStyle.color}`}>
                {badgeStyle.icon}
                <span>{post.category}</span>
              </span>

              {/* Post Type Badge */}
              {post.postType && post.postType !== 'news' && (
                <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-full text-xs font-medium uppercase tracking-wider">
                  {post.postType}
                </span>
              )}
            </div>

            {/* Relative Timestamp */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{formatTimestamp(post.timestamp)}</span>
            </div>
          </div>

          {/* Title Area: Reserving up to 3 lines with line-clamp and clean flex bounds */}
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight line-clamp-3 group-hover:text-sky-400 transition-colors leading-snug">
            {post.title}
          </h2>
        </div>

        {/* Main Content Area with internal scroll if text overflows */}
        <div className="flex-1 overflow-y-auto pr-2 my-3 space-y-4 text-slate-300 text-base leading-relaxed scrollbar-thin scrollbar-thumb-slate-700">
          <p className="whitespace-pre-line">{post.content}</p>

          {/* Post Image with lazy loading */}
          {post.imageUrl && (
            <div className="rounded-2xl overflow-hidden border border-slate-800 max-h-64 my-3">
              <img
                src={post.imageUrl}
                alt={post.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Card Footer: Author & Interactive Buttons */}
        <div className="pt-4 border-t border-slate-800/90 flex items-center justify-between text-xs text-slate-400 shrink-0">
          {/* Author Avatar & Name */}
          <div className="flex items-center gap-2 font-medium text-slate-200 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 border border-sky-400/30 flex items-center justify-center text-white font-bold text-xs shrink-0">
              {post.authorName ? post.authorName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-white truncate max-w-[130px] sm:max-w-[170px]">
                {post.authorName || 'Campus Student'}
              </span>
              <span className="text-[10px] text-slate-500 truncate">Verified Campus Author</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Heart Like Button */}
            <button
              type="button"
              onClick={handleLikeToggle}
              disabled={isLiking}
              title={liked ? 'Unlike Post' : 'Like Post'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono transition-all duration-200 ${
                liked
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-rose-400'
              }`}
            >
              <Heart
                className={`w-4 h-4 transition-transform duration-200 ${
                  liked ? 'fill-rose-500 text-rose-500' : 'text-slate-400'
                } ${likeAnimating ? 'scale-125' : 'scale-100'}`}
              />
              <span className="text-xs font-semibold">{likeCount}</span>
            </button>

            {/* Comment Button */}
            <button
              type="button"
              onClick={() => setIsCommentSheetOpen(true)}
              title="Open Comments"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-sky-400 transition-all font-mono"
            >
              <MessageSquare className="w-4 h-4 text-slate-400 group-hover:text-sky-400" />
              <span className="text-xs font-semibold">{commentCount}</span>
            </button>

            {/* Share Slot */}
            <button
              type="button"
              title="Share Post"
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('Link copied to clipboard!', { id: 'share-toast' });
                }
              }}
              className="p-2 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all hidden sm:flex"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </article>

      {/* Real-Time Comment Drawer Sheet */}
      {post.id && (
        <CommentSheet
          isOpen={isCommentSheetOpen}
          postId={post.id}
          postAuthorId={post.authorId}
          onClose={() => setIsCommentSheetOpen(false)}
        />
      )}
    </>
  );
};
