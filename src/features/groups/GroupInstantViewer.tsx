import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import {
  reactToGroupInstant,
  reportGroupInstant,
  deleteGroupInstant,
  getGroupInstantMedia,
  saveGroupMoment,
  unsaveGroupMoment,
  isMomentSaved,
  getMomentComments,
  addMomentComment,
  deleteMomentComment,
} from '../../services/groupInstantService';
import type { GroupInstant, GroupInstantMedia, GroupInstantComment } from '../../types/group';
import {
  X,
  MessageSquare,
  Flag,
  Trash2,
  Heart,
  ThumbsUp,
  Flame,
  Smile,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Share2,
  Send,
  MessageCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface GroupInstantViewerProps {
  isOpen: boolean;
  onClose: () => void;
  instants: GroupInstant[];
  initialIndex?: number;
  groupId: string;
}

const EMOJI_LIST = [
  { symbol: '❤️', icon: Heart, label: 'Heart' },
  { symbol: '👍', icon: ThumbsUp, label: 'Like' },
  { symbol: '🔥', icon: Flame, label: 'Fire' },
  { symbol: '😂', icon: Smile, label: 'Laugh' },
  { symbol: '😮', icon: AlertCircle, label: 'Wow' },
];

export const GroupInstantViewer: React.FC<GroupInstantViewerProps> = ({
  isOpen,
  onClose,
  instants,
  initialIndex = 0,
  groupId,
}) => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [subcollectionMedia, setSubcollectionMedia] = useState<GroupInstantMedia[]>([]);

  // Phase 37 Features: Saved State & Comments Drawer
  const [saved, setSaved] = useState<boolean>(false);
  const [showComments, setShowComments] = useState<boolean>(false);
  const [comments, setComments] = useState<GroupInstantComment[]>([]);
  const [commentText, setCommentText] = useState<string>('');
  const [submittingComment, setSubmittingComment] = useState<boolean>(false);

  useOverlayBackHandler(isOpen, onClose);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setCurrentMediaIndex(0);
    setShowComments(false);
  }, [initialIndex, isOpen]);

  const currentInstant = instants[currentIndex];

  // Fetch subcollection media items & save status when instant changes
  useEffect(() => {
    if (!isOpen || !currentInstant || !groupId) return;

    getGroupInstantMedia(groupId, currentInstant.id, 50)
      .then((mediaDocs) => {
        setSubcollectionMedia(mediaDocs && mediaDocs.length > 0 ? mediaDocs : []);
      })
      .catch(() => setSubcollectionMedia([]));

    if (currentUser) {
      isMomentSaved(currentInstant.id, currentUser.uid).then(setSaved);
    }
  }, [isOpen, groupId, currentInstant?.id, currentUser]);

  // Fetch comments when comments drawer is opened
  useEffect(() => {
    if (showComments && currentInstant && groupId) {
      getMomentComments(groupId, currentInstant.id, 30)
        .then((res) => setComments(res.comments))
        .catch(() => setComments([]));
    }
  }, [showComments, groupId, currentInstant?.id]);

  if (!isOpen || !currentInstant) return null;

  // Resolve media URLs array (subcollection takes priority, fallback to parent media array)
  const mediaUrls: string[] =
    subcollectionMedia.length > 0
      ? subcollectionMedia.map((m) => m.downloadUrl)
      : currentInstant.media && currentInstant.media.length > 0
      ? currentInstant.media
      : [];

  const totalPhotosCount = currentInstant.mediaCount || mediaUrls.length;

  const handleNext = () => {
    if (mediaUrls.length > 0 && currentMediaIndex < mediaUrls.length - 1) {
      setCurrentMediaIndex((prev) => prev + 1);
    } else if (currentIndex < instants.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setCurrentMediaIndex(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex((prev) => prev - 1);
    } else if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setCurrentMediaIndex(0);
    }
  };

  const handleReact = async (emoji: string) => {
    if (!currentUser) return;
    try {
      await reactToGroupInstant(groupId, currentInstant.id, emoji, currentUser.uid);
      toast.success(`Reacted ${emoji}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to react.');
    }
  };

  const handleToggleSave = async () => {
    if (!currentUser) return;
    try {
      if (saved) {
        await unsaveGroupMoment(currentInstant.id, groupId, currentUser.uid);
        setSaved(false);
        toast.success('Moment removed from saved.');
      } else {
        await saveGroupMoment(currentInstant.id, groupId, currentUser.uid);
        setSaved(true);
        toast.success('Moment saved!');
      }
    } catch (err: any) {
      toast.error('Failed to update bookmark.');
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/groups/${groupId}?moment=${currentInstant.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Group Moment from ${currentInstant.senderName}`,
          text: currentInstant.caption || 'Check out this Group Moment!',
          url: shareUrl,
        });
      } catch (err) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Moment link copied to clipboard!');
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Moment link copied to clipboard!');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submittingComment || !commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const newComment = await addMomentComment(groupId, currentInstant.id, commentText, currentUser, userProfile);
      setComments((prev) => [...prev, newComment]);
      setCommentText('');
      toast.success('Comment added.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentUser) return;
    try {
      await deleteMomentComment(groupId, currentInstant.id, commentId, currentUser);
      setComments((prev) => prev.filter((c) => (c.commentId || c.id) !== commentId));
      toast.success('Comment removed.');
    } catch (err: any) {
      toast.error('Failed to delete comment.');
    }
  };

  const handleReplyInChat = () => {
    onClose();
    navigate(`/chat?channel=group-${groupId}&instantId=${currentInstant.id}`);
  };

  const handleDelete = async () => {
    if (!currentUser) return;
    try {
      await deleteGroupInstant(groupId, currentInstant.id, currentUser, userProfile);
      toast.success('Instant removed.');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete.');
    }
  };

  const handleReport = async () => {
    if (!currentUser) return;
    try {
      await reportGroupInstant(groupId, currentInstant.id, 'Inappropriate content', currentUser);
      toast.success('Report submitted.');
    } catch (err: any) {
      toast.error('Failed to submit report.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center select-none overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Main Container */}
      <div className="relative w-full max-w-md h-full max-h-[92vh] sm:rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 flex flex-col shadow-2xl">
        {/* Top Header Bar */}
        <div className="absolute top-0 left-0 right-0 z-30 p-3 bg-gradient-to-b from-slate-950/90 to-transparent space-y-2">
          {/* Top Status Counter */}
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono font-bold px-1">
            <span>
              {mediaUrls.length > 0 ? `Photo ${currentMediaIndex + 1} of ${totalPhotosCount}` : 'Text Moment'}
            </span>
            <span>Moment {currentIndex + 1} of {instants.length}</span>
          </div>

          {/* Author Header */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                {currentInstant.senderAvatar ? (
                  <img src={currentInstant.senderAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  currentInstant.senderName.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">{currentInstant.senderName}</span>
                <span className="text-[10px] text-purple-400 font-mono font-bold">Permanent Group Moment</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleToggleSave}
                className={`p-1.5 transition-colors ${saved ? 'text-amber-400' : 'text-slate-400 hover:text-white'}`}
                title={saved ? 'Bookmarked' : 'Save Moment'}
              >
                <Bookmark className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} />
              </button>

              <button
                onClick={handleShare}
                className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                title="Share Moment"
              >
                <Share2 className="w-4 h-4" />
              </button>

              {currentUser?.uid === currentInstant.senderId || userProfile?.role === 'admin' ? (
                <button onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors" title="Delete Instant">
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleReport} className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors" title="Report Instant">
                  <Flag className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition-colors" title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Media / Content Viewport */}
        <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden">
          {mediaUrls.length > 0 ? (
            <img
              src={mediaUrls[currentMediaIndex]}
              alt="Group moment"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="p-8 text-center space-y-3 max-w-xs">
              <p className="text-base font-medium text-white leading-relaxed">{currentInstant.caption}</p>
            </div>
          )}

          {/* Navigation Controls */}
          {currentMediaIndex > 0 || currentIndex > 0 ? (
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : null}

          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition-colors"
            title="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Caption & Interactions */}
        <div className="z-30 p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          {mediaUrls.length > 0 && currentInstant.caption && (
            <p className="text-xs text-slate-200 leading-relaxed max-h-16 overflow-y-auto">
              {currentInstant.caption}
            </p>
          )}

          {/* Reaction Bar & Comments Trigger */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {EMOJI_LIST.map(({ symbol, label }) => {
                const count = currentInstant.reactionCounts?.[symbol] || 0;
                return (
                  <button
                    key={symbol}
                    onClick={() => handleReact(symbol)}
                    className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs flex items-center gap-1 transition-all active:scale-95 shrink-0"
                    title={`React ${label}`}
                  >
                    <span>{symbol}</span>
                    {count > 0 && <span className="text-[10px] text-slate-400 font-mono">{count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowComments(!showComments)}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5 text-purple-400" />
                <span>{currentInstant.commentCount || comments.length || 0}</span>
              </button>

              <button
                onClick={handleReplyInChat}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 transition-all shadow-md shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>
            </div>
          </div>
        </div>

        {/* Phase 37: Comments Drawer Modal */}
        {showComments && (
          <div className="absolute inset-x-0 bottom-0 top-16 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 flex flex-col p-4 space-y-3 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-purple-400" />
                <span>Moment Discussion ({comments.length})</span>
              </span>
              <button onClick={() => setShowComments(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {comments.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic text-center py-8">
                  No comments yet. Start the conversation!
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id || c.commentId} className="p-2.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-purple-300">{c.authorName}</span>
                      {currentUser?.uid === c.authorId || userProfile?.role === 'admin' ? (
                        <button
                          onClick={() => handleDeleteComment(c.commentId || c.id!)}
                          className="text-slate-500 hover:text-rose-400 p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-200 leading-normal">{c.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Input */}
            <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
              />
              <button
                type="submit"
                disabled={submittingComment || !commentText.trim()}
                className="p-2 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white rounded-xl transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
