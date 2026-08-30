import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Post } from '../../types';
import { formatTimestamp } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import { checkPostIsSaved, toggleSavePost } from '../../services/postBookmarkService';
import { reportPost, deletePost, editPost } from '../../services/postService';
import { toggleReaction, getUserReaction } from '../../services/likeService';
import type { ReactionType } from '../../services/likeService';
import { PostImageGallery } from './PostImageGallery';
import { CommentSheet } from './CommentSheet';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { AdminBlockModal } from '../../components/AdminBlockModal';
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
  Shield,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  Ban,
} from 'lucide-react';

interface PostCardProps {
  post: Post;
  showPinButton?: boolean;
  onPinToggle?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, showPinButton, onPinToggle }) => {
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);

  // Like state
  const [likeCount, setLikeCount] = useState<number>(post.likeCount ?? 0);

  // Reactions state
  const [showReactions, setShowReactions] = useState(false);
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [reactBusy, setReactBusy] = useState(false);

  // Fetch current user's existing reaction on mount using likeService
  useEffect(() => {
    if (!currentUser || !post.id) return;
    let mounted = true;
    getUserReaction(post.id, currentUser.uid)
      .then((reaction) => {
        if (!mounted) return;
        setUserReaction(reaction);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [currentUser, post.id]);

  const handleReactionSelect = async (reactionType: ReactionType) => {
    if (!currentUser || !post.id || reactBusy) return;
    setReactBusy(true);
    setShowReactions(false);

    // Optimistic UI update
    const prev = userReaction;
    if (prev === reactionType) {
      setUserReaction(null);
      setLikeCount((c) => Math.max(0, c - 1));
    } else if (prev) {
      setUserReaction(reactionType);
    } else {
      setUserReaction(reactionType);
      setLikeCount((c) => c + 1);
    }

    try {
      await toggleReaction(post.id, currentUser.uid, reactionType, post.authorId, null);
    } catch {
      // Rollback optimistic update on error
      setUserReaction(prev);
      if (prev === reactionType) setLikeCount((c) => c + 1);
      else if (!prev) setLikeCount((c) => Math.max(0, c - 1));
      toast.error('Failed to react.');
    } finally {
      setReactBusy(false);
    }
  };


  // Bookmark state
  const [saved, setSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Comment sheet state
  const [isCommentSheetOpen, setIsCommentSheetOpen] = useState<boolean>(false);
  const [commentCount, setCommentCount] = useState<number>(post.commentCount ?? 0);

  // Edit/delete state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>(post.title);
  const [editContent, setEditContent] = useState<string>(post.content);
  const [editCategory, setEditCategory] = useState<string>(post.category);
  const [isDeleted, setIsDeleted] = useState<boolean>(false);

  // Real-time listener for counts and doc status
  useEffect(() => {
    if (!post.id) return;
    const unsub = onSnapshot(doc(db, 'posts', post.id), (snap) => {
      if (!snap.exists()) {
        setIsDeleted(true);
      } else {
        const data = snap.data();
        setLikeCount(data.likeCount ?? 0);
        setCommentCount(data.commentCount ?? 0);
      }
    });
    return () => unsub();
  }, [post.id]);

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

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !post.id) return;
    try {
      await editPost(post.id, currentUser.uid, {
        title: editTitle,
        content: editContent,
        category: editCategory as any,
      });
      setIsEditing(false);
      toast.success('Post updated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update post.');
    }
  };

  const handleDeletePost = async () => {
    if (!currentUser || !post.id) return;
    if (!window.confirm('Delete this post permanently? This cannot be undone.')) return;
    try {
      await deletePost(post.id);
      toast.success('Post deleted successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete post.');
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
          color: 'bg-gradient-to-r from-rose-500/25 via-rose-500/20 to-pink-500/25 border border-rose-500/50 text-rose-300 font-extrabold shadow-md shadow-rose-500/20',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
        };
      case 'Event':
        return {
          color: 'bg-gradient-to-r from-purple-500/25 via-purple-500/20 to-indigo-500/25 border border-purple-500/50 text-purple-300 font-extrabold shadow-md shadow-purple-500/20',
          icon: <Calendar className="w-3.5 h-3.5 text-purple-400" />,
        };
      case 'LostFound':
        return {
          color: 'bg-gradient-to-r from-amber-500/25 via-amber-500/20 to-orange-500/25 border border-amber-500/50 text-amber-300 font-extrabold shadow-md shadow-amber-500/20',
          icon: <Search className="w-3.5 h-3.5 text-amber-400" />,
        };
      case 'General':
      default:
        return {
          color: 'bg-gradient-to-r from-sky-500/25 via-sky-500/20 to-emerald-500/25 border border-sky-500/50 text-sky-300 font-extrabold shadow-md shadow-sky-500/20',
          icon: <Info className="w-3.5 h-3.5 text-sky-400" />,
        };
    }
  };

  const badgeStyle = getCategoryBadge(post.category);

  const isOptimistic = post.id?.startsWith('optimistic_');

  if (isDeleted) return null;

  return (
    <>
      <article
        id={post.id ? `post-${post.id}` : undefined}
        className={`w-full bg-slate-900/95 backdrop-blur-xl border rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between relative overflow-hidden group hover:-translate-y-1 hover:border-sky-500/50 hover:shadow-2xl hover:shadow-sky-500/15 transition-all duration-200 ease-out ${
          isOptimistic ? 'border-sky-500/50 ring-1 ring-sky-500/30' : 'border-slate-800/90'
        }`}
      >
        {/* Optimistic shimmer overlay */}
        {isOptimistic && (
          <div className="absolute inset-0 z-20 pointer-events-none rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-sky-500/5 animate-pulse" />
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-950/80 border border-sky-500/30 rounded-full px-2.5 py-1 text-[10px] font-bold text-sky-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Publishing…
            </div>
          </div>
        )}
        {/* Colorful Top Accent Line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 opacity-70 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-sky-500/10 via-purple-500/10 to-transparent rounded-full blur-3xl -z-10 pointer-events-none group-hover:scale-125 transition-transform duration-500" />

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

            <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{formatTimestamp(post.timestamp)}</span>
              {(currentUser?.uid === post.authorId || isAdmin) && (
                <div className="flex items-center gap-1.5 ml-2 border-l border-slate-800 pl-2">
                  {currentUser?.uid === post.authorId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                      }}
                      className="p-1 text-slate-500 hover:text-sky-400 hover:bg-slate-850 rounded-lg transition-colors"
                      title="Edit Post"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePost();
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-850 rounded-lg transition-colors"
                    title="Delete Post"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {isAdmin && post.authorId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsBlockModalOpen(true);
                      }}
                      className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Block User (Admin Only)"
                    >
                      <Ban className="w-3 h-3 text-rose-400" />
                      <span>Block</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight line-clamp-3 group-hover:text-sky-300 transition-colors leading-snug">
            {post.title}
          </h2>
        </div>

        {/* Main Content & Multi-Image Gallery */}
        <div className="my-3 space-y-4 text-slate-100 font-medium text-sm sm:text-base leading-relaxed">
          <p className="whitespace-pre-line text-slate-100">{post.content}</p>

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
          <div 
            onClick={() => navigate(`/profile/${post.authorId}`)}
            className="flex items-center gap-2 font-medium text-slate-200 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            {post.authorAvatar ? (
              <img src={post.authorAvatar} alt={post.authorName} className="w-8 h-8 rounded-full object-cover border border-sky-400/30 shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 border border-sky-400/30 flex items-center justify-center text-white font-bold text-xs shrink-0">
                {post.authorName ? post.authorName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
            )}
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
                  if (userReaction) {
                    // Clicking main button when already reacted → toggle off
                    handleReactionSelect(userReaction);
                  } else {
                    setShowReactions(!showReactions);
                  }
                }}
                disabled={reactBusy}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl transition-all font-mono ${
                  userReaction
                    ? 'bg-sky-500/10 border-sky-500/30 text-sky-300 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-sky-400'
                }`}
              >
                <span>
                  {userReaction
                    ? ({ like: '👍', love: '❤️', celebrate: '🎉', support: '🤝', insightful: '💡' } as Record<string, string>)[userReaction] ?? '👍'
                    : 'React'}
                </span>
                <span className="text-xs font-semibold">{likeCount}</span>
              </button>

              {showReactions && !userReaction && (
                <div className="absolute bottom-10 left-0 bg-slate-950 border border-slate-800 p-2 rounded-2xl shadow-2xl flex gap-2 z-40">
                  {[
                    { emoji: '👍', type: 'like' as ReactionType, label: 'Like' },
                    { emoji: '❤️', type: 'love' as ReactionType, label: 'Love' },
                    { emoji: '🎉', type: 'celebrate' as ReactionType, label: 'Celebrate' },
                    { emoji: '🤝', type: 'support' as ReactionType, label: 'Support' },
                    { emoji: '💡', type: 'insightful' as ReactionType, label: 'Insightful' },
                  ].map((react) => (
                    <button
                      key={react.type}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReactionSelect(react.type);
                      }}
                      className={`p-2 hover:bg-slate-800 rounded-xl text-base transition-all transform hover:scale-125 ${userReaction === react.type ? 'ring-2 ring-sky-500' : ''}`}
                      title={react.label}
                    >
                      <span className="text-lg">{react.emoji}</span>
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

            {showPinButton && (
              <button
                type="button"
                title={post.pinned ? 'Unpin Post' : 'Pin Post'}
                onClick={(e) => {
                  e.stopPropagation();
                  onPinToggle?.();
                }}
                className={`p-2 border rounded-xl transition-all ${
                  post.pinned
                    ? 'bg-sky-500/20 border-sky-500/30 text-sky-300'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-sky-400'
                }`}
              >
                <Bookmark className={`w-4 h-4 rotate-45 ${post.pinned ? 'fill-sky-400 text-sky-400' : ''}`} />
              </button>
            )}
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

      {/* Edit Post Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsEditing(false)} />
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 z-10 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Edit Post</h3>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={80}
                  className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-650 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="General">General</option>
                  <option value="Event">Event</option>
                  <option value="LostFound">LostFound</option>
                  <option value="Mishap">Mishap</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Content</label>
                <textarea
                  required
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  maxLength={500}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-650 focus:outline-none focus:border-indigo-500 font-medium resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Block User Modal */}
      {isAdmin && (
        <AdminBlockModal
          targetUserId={post.authorId}
          targetUserName={post.authorName}
          isOpen={isBlockModalOpen}
          onClose={() => setIsBlockModalOpen(false)}
        />
      )}
    </>
  );
};
