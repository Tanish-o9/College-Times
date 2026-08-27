import React, { useState } from 'react';
import type { Post } from '../../types';
import { formatTimestamp } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import { resolvePost, reportPost } from '../../services/postService';
import toast from 'react-hot-toast';
import { 
  Clock, 
  User, 
  MessageCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Check, 
  Flag,
  AlertCircle
} from 'lucide-react';

import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { ClaimModal } from './ClaimModal';
import { ClaimReviewModal } from './ClaimReviewModal';
import { MatchSuggestions } from './MatchSuggestions';

interface LostFoundCardProps {
  post: Post;
  onPostResolved?: (postId: string) => void;
}

export const LostFoundCard: React.FC<LostFoundCardProps> = ({ post, onPostResolved }) => {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<'active' | 'resolved' | string>(post.status || 'active');
  const [resolving, setResolving] = useState(false);
  const [showConfirmResolve, setShowConfirmResolve] = useState(false);

  const [showReportMenu, setShowReportMenu] = useState(false);

  // Claim modals state
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const isLost = post.postType === 'lost';
  const isAuthor = currentUser?.uid === post.authorId;
  const isResolved = status === 'resolved';

  const handleResolve = async () => {
    if (!post.id || resolving) return;
    setResolving(true);
    try {
      await resolvePost(post.id);
      setStatus('resolved');
      toast.success('Marked as resolved!');
      if (onPostResolved) {
        onPostResolved(post.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark as resolved');
    } finally {
      setResolving(false);
      setShowConfirmResolve(false);
    }
  };

  const handleReport = async (reason: string) => {
    if (!post.id || !currentUser) return;
    try {
      const res = await reportPost(post.id, currentUser.uid, reason);
      if (res.alreadyReported) {
        toast("You've already reported this notice.", { icon: 'ℹ️', id: 'report-info' });
      } else {
        toast.success('Reported — thank you.', { id: 'report-success' });
      }
    } catch (err: any) {
      toast.error('Failed to report notice.');
    } finally {
      setShowReportMenu(false);
    }
  };

  const borderClass = isResolved
    ? 'border-l-8 border-l-slate-700'
    : isLost
    ? 'border-l-8 border-l-rose-500'
    : 'border-l-8 border-l-emerald-500';

  return (
    <article className={`w-full max-w-xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 relative overflow-hidden transition-all ${borderClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isResolved ? (
            <span className="px-3 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-full text-xs font-bold flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-slate-400" />
              <span>RESOLVED</span>
            </span>
          ) : isLost ? (
            <span className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>LOST ITEM</span>
            </span>
          ) : (
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>FOUND ITEM</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTimestamp(post.timestamp)}</span>
          </div>

          {/* Report Button */}
          {currentUser && (
            <div className="relative">
              <button
                onClick={() => setShowReportMenu(!showReportMenu)}
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
                title="Report Post"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>

              {showReportMenu && (
                <div className="absolute right-0 top-8 z-40 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-2 w-44 space-y-1">
                  <span className="block px-3 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Report Reason</span>
                  {['Spam', 'Abuse', 'Misinformation', 'Other'].map((reason) => (
                    <button
                      key={reason}
                      onClick={() => handleReport(reason)}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h2 className="text-xl font-extrabold text-white tracking-tight leading-snug">
        {post.title}
      </h2>

      {/* Content */}
      <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
        {post.content}
      </p>

      {/* Attached Image if present */}
      {post.imageUrl && (
        <div className="rounded-2xl overflow-hidden border border-slate-800 max-h-56">
          <img src={post.imageUrl} alt={post.title} loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Phase 30: Smart Match Suggestions */}
      {!isResolved && <MatchSuggestions item={post} />}

      {/* Footer Actions */}
      <div className="pt-4 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
        {/* Author Info */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold border border-slate-700">
            {post.authorName ? post.authorName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
          </div>
          <span className="text-xs font-medium text-slate-300">{post.authorName || 'Campus Member'}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Claim Controls */}
          {!isResolved && currentUser && (
            isAuthor ? (
              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="px-3.5 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>Review Claims</span>
              </button>
            ) : (
              <button
                onClick={() => setIsClaimModalOpen(true)}
                className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Claim Item</span>
              </button>
            )
          )}

          {/* Mark as Resolved Button */}
          {isAuthor && !isResolved && (
            <button
              onClick={() => setShowConfirmResolve(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-emerald-600/20 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/30 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mark as Resolved</span>
            </button>
          )}

          {/* WhatsApp Direct Contact Button */}
          {post.contactInfo && !isResolved && (
            <a
              href={`https://wa.me/91${post.contactInfo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <MessageCircle className="w-4 h-4 fill-white text-emerald-500" />
              <span>Contact via WhatsApp</span>
            </a>
          )}
        </div>
      </div>

      {/* Claim Modal */}
      {post.id && (
        <ClaimModal
          itemId={post.id}
          itemTitle={post.title}
          itemReporterId={post.authorId}
          isOpen={isClaimModalOpen}
          onClose={() => setIsClaimModalOpen(false)}
        />
      )}

      {/* Claim Review Modal */}
      {post.id && (
        <ClaimReviewModal
          itemId={post.id}
          itemTitle={post.title}
          itemReporterId={post.authorId}
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          onClaimResolved={() => setStatus('resolved')}
        />
      )}

      {/* Confirmation Modal for Resolving */}
      {showConfirmResolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Mark as Resolved?</h3>
              <p className="text-xs text-slate-400 mt-1">
                This notice will be marked as resolved and hidden from active search.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowConfirmResolve(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="flex-1 py-2.5 bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/20"
              >
                Confirm Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
