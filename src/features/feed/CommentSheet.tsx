import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import { getCommentsPage, addComment, deleteComment, reactToComment } from '../../services/commentService';
import type { Comment } from '../../types';
import { formatTimestamp } from '../../utils/format';
import toast from 'react-hot-toast';
import { X, Send, MessageSquare, User, RefreshCw, Sparkles, Trash2, CornerDownRight, Heart } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

interface CommentSheetProps {
  isOpen: boolean;
  postId: string;
  postAuthorId?: string;
  onClose: () => void;
}

export const CommentSheet: React.FC<CommentSheetProps> = ({
  isOpen,
  postId,
  postAuthorId,
  onClose,
}) => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  useOverlayBackHandler(isOpen, onClose);

  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Pagination states
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Reply states
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [replyToAuthorName, setReplyToAuthorName] = useState<string | null>(null);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  const fetchInitialComments = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await getCommentsPage(postId, 20);
      setComments(res.comments);
      setLastDoc(res.lastDoc);
      setHasMore(res.comments.length === 20);
    } catch (err) {
      toast.error('Failed to load comments.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreComments = async () => {
    if (!postId || !lastDoc || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await getCommentsPage(postId, 20, lastDoc);
      setComments((prev) => [...prev, ...res.comments]);
      setLastDoc(res.lastDoc);
      setHasMore(res.comments.length === 20);
    } catch (err) {
      toast.error('Failed to load more comments.');
    } finally {
      setLoadingMore(false);
    }
  };

  // Fetch comments when sheet opens
  useEffect(() => {
    if (isOpen && postId) {
      fetchInitialComments();
      setReplyToCommentId(null);
      setReplyToAuthorName(null);
    }
  }, [isOpen, postId]);

  // Scroll to bottom when comments are loaded initial or new ones are added
  useEffect(() => {
    if (comments.length > 0 && !loading) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length, loading]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || !currentUser || submitting) return;

    setSubmitting(true);
    try {
      const newComment = await addComment(
        postId,
        cleanText,
        currentUser,
        userProfile,
        postAuthorId,
        replyToCommentId || undefined
      );
      setComments((prev) => [...prev, newComment]);
      setText('');
      setReplyToCommentId(null);
      setReplyToAuthorName(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!postId || !commentId) return;
    try {
      await deleteComment(postId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success('Comment deleted.');
    } catch (err) {
      toast.error('Failed to delete comment.');
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!postId || !commentId || !currentUser) return;
    try {
      await reactToComment(postId, commentId, currentUser.uid);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, likeCount: (c.likeCount || 0) + 1 } : c
        )
      );
      toast.success('Liked comment!');
    } catch (err) {
      // Ignore or log
    }
  };

  if (!isOpen) return null;

  // Separate root comments and nested replies
  const rootComments = comments.filter((c) => !c.parentCommentId);
  const replies = comments.filter((c) => !!c.parentCommentId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-up Bottom Drawer */}
      <div className="relative w-full max-w-xl bg-slate-900 border-t border-x border-slate-800 rounded-t-3xl shadow-2xl z-10 max-h-[85vh] h-[75vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Handle Bar */}
        <div className="w-full py-2.5 flex justify-center cursor-pointer" onClick={onClose}>
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        {/* Drawer Header */}
        <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Campus Comments</h3>
              <p className="text-[11px] text-slate-400 font-mono">{comments.length} responses</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-500 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-sky-400 mr-2" />
              <span>Loading discussion...</span>
            </div>
          ) : rootComments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
              <Sparkles className="w-8 h-8 text-sky-400/50" />
              <p className="text-sm font-semibold text-slate-300">No comments yet</p>
              <p className="text-xs text-slate-500">Be the first to share your thoughts!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Load More Button */}
              {hasMore && (
                <button
                  type="button"
                  onClick={fetchMoreComments}
                  disabled={loadingMore}
                  className="w-full py-2 bg-slate-950/40 hover:bg-slate-950/60 border border-slate-850 rounded-xl text-[10px] font-bold text-sky-400 font-mono transition-all flex items-center justify-center gap-2"
                >
                  {loadingMore ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                  <span>Load Previous Comments</span>
                </button>
              )}

              {rootComments.map((c) => {
                const commentReplies = replies.filter((r) => r.parentCommentId === c.id);
                return (
                  <div key={c.id} className="space-y-2">
                    {/* Parent Comment */}
                    <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-1.5 relative group">
                      <div className="flex items-center justify-between">
                        <div 
                          onClick={() => {
                            navigate(`/profile/${c.authorId}`);
                            onClose();
                          }}
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {c.authorAvatar ? (
                            <img src={c.authorAvatar} className="w-6 h-6 rounded-full object-cover border border-slate-800" alt="" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 flex items-center justify-center text-[10px] font-bold">
                              {c.authorName ? c.authorName.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                            </div>
                          )}
                          <span className="text-xs font-semibold text-white">{c.authorName || 'Student'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-500 font-mono">{formatTimestamp(c.timestamp)}</span>
                          {currentUser && c.authorId === currentUser.uid && (
                            <button
                              onClick={() => handleDelete(c.id!)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete Comment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed pl-8">{c.text}</p>
                      
                      {/* Interaction Bar */}
                      <div className="pl-8 pt-1 flex items-center gap-3 text-[10px] font-bold text-slate-500 font-mono">
                        <button
                          onClick={() => handleLikeComment(c.id!)}
                          className="hover:text-rose-400 flex items-center gap-1 transition-colors"
                        >
                          <Heart className="w-3 h-3 fill-rose-500/10 text-rose-500" />
                          <span>{c.likeCount || 0}</span>
                        </button>
                        <button
                          onClick={() => {
                            setReplyToCommentId(c.id!);
                            setReplyToAuthorName(c.authorName || 'Student');
                          }}
                          className="hover:text-sky-400 transition-colors"
                        >
                          Reply
                        </button>
                      </div>
                    </div>

                    {/* Nested Replies */}
                    {commentReplies.map((r) => (
                      <div key={r.id} className="pl-8 flex gap-2">
                        <CornerDownRight className="w-4 h-4 text-slate-700 shrink-0 mt-2" />
                        <div className="flex-1 p-3 bg-slate-950/60 border border-slate-850 rounded-2xl space-y-1.5 relative group">
                          <div className="flex items-center justify-between">
                            <div 
                              onClick={() => {
                                navigate(`/profile/${r.authorId}`);
                                onClose();
                              }}
                              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              {r.authorAvatar ? (
                                <img src={r.authorAvatar} className="w-5 h-5 rounded-full object-cover border border-slate-800" alt="" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 flex items-center justify-center text-[9px] font-bold">
                                  {r.authorName ? r.authorName.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                                </div>
                              )}
                              <span className="text-xs font-semibold text-white">{r.authorName || 'Student'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-slate-500 font-mono">{formatTimestamp(r.timestamp)}</span>
                              {currentUser && r.authorId === currentUser.uid && (
                                <button
                                  onClick={() => handleDelete(r.id!)}
                                  className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                                  title="Delete Reply"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed pl-7">{r.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Reply Indicator banner */}
        {replyToCommentId && (
          <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono shrink-0">
            <span>Replying to <span className="text-sky-400 font-bold">@{replyToAuthorName}</span></span>
            <button
              onClick={() => {
                setReplyToCommentId(null);
                setReplyToAuthorName(null);
              }}
              className="text-rose-400 hover:underline font-bold"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Sticky Input Footer */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800 bg-slate-950/90 shrink-0 flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyToCommentId ? `Reply to @${replyToAuthorName}...` : "Add a comment..."}
            maxLength={500}
            required
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="p-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white rounded-xl shadow-md transition-all shrink-0"
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};
