import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import { createConfession } from '../../services/confessionService';
import type { Confession } from '../../types/confession';
import { X, Lock, Sparkles, RefreshCw, Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface ConfessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfessionCreated?: (confession: Confession) => void;
}

export const ConfessionModal: React.FC<ConfessionModalProps> = ({
  isOpen,
  onClose,
  onConfessionCreated,
}) => {
  const { currentUser } = useAuth();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCloseSafe = () => {
    if (text.trim().length > 0 && !submitting) {
      if (window.confirm('Discard your unsaved confession draft?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  useOverlayBackHandler(isOpen, handleCloseSafe);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submitting) return;

    const trimmed = text.trim();
    if (!trimmed) {
      toast.error('Please write something before posting.');
      return;
    }
    if (trimmed.length > 1000) {
      toast.error('Confession is too long (max 1000 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createConfession(trimmed, currentUser);
      toast.success('Your confession has been anonymously posted to campus! 🤫✨');
      setText('');
      onConfessionCreated?.(created);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Unable to post your confession right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const charCount = text.trim().length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" onClick={handleCloseSafe} />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-sky-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-inner">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Anonymous Confession
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  100% Secret
                </span>
              </h2>
              <p className="text-xs text-slate-400">Share something with the campus anonymously.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseSafe}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              placeholder="Write your confession... (e.g. Sometimes college feels overwhelming, or I have a crush on someone from CSE department...)"
              rows={6}
              disabled={submitting}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none transition-all"
            />
            <div className="flex justify-between items-center mt-2 px-1">
              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Your identity is never stored in the public feed.
              </span>
              <span className={`text-[11px] font-mono font-bold ${charCount > 900 ? 'text-amber-400' : 'text-slate-500'}`}>
                {charCount} / 1000
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleCloseSafe}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || charCount === 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-500 hover:from-purple-500 hover:to-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Post Anonymously</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
