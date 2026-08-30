import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { formatTimestamp } from '../../utils/format';
import type { Confession, ConfessionComment } from '../../types/confession';
import {
  toggleConfessionLike,
  checkUserLikedConfession,
  addConfessionComment,
  subscribeConfessionComments,
  reportConfession,
} from '../../services/confessionService';
import {
  Heart,
  MessageSquare,
  Flag,
  Share2,
  Lock,
  Send,
  RefreshCw,
  X,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ConfessionCardProps {
  confession: Confession;
}

const REPORT_REASONS = [
  'Harassment or Bullying',
  'Threatening content',
  'Hate or abusive speech',
  'Spam or misleading',
  'Personal information (Doxxing)',
  'Explicit sexual content',
  'Other campus rule violation',
];

export const ConfessionCard: React.FC<ConfessionCardProps> = ({ confession }) => {
  const { currentUser } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(confession.likesCount || 0);
  const [likeLiking, setLikeLiking] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ConfessionComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentsCount, setCommentsCount] = useState(confession.commentsCount || 0);

  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [reporting, setReporting] = useState(false);

  // Check if current user liked
  useEffect(() => {
    if (currentUser?.uid && confession.id) {
      checkUserLikedConfession(confession.id, currentUser.uid).then(setLiked);
    }
  }, [currentUser?.uid, confession.id]);

  // Sync likesCount and commentsCount when props change
  useEffect(() => {
    setLikesCount(confession.likesCount || 0);
    setCommentsCount(confession.commentsCount || 0);
  }, [confession.likesCount, confession.commentsCount]);

  // Subscribe to comments when toggled
  useEffect(() => {
    if (!showComments || !confession.id) return;
    const unsub = subscribeConfessionComments(confession.id, (list) => {
      setComments(list);
      setCommentsCount(list.length);
    });
    return () => unsub();
  }, [showComments, confession.id]);

  const handleLikeToggle = async () => {
    if (!currentUser) {
      toast.error('Please log in to react to confessions.');
      return;
    }
    if (likeLiking) return;

    setLikeLiking(true);
    // Optimistic UI update
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!prevLiked);
    setLikesCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const res = await toggleConfessionLike(confession.id, currentUser.uid);
      setLiked(res.liked);
      setLikesCount(res.newCount);
    } catch (err: any) {
      // Rollback
      setLiked(prevLiked);
      setLikesCount(prevCount);
      toast.error(err.message || 'Failed to update reaction.');
    } finally {
      setLikeLiking(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submittingComment) return;

    const trimmed = commentText.trim();
    if (!trimmed) return;

    setSubmittingComment(true);
    try {
      await addConfessionComment(confession.id, trimmed, currentUser);
      setCommentText('');
      toast.success('Anonymous comment added.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || reporting) return;

    setReporting(true);
    try {
      await reportConfession(confession.id, selectedReason, currentUser.uid);
      setShowReportModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to report confession.');
    } finally {
      setReporting(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'Campus Confession on College Times',
          text: `"${confession.text.slice(0, 100)}..."`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard! 📋');
    }
  };

  const formattedTime = formatTimestamp(confession.createdAt);

  return (
    <article className="p-5 sm:p-6 bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 hover:border-purple-500/40 rounded-3xl transition-all duration-200 hover:-translate-y-0.5 shadow-xl space-y-4 relative group">
      {/* Header — ANONYMOUS ONLY */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-purple-500/30 text-purple-300 flex items-center justify-center shadow-inner shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">Anonymous</span>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Confession
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">{formattedTime}</p>
          </div>
        </div>

        {/* Report Button */}
        <button
          type="button"
          onClick={() => setShowReportModal(true)}
          className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition-colors opacity-80 group-hover:opacity-100"
          title="Report inappropriate confession"
        >
          <Flag className="w-4 h-4" />
        </button>
      </div>

      {/* Confession Content */}
      <div className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap break-words px-1">
        "{confession.text}"
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
        <div className="flex items-center gap-2">
          {/* Like Button */}
          <button
            type="button"
            onClick={handleLikeToggle}
            disabled={likeLiking}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold transition-all ${
              liked
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-rose-500 text-rose-500 animate-scale-up' : ''}`} />
            <span>{likesCount}</span>
          </button>

          {/* Comment Toggle Button */}
          <button
            type="button"
            onClick={() => setShowComments((prev) => !prev)}
            className="px-3.5 py-2 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl flex items-center gap-1.5 font-bold transition-all"
          >
            <MessageSquare className="w-4 h-4 text-sky-400" />
            <span>{commentsCount}</span>
          </button>
        </div>

        {/* Share Button */}
        <button
          type="button"
          onClick={handleShare}
          className="p-2 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all flex items-center gap-1 text-xs font-semibold"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="pt-3 space-y-3 border-t border-slate-800/60">
          {/* Comment List */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2 text-center">
                No comments yet. Be the first to anonymously comment.
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-400">Anonymous</span>
                    <span className="text-[10px] text-slate-500">
                      {formatTimestamp(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-normal">{c.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Add Comment Form */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add an anonymous comment..."
              disabled={submittingComment}
              className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={submittingComment || !commentText.trim()}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center transition-colors shrink-0"
            >
              {submittingComment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Report Confession
              </h3>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Help keep College Times safe and respectful. Select a reason for reporting this confession:
            </p>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div className="space-y-2">
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                      selectedReason === reason
                        ? 'bg-purple-500/10 border-purple-500/40 text-purple-300 font-semibold'
                        : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                      className="accent-purple-500"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reporting}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  {reporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Submit Report</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </article>
  );
};
