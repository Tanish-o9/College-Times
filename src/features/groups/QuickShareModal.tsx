import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { sendGroupChatMessage } from '../../services/groupChatService';
import { Share2, X, Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface QuickShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  targetType: 'post' | 'moment' | 'poll' | 'event' | 'announcement';
  targetId: string;
  previewText?: string;
}

export const QuickShareModal: React.FC<QuickShareModalProps> = ({
  isOpen,
  onClose,
  groupId,
  targetType,
  targetId,
  previewText,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !currentUser || sending) return;

    setSending(true);
    try {
      const channelId = `group-${groupId}`;
      const messageText = comment.trim() || `Check out this ${targetType} in our group!`;

      await sendGroupChatMessage(
        channelId,
        messageText,
        currentUser,
        userProfile
      );

      toast.success(`Shared ${targetType} to group chat!`);
      setComment('');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to share to group chat.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Share2 className="w-5 h-5 text-sky-400" />
          <span>Share to Group Chat</span>
        </h3>

        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs space-y-1">
          <span className="font-bold text-sky-400 uppercase font-mono">{targetType} Reference</span>
          <p className="text-slate-300 line-clamp-2">{previewText || `Target ID: ${targetId}`}</p>
        </div>

        <form onSubmit={handleShare} className="space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Add optional note to share..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 resize-none"
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Share to Chat</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
