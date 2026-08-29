import React, { useState, useEffect } from 'react';
import { getReplyOriginalMessage } from '../../services/replyCacheService';
import { toggleReaction } from '../../services/reactionService';
import { reportChatMessage, type ChatReportPayload } from '../../services/chatModerationService';
import { editMessage, deleteMessage } from '../../services/chatService';
import { saveMessage, unsaveMessage, hasMessageSaved } from '../../services/savedMessageService';
import { MESSAGE_EDIT_WINDOW_MS } from '../../types/chat';
import { useAuth } from '../../hooks/useAuth';
import { 
  Shield, 
  User, 
  CornerDownRight, 
  Smile, 
  Reply, 
  Flag, 
  X,
  FileText,
  Table,
  Presentation,
  Archive,
  ExternalLink,
  Pencil,
  Trash2,
  Check,
  RefreshCw,
  Bookmark,
  BookmarkCheck
} from 'lucide-react';
import type { ChatMessage } from '../../types/chat';
import { formatTimestamp } from '../../utils/format';
import toast from 'react-hot-toast';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  isOnline?: boolean;
  currentUserId?: string;
  onReply?: (message: ChatMessage) => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🎉', '🤝', '💡'];
const REPORT_REASONS: Array<ChatReportPayload['reason']> = [
  'Spam',
  'Abuse',
  'Harassment',
  'Misinformation',
  'Other',
];

