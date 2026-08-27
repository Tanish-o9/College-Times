import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import { subscribeToComments, addComment } from '../../services/commentService';
import type { Comment } from '../../types';
import { formatTimestamp } from '../../utils/format';
import toast from 'react-hot-toast';
import { X, Send, MessageSquare, User, RefreshCw, Sparkles } from 'lucide-react';

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
  useOverlayBackHandler(isOpen, onClose);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to live comments when sheet opens
  useEffect(() => {
    if (!isOpen || !postId) return;

    setLoading(true);
    const unsubscribe = subscribeToComments(postId, (liveComments) => {
      setComments(liveComments);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, postId]);

  // Scroll to bottom when new comment arrives
  useEffect(() => {
    if (comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length]);

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
      await addComment(postId, cleanText, currentUser, userProfile, postAuthorId);
      setText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
              <Sparkles className="w-8 h-8 text-sky-400/50" />
              <p className="text-sm font-semibold text-slate-300">No comments yet</p>
              <p className="text-xs text-slate-500">Be the first to share your thoughts!</p>
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 flex items-center justify-center text-[10px] font-bold">
                      {c.authorName ? c.authorName.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                    </div>
                    <span className="text-xs font-semibold text-white">{c.authorName || 'Student'}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{formatTimestamp(c.timestamp)}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pl-8">{c.text}</p>
              </div>
            ))
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Sticky Input Footer */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800 bg-slate-950/90 shrink-0 flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
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
