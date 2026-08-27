import React, { useState, useRef, useEffect } from 'react';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { setTypingStatus } from '../../services/chatService';
import type { ChatMessage } from '../../types/chat';
import { 
  Send, 
  RefreshCw, 
  Image as ImageIcon, 
  Paperclip,
  FileText,
  X, 
  CornerDownRight, 
  AtSign, 
  User as UserIcon 
} from 'lucide-react';
import { isContentBlocked } from '../../config/chatModeration';
import { checkUserMutedStatus } from '../../services/chatModerationService';
import { 
  ALLOWED_CHAT_FILE_TYPES, 
  MAX_CHAT_FILE_SIZE, 
  uploadChatFile, 
  deleteChatFile 
} from '../../services/storageService';
import { formatFileSize } from './MessageBubble';

interface ChannelMemberSuggestion {
  userId: string;
  displayName: string;
}

interface MessageInputProps {
  channelId?: string;
  onSendMessage: (
    text: string, 
    imageFile?: File | null, 
    replyToMessageId?: string, 
    replyToSnippet?: string,
    mentionedUids?: string[],
    docFile?: File | null
  ) => Promise<void>;
  replyingToMessage?: ChatMessage | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_MESSAGE_LENGTH = 1000;

export const MessageInput: React.FC<MessageInputProps> = ({
  channelId,
  onSendMessage,
  replyingToMessage,
  onCancelReply,
  disabled = false,
  placeholder = 'Type a message...',
}) => {
  const { currentUser, userProfile } = useAuth();
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [sending, setSending] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Mention State
  const [mentionedUids, setMentionedUids] = useState<string[]>([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<ChannelMemberSuggestion[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState<boolean>(false);
  const [channelMembersCache, setChannelMembersCache] = useState<ChannelMemberSuggestion[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Check Channel Mute Status
  useEffect(() => {
    if (!channelId || !currentUser) return;
    checkUserMutedStatus(channelId, currentUser.uid).then((muted) => {
      setIsMuted(muted);
    });
  }, [channelId, currentUser]);

  // Load Channel Members for Mention Autocomplete
  useEffect(() => {
    if (!channelId) return;

    let isSubscribed = true;
    const membersRef = collection(db, 'channels', channelId, 'members');
    const q = query(membersRef, limit(30));

    getDocs(q)
      .then((snapshot) => {
        if (!isSubscribed) return;
        const members: ChannelMemberSuggestion[] = snapshot.docs.map((docSnap) => ({
          userId: docSnap.id,
          displayName: docSnap.data().userId || docSnap.id,
        }));
        setChannelMembersCache(members);
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
    };
  }, [channelId]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Only image files (JPEG, PNG, WebP) are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB limit. Please choose a smaller photo.');
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_CHAT_FILE_SIZE) {
      alert('File is too large. Maximum size is 10 MB.');
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isDangerous = ['.exe', '.bat', '.cmd', '.ps1', '.js', '.vbs', '.scr'].some((ext) =>
      lowerName.endsWith(ext)
    );
    if (isDangerous) {
      alert('Executable and script files are not allowed for security reasons.');
      return;
    }

    if (file.type && !ALLOWED_CHAT_FILE_TYPES[file.type]) {
      alert('This file type isn\'t supported. Allowed: PDF, DOC, XLSX, PPT, TXT, CSV, ZIP.');
      return;
    }

    setSelectedDoc(file);
  };

  const handleRemoveDoc = () => {
    setSelectedDoc(null);
    setUploadProgress(0);
    if (docInputRef.current) {
      docInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const cleanText = text.trim();
    if ((!cleanText && !selectedImage && !selectedDoc) || sending || disabled || isMuted) return;

    const blockedCheck = isContentBlocked(cleanText);
    if (blockedCheck.isBlocked) {
      alert(`This message contains blocked content ("${blockedCheck.term}"). Please revise.`);
      return;
    }

    setSending(true);
    let uploadedFileAttachment: any = null;

    try {
      if (channelId && currentUser) {
        setTypingStatus(channelId, currentUser.uid, userProfile?.displayName || 'Student', false);
      }

      // If document file is selected, upload first with progress tracking
      if (selectedDoc && channelId && currentUser) {
        uploadedFileAttachment = await uploadChatFile(
          selectedDoc,
          channelId,
          currentUser.uid,
          (progress) => setUploadProgress(progress)
        );
      }

      const replyId = replyingToMessage?.id;
      const replySnippet = replyingToMessage
        ? (replyingToMessage.content || (selectedDoc ? `📄 ${selectedDoc.name}` : '[Image]')).slice(0, 80)
        : undefined;

      await onSendMessage(
        cleanText, 
        selectedImage, 
        replyId, 
        replySnippet, 
        mentionedUids,
        selectedDoc
      );

      // Clear state on success
      setText('');
      setMentionedUids([]);
      setShowMentionMenu(false);
      handleRemoveImage();
      handleRemoveDoc();
      if (onCancelReply) onCancelReply();

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      // Orphan cleanup if document upload succeeded but message creation failed
      if (uploadedFileAttachment?.storagePath) {
        deleteChatFile(uploadedFileAttachment.storagePath);
      }
      alert(err.message || 'Failed to send message. Your draft is still preserved.');
    } finally {
      setSending(false);
      setUploadProgress(0);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, MAX_MESSAGE_LENGTH);
    setText(val);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    if (channelId && currentUser) {
      const isTyping = val.trim().length > 0;
      setTypingStatus(
        channelId, 
        currentUser.uid, 
        userProfile?.displayName || currentUser.displayName || 'Student', 
        isTyping
      );
    }

    const lastWord = val.split(/\s+/).pop() || '';
    if (lastWord.startsWith('@')) {
      const queryStr = lastWord.slice(1).toLowerCase();
      const filtered = channelMembersCache.filter((m) =>
        m.displayName.toLowerCase().includes(queryStr) || m.userId.toLowerCase().includes(queryStr)
      );
      setMentionSuggestions(filtered.slice(0, 5));
      setShowMentionMenu(true);
    } else {
      setShowMentionMenu(false);
    }
  };

  const handleSelectMention = (member: ChannelMemberSuggestion) => {
    const words = text.split(/\s+/);
    words.pop();
    const newText = `${words.join(' ')}${words.length > 0 ? ' ' : ''}@${member.displayName} `;
    setText(newText);
    setMentionedUids((prev) => Array.from(new Set([...prev, member.userId])));
    setShowMentionMenu(false);

    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const usagePercent = (text.length / MAX_MESSAGE_LENGTH) * 100;
  const isDisabled = disabled || sending || isMuted;
  const canSend = (text.trim().length > 0 || selectedImage !== null || selectedDoc !== null) && !sending && !isDisabled;
  const effectivePlaceholder = isMuted
    ? "You've been muted in this channel by a moderator."
    : placeholder;

  return (
    <div className="p-3 sm:p-4 bg-slate-950/90 border-t border-slate-800 shrink-0 space-y-2 relative">
      {/* Mention Autocomplete Suggestions Popup */}
      {showMentionMenu && mentionSuggestions.length > 0 && (
        <div className="max-w-4xl mx-auto absolute bottom-full mb-2 left-4 right-4 z-50 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in duration-150">
          <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-bold text-slate-400 flex items-center gap-1.5 bg-slate-950/60">
            <AtSign className="w-3.5 h-3.5 text-purple-400" />
            <span>Mention Channel Member</span>
          </div>
          <div className="p-1 max-h-48 overflow-y-auto">
            {mentionSuggestions.map((m) => (
              <button
                key={m.userId}
                onClick={() => handleSelectMention(m)}
                className="w-full p-2.5 hover:bg-slate-800/80 rounded-xl flex items-center gap-2.5 text-left text-xs transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-200 truncate">@{m.displayName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Replying-To Bar */}
      {replyingToMessage && (
        <div className="max-w-4xl mx-auto flex items-center justify-between p-2.5 bg-slate-900 border border-sky-500/30 rounded-xl text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <CornerDownRight className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-sky-400 font-semibold truncate block">
                Replying to {replyingToMessage.senderName || 'Student'}
              </span>
              <span className="text-slate-400 text-[11px] truncate block">
                "{replyingToMessage.content || '[Attachment]'}"
              </span>
            </div>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 shrink-0"
            title="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selected Image Thumbnail Preview */}
      {imagePreview && (
        <div className="max-w-4xl mx-auto relative inline-block">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 group">
            <img src={imagePreview} alt="Selected preview" className="w-full h-full object-cover" />
            <button
              onClick={handleRemoveImage}
              aria-label="Remove photo"
              className="absolute top-1 right-1 p-1 bg-slate-950/80 hover:bg-rose-600 text-white rounded-full transition-colors"
              title="Remove photo"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Selected Document Attachment Preview Card */}
      {selectedDoc && (
        <div className="max-w-4xl mx-auto p-3 bg-slate-900 border border-sky-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-white block truncate" title={selectedDoc.name}>
                {selectedDoc.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">
                {formatFileSize(selectedDoc.size)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {sending && uploadProgress > 0 && (
              <span className="text-[10px] font-mono font-bold text-sky-400">
                {uploadProgress}%
              </span>
            )}
            <button
              onClick={handleRemoveDoc}
              aria-label="Remove attachment"
              disabled={sending}
              className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
              title="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Composer Bar */}
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        {/* Image Attachment Button */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
          id="chat-image-input"
          disabled={isDisabled}
        />
        <label
          htmlFor="chat-image-input"
          className={`p-3 rounded-2xl border transition-all cursor-pointer shrink-0 flex items-center justify-center ${
            selectedImage
              ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
              : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700'
          }`}
          title="Attach Image (Max 5MB)"
          aria-label="Attach image"
        >
          <ImageIcon className="w-5 h-5" />
        </label>

        {/* Document File Attachment Button (📎) */}
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,application/zip"
          onChange={handleDocSelect}
          className="hidden"
          id="chat-doc-input"
          disabled={isDisabled}
        />
        <label
          htmlFor="chat-doc-input"
          className={`p-3 rounded-2xl border transition-all cursor-pointer shrink-0 flex items-center justify-center ${
            selectedDoc
              ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
              : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700'
          }`}
          title="Attach Document File (Max 10MB)"
          aria-label="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </label>

        {/* Text Input */}
        <div className="flex-1 relative bg-slate-900 border border-slate-800 focus-within:border-sky-500 rounded-2xl transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            placeholder={effectivePlaceholder}
            maxLength={MAX_MESSAGE_LENGTH}
            className="w-full px-4 py-3 bg-transparent text-white text-xs sm:text-sm placeholder:text-slate-600 focus:outline-none resize-none min-h-[44px] max-h-[120px]"
          />

          {text.length > 800 && (
            <span className={`absolute right-3 bottom-2 text-[10px] font-mono font-medium ${
              usagePercent >= 95 ? 'text-rose-400 font-bold' : 'text-slate-500'
            }`}>
              {text.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="p-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-2xl shadow-lg shadow-sky-500/20 shrink-0 transition-all"
          title="Send Message (Enter)"
        >
          {sending ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};
