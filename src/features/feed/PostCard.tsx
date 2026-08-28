import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Post } from '../../types';
import { formatTimestamp } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import { checkPostIsSaved, toggleSavePost } from '../../services/postBookmarkService';
import { reportPost, reactToPost } from '../../services/postService';
import { PostImageGallery } from './PostImageGallery';
import { CommentSheet } from './CommentSheet';
import toast from 'react-hot-toast';
import { 
  Clock, 
  User, 
  MessageSquare, 
  AlertTriangle, 
  Calendar, 
  Info, 
  Search,
  Share2,
  Bookmark,
  Flag,
  Shield
} from 'lucide-react';

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Like state
  const [likeCount, setLikeCount] = useState<number>(post.likeCount ?? 0);

  // Reactions state
  const [showReactions, setShowReactions] = useState(false);

  // Bookmark state
  const [saved, setSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Comment sheet state
  const [isCommentSheetOpen, setIsCommentSheetOpen] = useState<boolean>(false);
  const [commentCount, setCommentCount] = useState<number>(post.commentCount ?? 0);

  // Sync post prop counts
  useEffect(() => {
    setLikeCount(post.likeCount ?? 0);
    setCommentCount(post.commentCount ?? 0);
  }, [post.likeCount, post.commentCount]);

  // Fetch initial saved status on mount
  useEffect(() => {
    let mounted = true;
    if (currentUser && post.id) {
      checkPostIsSaved(post.id, currentUser.uid).then((isSaved) => {
        if (mounted) setSaved(isSaved);
      });
    }
    return () => {
      mounted = false;
    };
  }, [currentUser, post.id]);

  const handleReactionSelect = async (reactionType: string) => {
    if (!currentUser || !post.id) return;
    try {
      await reactToPost(post.id, currentUser.uid, reactionType);
      setLikeCount((prev) => prev + 1);
      toast.success(`Reacted with ${reactionType}`);
    } catch (err) {
      toast.error('Failed to react.');
    }
  };

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !post.id || isSaving) return;
    setIsSaving(true);
    try {
      const isSavedNow = await toggleSavePost(post.id, currentUser, post.title);
      setSaved(isSavedNow);
      toast.success(isSavedNow ? 'Post saved to bookmarks!' : 'Post removed from saved.');
    } catch (err) {
      toast.error('Failed to update bookmark.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/?postId=${post.id || ''}`;
    const shareData = {
      title: post.title,
      text: post.content.slice(0, 100),
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or failed share
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Post link copied to clipboard!');
    }
  };

  const handleReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !post.id) return;
    try {
      const res = await reportPost(post.id, currentUser.uid, 'Inappropriate content');
      if (res.alreadyReported) {
        toast.error('You have already reported this post.');
      } else {
        toast.success('Post reported for admin moderation.');
      }
    } catch (err) {
      toast.error('Failed to report post.');
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
      <article id={post.id ? `post-${post.id}` : undefined} className="w-full max-w-xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        {/* Card Header */}
        <div className="shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {post.isOfficial && (
                <span className="px-3 py-1 bg-purple-500/20 border border-purple-400/40 text-purple-300 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-md shadow-purple-500/10 animate-pulse">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  <span>Official</span>
                </span>
              )}

              <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${badgeStyle.color}`}>
                {badgeStyle.icon}
                <span>{post.category}</span>
              </span>

              {post.postType && post.postType !== 'news' && (
                <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-full text-xs font-medium uppercase tracking-wider">
                  {post.postType}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{formatTimestamp(post.timestamp)}</span>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight line-clamp-3 group-hover:text-sky-400 transition-colors leading-snug">
            {post.title}
          </h2>
        </div>

        {/* Main Content & Multi-Image Gallery */}
        <div className="my-3 space-y-4 text-slate-300 text-base leading-relaxed">
          <p className="whitespace-pre-line">{post.content}</p>

          {post.reference && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/${post.reference.type === 'marketplace' ? 'marketplace' : post.reference.type + 's'}/${post.reference.id}`);
              }}
              className="p-3.5 bg-slate-950/65 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 hover:border-sky-500/30 cursor-pointer shadow-lg transition-all"
            >
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-sky-400 font-mono tracking-wider">{post.reference.type} reference</span>
                <h4 className="text-xs font-bold text-white mt-0.5 truncate">{post.reference.title}</h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono shrink-0">Open →</span>
            </div>
          )}

          {/* Multi-Image Gallery */}
          <PostImageGallery images={post.images} imageUrl={post.imageUrl} />
        </div>

        {/* Card Footer: Author & Interactive Buttons */}
        <div className="pt-4 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
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

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReactions(!showReactions);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-sky-400 transition-all font-mono"
              >
                <span>React</span>
                <span className="text-xs font-semibold">{likeCount}</span>
              </button>

              {showReactions && (
                <div className="absolute bottom-10 left-0 bg-slate-950 border border-slate-800 p-2 rounded-2xl shadow-2xl flex gap-2 z-40">
                  {[
                    { emoji: '👍', type: 'like' },
                    { emoji: '❤️', type: 'love' },
                    { emoji: '😂', type: 'laugh' },
                    { emoji: '😮', type: 'wow' },
                    { emoji: '🔥', type: 'fire' },
                  ].map((react) => (
                    <button
                      key={react.type}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReactionSelect(react.type);
                        setShowReactions(false);
                      }}
                      className="p-2 hover:bg-slate-800 rounded-xl text-base transition-colors"
                      title={react.type}
                    >
                      {react.emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsCommentSheetOpen(true)}
              title="Open Comments"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-sky-400 transition-all font-mono"
            >
              <MessageSquare className="w-4 h-4 text-slate-400 group-hover:text-sky-400" />
              <span className="text-xs font-semibold">{commentCount}</span>
            </button>

            <button
              type="button"
              title="Save Post"
              onClick={handleSaveToggle}
              disabled={isSaving}
              className={`p-2 border rounded-xl transition-all ${
                saved
                  ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                  : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-amber-400'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${saved ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>

            <button
              type="button"
              title="Share Post"
              onClick={handleShare}
              className="p-2 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Report Post"
              onClick={handleReport}
              className="p-2 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-500 hover:text-rose-400 transition-all"
            >
              <Flag className="w-4 h-4" />
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