export const formatFileSize = (bytes: number = 0): string => {
  if (!bytes || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mimeType: string = '', fileName: string = '') => {
  const name = fileName.toLowerCase();
  if (mimeType.includes('pdf') || name.endsWith('.pdf')) {
    return <FileText className="w-5 h-5 text-rose-400" />;
  }
  if (
    mimeType.includes('spreadsheet') || 
    mimeType.includes('excel') || 
    name.endsWith('.xls') || 
    name.endsWith('.xlsx') || 
    name.endsWith('.csv')
  ) {
    return <Table className="w-5 h-5 text-emerald-400" />;
  }
  if (
    mimeType.includes('presentation') || 
    mimeType.includes('powerpoint') || 
    name.endsWith('.ppt') || 
    name.endsWith('.pptx')
  ) {
    return <Presentation className="w-5 h-5 text-amber-400" />;
  }
  if (mimeType.includes('zip') || name.endsWith('.zip')) {
    return <Archive className="w-5 h-5 text-purple-400" />;
  }
  return <FileText className="w-5 h-5 text-sky-400" />;
};

const getFileTypeLabel = (_mimeType: string = '', fileName: string = '') => {
  const name = fileName.toLowerCase();
  if (name.endsWith('.pdf')) return 'PDF Document';
  if (name.endsWith('.docx') || name.endsWith('.doc')) return 'Word Document';
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'Excel Spreadsheet';
  if (name.endsWith('.pptx') || name.endsWith('.ppt')) return 'PowerPoint Presentation';
  if (name.endsWith('.csv')) return 'CSV Data';
  if (name.endsWith('.zip')) return 'ZIP Archive';
  if (name.endsWith('.txt')) return 'Text File';
  return 'Document';
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  isOnline = false,
  currentUserId,
  onReply,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [loadingReply, setLoadingReply] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);

  // Edit State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>(message.content || '');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Bookmark / Save State
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const [optimisticCounts, setOptimisticCounts] = useState<Record<string, number>>(
    message.reactionCounts || {}
  );

  useEffect(() => {
    setOptimisticCounts(message.reactionCounts || {});
  }, [message.reactionCounts]);

  useEffect(() => {
    setEditText(message.content || '');
  }, [message.content]);

  // Check saved state once on mount / message change
  useEffect(() => {
    if (!currentUser || !message.id) return;
    let isSubscribed = true;
    hasMessageSaved(currentUser.uid, message.id).then((saved) => {
      if (isSubscribed) setIsSaved(saved);
    });
    return () => {
      isSubscribed = false;
    };
  }, [currentUser, message.id]);

  // Fetch quoted reply target if replyToMessageId exists
  useEffect(() => {
    if (!message.replyToMessageId) return;

    let isMounted = true;
    setLoadingReply(true);

    getReplyOriginalMessage(message.channelId, message.replyToMessageId)
      .then((target) => {
        if (isMounted) {
          setReplyTarget(target);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setLoadingReply(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [message.channelId, message.replyToMessageId]);

  const isAdmin = message.senderRole === 'admin';
  const isDeleted = message.status === 'deleted' || message.status === 'hidden';
  const isSoftDeleted = message.status === 'deleted';

  // 15-minute edit window check
  const createdAtMs = message.createdAt?.toMillis ? message.createdAt.toMillis() : 0;
  const isWithinEditWindow = createdAtMs > 0 && Date.now() - createdAtMs <= MESSAGE_EDIT_WINDOW_MS;
  const canEdit = isOwn && message.status === 'active' && isWithinEditWindow;
  const canDelete = (isOwn || userProfile?.role === 'admin') && message.status !== 'deleted';

  const handleToggleEmoji = async (emoji: string) => {
    if (!currentUserId || !message.id || isSoftDeleted) return;

    setShowPicker(false);
    const prevCounts = { ...optimisticCounts };
    const currentCount = prevCounts[emoji] || 0;
    const newCounts = { ...prevCounts, [emoji]: currentCount + 1 };
    setOptimisticCounts(newCounts);

    try {
      await toggleReaction({
        channelId: message.channelId,
        messageId: message.id,
        userId: currentUserId,
        emoji,
      });
    } catch (err: any) {
      setOptimisticCounts(prevCounts);
      toast.error('Failed to update reaction.');
    }
  };

  const handleReportMessage = async (reason: ChatReportPayload['reason']) => {
    if (!currentUserId || !message.id) return;

    setSubmittingReport(true);
    try {
      await reportChatMessage({
        channelId: message.channelId,
        messageId: message.id,
        reporterId: currentUserId,
        reason,
      });
      toast.success('Message reported to moderators.');
      setShowReportModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to report message.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!currentUser || !message.id || savingEdit) return;

    const cleanText = editText.trim();
    if (!cleanText && !message.imageUrl && !message.attachment) {
      toast.error('Message cannot be completely empty.');
      return;
    }

    setSavingEdit(true);
    try {
      await editMessage(message.channelId, message.id, currentUser, cleanText);
      toast.success('Message edited.');
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to edit message. Your draft is preserved.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!currentUser || !message.id) return;
    if (!window.confirm('Are you sure you want to delete this message?')) return;

    try {
      await deleteMessage(message.channelId, message.id, currentUser, userProfile?.role);
      toast.success('Message deleted.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete message.');
    }
  };

  const handleToggleSave = async () => {
    if (!currentUser || !message.id) return;

    const targetState = !isSaved;
    setIsSaved(targetState);

    try {
      if (targetState) {
        await saveMessage(currentUser.uid, message);
        toast.success('Message saved to bookmarks.', { id: `save-${message.id}` });
      } else {
        await unsaveMessage(
          currentUser.uid, 
          message.id, 
          message.channelId, 
          message.attachment ? 'file' : message.imageUrl ? 'image' : 'text'
        );
        toast.success('Message removed from saved.', { id: `save-${message.id}` });
      }
    } catch (err: any) {
      setIsSaved(!targetState);
      toast.error("Couldn't save this message. Please try again.");
    }
  };

  const handleKeyDownEdit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(message.content || '');
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveEdit();
    }
  };

  const reactionEntries = Object.entries(optimisticCounts).filter(([_, count]) => count > 0);

  return (
    <div 
      id={message.id ? `message-${message.id}` : undefined}
      data-message-id={message.id}
      className={`group relative flex items-end gap-2 my-2.5 transition-all duration-300 ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      {/* Avatar (Left side for other users) */}
      {!isOwn && (
        <div className="relative w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold shrink-0 mb-1">
          {message.senderAvatar ? (
            <img src={message.senderAvatar} alt={message.senderName} className="w-full h-full rounded-full object-cover" />
          ) : message.senderName ? (
            message.senderName.charAt(0).toUpperCase()
          ) : (
            <User className="w-4 h-4 text-slate-400" />
          )}
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} title={isOnline ? 'Online' : 'Offline'} />
        </div>
      )}

      {/* Bubble Container */}
      <div className={`relative max-w-[82%] sm:max-w-[70%] rounded-2xl p-3.5 space-y-1.5 text-xs shadow-lg transition-all ${
        isOwn
          ? 'bg-gradient-to-tr from-sky-600 to-indigo-600 text-white rounded-br-none border border-sky-400/30'
          : 'bg-slate-900/90 border border-slate-800/90 text-slate-200 rounded-bl-none'
      }`}>
        {/* Author Header */}
        {!isOwn && (
          <div className="flex items-center gap-1.5 font-semibold text-[11px]">
            <span className="text-sky-400 truncate max-w-[150px]">{message.senderName || 'Student'}</span>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} title={isOnline ? 'Online' : 'Offline'} />
            {isAdmin && (
              <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-400/30 rounded text-[9px] font-black uppercase flex items-center gap-0.5">
                <Shield className="w-2.5 h-2.5" />
                <span>Admin</span>
              </span>
            )}
          </div>
        )}

        {/* Quoted Reply Target Block */}
        {message.replyToMessageId && (
          <div
            onClick={() => {
              if (message.replyToMessageId) {
                const el = document.getElementById(`message-${message.replyToMessageId}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('bg-indigo-500/20');
                  setTimeout(() => {
                    el.classList.remove('bg-indigo-500/20');
                  }, 2000);
                } else {
                  toast.error('Original message not found in history.');
                }
              }
            }}
            className="p-2 bg-slate-950/50 rounded-xl border border-slate-800 flex items-start gap-1.5 text-[11px] text-slate-300 cursor-pointer hover:bg-slate-950/80 transition-all"
            title="Scroll to original message"
          >
            <CornerDownRight className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-bold text-sky-300 block text-[10px]">
                {replyTarget ? replyTarget.senderName : message.replyToSnippet ? 'Replying to message' : 'Original message'}
              </span>
              <span className="italic text-slate-400 truncate block">
                {loadingReply
                  ? 'Loading preview...'
                  : replyTarget
                  ? replyTarget.status === 'deleted'
                    ? 'Original message deleted'
                    : replyTarget.content || '[Attachment]'
                  : message.replyToSnippet || 'Original message deleted'}
              </span>
            </div>
          </div>
        )}

        {/* Attached Image Display */}
        {message.imageUrl && !isDeleted && (
          <div className="rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950/60 max-h-64 my-1">
            <img
              src={message.imageUrl}
              alt="Attached chat media"
              loading="lazy"
              className="w-full h-full object-cover rounded-xl hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}

        {/* Attached Document File Display */}
        {message.attachment && message.attachment.type === 'file' && !isDeleted && (
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl my-1.5 flex items-center justify-between gap-3 text-slate-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                {getFileIcon(message.attachment.mimeType, message.attachment.name)}
              </div>
              <div className="min-w-0">
                <span className="font-bold text-white text-xs truncate block" title={message.attachment.name}>
                  {message.attachment.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block">
                  {getFileTypeLabel(message.attachment.mimeType, message.attachment.name)} • {formatFileSize(message.attachment.size)}
                </span>
              </div>
            </div>

            <a
              href={message.attachment.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={message.attachment.name}
              aria-label={`Open ${message.attachment.name}`}
              className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-[11px] font-bold shadow-md shadow-sky-500/20 flex items-center gap-1 shrink-0 transition-all"
            >
              <span>Open</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Text Content OR Inline Editor */}
        {isSoftDeleted ? (
          <p className="italic text-slate-400 text-[11px]">This message was deleted</p>
        ) : message.status === 'hidden' ? (
          <p className="italic text-slate-400 text-[11px]">Message hidden by moderator</p>
        ) : isEditing ? (
          <div className="space-y-2 pt-1">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value.slice(0, 1000))}
              onKeyDown={handleKeyDownEdit}
              disabled={savingEdit}
              rows={2}
              aria-label="Edit message text"
              className="w-full p-2 bg-slate-950 border border-sky-500/50 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
            />
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400 font-mono">{editText.length}/1000 • Esc to cancel, Ctrl+Enter to save</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={savingEdit}
                  aria-label="Cancel editing"
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  aria-label="Save edited message"
                  className="px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-white rounded-lg transition-colors font-semibold flex items-center gap-1"
                >
                  {savingEdit ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          message.content && (
            <p className="whitespace-pre-wrap leading-relaxed break-words">{message.content}</p>
          )
        )}

        {/* Footer Timestamp & Reaction Pills */}
        <div className={`flex items-center justify-between gap-2 pt-1 ${isOwn ? 'text-sky-100' : 'text-slate-500'}`}>
          {/* Reaction Summary Pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {reactionEntries.map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => handleToggleEmoji(emoji)}
                disabled={isSoftDeleted}
                className="px-2 py-0.5 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-full text-[10px] font-semibold text-slate-300 flex items-center gap-1 transition-all disabled:cursor-not-allowed"
              >
                <span>{emoji}</span>
                <span className="font-mono text-[9px]">{count}</span>
              </button>
            ))}
          </div>

          {/* Timestamp & Edited Indicator */}
          <div className="flex items-center gap-1 text-[9px] font-mono shrink-0 text-slate-400">
            <span>{formatTimestamp(message.createdAt)}</span>
            {message.editedAt && !isDeleted && (
              <span className="italic text-slate-400" title="Message edited">
                • Edited
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Bar (Hover on Desktop / Visible on Touch) */}
      {!isDeleted && (
        <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-xl p-1 shadow-lg shrink-0 ${
          isOwn ? 'order-first' : 'order-last'
        }`}>
          {/* Bookmark / Save Button */}
          <button
            onClick={handleToggleSave}
            aria-label={isSaved ? 'Remove from saved messages' : 'Save message'}
            className={`p-1 rounded-lg transition-colors ${
              isSaved
                ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
            }`}
            title={isSaved ? 'Remove from saved messages' : 'Save message'}
          >
            {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 fill-amber-400" /> : <Bookmark className="w-3.5 h-3.5" />}
          </button>

          {/* Edit Button (Own active message within 15 mins) */}
          {canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              aria-label="Edit message"
              className="p-1 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Edit message (Within 15 mins)"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete Button (Own message or Admin) */}
          {canDelete && (
            <button
              onClick={handleDeleteMessage}
              aria-label="Delete message"
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Delete message"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Reaction Picker Button */}
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="React with emoji"
            aria-label="React with emoji"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>

          {/* Reply Button */}
          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="p-1 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Reply to message"
              aria-label="Reply to message"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Report Message Button (For other users' messages) */}
          {!isOwn && (
            <button
              onClick={() => setShowReportModal(true)}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Report message"
              aria-label="Report message"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showPicker && !isDeleted && (
        <div className={`absolute bottom-full mb-2 z-40 bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl flex items-center gap-1.5 animate-in fade-in duration-150 ${
          isOwn ? 'right-0' : 'left-0'
        }`}>
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleToggleEmoji(emoji)}
              aria-label={`React with ${emoji}`}
              className="p-2 hover:bg-slate-800 rounded-xl text-base transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white text-base">Report Chat Message</h3>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Select a reason for reporting this message to campus moderators:
            </p>
            <div className="space-y-2">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => handleReportMessage(reason)}
                  disabled={submittingReport}
                  className="w-full p-3 bg-slate-950 hover:bg-slate-800 text-left text-xs font-semibold text-slate-200 border border-slate-800 rounded-xl transition-all flex items-center justify-between"
                >
                  <span>{reason}</span>
                  <Flag className="w-3.5 h-3.5 text-slate-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
