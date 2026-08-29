import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BackButton } from '../../components/BackButton';
import type { DirectMessage, DirectConversation } from '../../types/directMessage';
import { useAuth } from '../../hooks/useAuth';
import { 
  sendDirectMessage, 
  updateConversationStatus, 
  blockUser,
  unblockUser,
  toggleDMReaction,
  uploadDMMedia,
  setTypingIndicator,
  subscribeToTypingIndicators,
  deleteDirectMessage,
  updateConversationReadState,
  getDirectMessagesPaginated,
  editDirectMessage,
  muteConversationPref,
} from '../../services/directMessageService';
import { subscribeToMemberPresence } from '../../services/presenceService';
import { doc, onSnapshot, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { 
  Send, 
  RefreshCw, 
  ShieldAlert, 
  UserX, 
  Check, 
  X, 
  MessageSquare,
  Lock,
  Paperclip,
  Smile,
  CornerUpLeft,
  Forward,
  File,
  User,
  Trash2,
  ChevronUp,
  Bell,
  BellOff,
  Edit3,
} from 'lucide-react';

export const DirectMessageRoom: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [conversation, setConversation] = useState<DirectConversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputContent, setInputContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Rich Messaging States
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<DirectMessage | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [forwardingMsg, setForwardingMsg] = useState<DirectMessage | null>(null);
  const [forwardChats, setForwardChats] = useState<DirectConversation[]>([]);
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);


  // Typing indicator state
  const [typingUids, setTypingUids] = useState<string[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pagination for older messages
  const [olderLastDoc, setOlderLastDoc] = useState<any>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isTargetOnline, setIsTargetOnline] = useState<boolean>(false);

  // Derive target participant UID & Name
  const targetUid = conversation?.participantIds.find((id) => id !== currentUser?.uid);
  const targetName = targetUid && conversation?.participantNames
    ? conversation.participantNames[targetUid] || 'Campus Peer'
    : 'Campus Peer';

  const isPendingRequest = conversation?.status === 'pending' && conversation?.lastMessageSenderId !== currentUser?.uid;
  const isBlocked = conversation?.status === 'blocked';
  const blockedByMe = conversation?.blockedBy === currentUser?.uid;

  // Listen to active conversation doc in realtime
  useEffect(() => {
    if (!conversationId || !currentUser) return;
    const convRef = doc(db, 'conversations', conversationId);

    const unsubscribe = onSnapshot(convRef, (snap) => {
      if (snap.exists()) {
        setConversation({ id: snap.id, ...snap.data() } as DirectConversation);
      }
    });

    return () => unsubscribe();
  }, [conversationId, currentUser]);

  // Subscribe to target user presence
  useEffect(() => {
    if (!currentUser || !targetUid) return;
    const unsubscribe = subscribeToMemberPresence([targetUid], (statusMap) => {
      setIsTargetOnline(statusMap[targetUid] || false);
    });
    return () => unsubscribe();
  }, [currentUser, targetUid]);


  // Listen to messages in realtime
  useEffect(() => {
    if (!conversationId || !currentUser) return;
    setLoading(true);

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
        } as DirectMessage;
      });
      setMessages(list);
      setLoading(false);
    }, (err) => {
      console.error("Error reading messages:", err);
      toast.error("Failed to load messages.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [conversationId, currentUser]);

  // Subscribe to typing indicators via RTDB
  useEffect(() => {
    if (!conversationId || !currentUser) return;
    const unsub = subscribeToTypingIndicators(conversationId, currentUser.uid, setTypingUids);
    return () => {
      unsub();
      // Clear our own typing indicator on unmount
      setTypingIndicator(conversationId, currentUser.uid, false);
    };
  }, [conversationId, currentUser]);

  // Mark conversation as read when entering
  useEffect(() => {
    if (!conversationId || !currentUser) return;
    updateConversationReadState(conversationId, currentUser).catch(() => {});
  }, [conversationId, currentUser]);

  // Listen to mute state preference
  useEffect(() => {
    if (!currentUser || !conversationId) return;
    const prefRef = doc(db, 'users', currentUser.uid, 'conversationPreferences', conversationId);
    const unsub = onSnapshot(prefRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.muted === true) {
          if (data.mutedUntil) {
            const until = data.mutedUntil.toDate ? data.mutedUntil.toDate() : new Date(data.mutedUntil);
            setIsMuted(until.getTime() > Date.now());
          } else {
            setIsMuted(true);
          }
        } else {
          setIsMuted(false);
        }
      } else {
        setIsMuted(false);
      }
    });
    return () => unsub();
  }, [currentUser, conversationId]);

  // Load other chats for forwarding when modal opens
  useEffect(() => {
    if (!currentUser || !forwardingMsg) return;
    const loadForwardChats = async () => {
      try {
        const convsRef = collection(db, 'conversations');
        const q = query(convsRef, where('participantIds', 'array-contains', currentUser.uid), limit(20));
        const snap = await getDocs(q);
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as DirectConversation)
          .filter((c) => c.id !== conversationId);
        setForwardChats(list);
      } catch (err) {
        console.error('Failed to load chats for forwarding:', err);
      }
    };
    loadForwardChats();
  }, [currentUser, forwardingMsg, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !conversationId || !inputContent.trim() || sending) return;

    // Clear typing indicator immediately on send
    setTypingIndicator(conversationId, currentUser.uid, false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    setSending(true);
    try {
      if (editingMsg) {
        await editDirectMessage(conversationId, editingMsg.id, inputContent, currentUser);
        setEditingMsg(null);
      } else {
        await sendDirectMessage(conversationId, inputContent, currentUser, {
          replyToMessageId: replyingTo?.id || undefined,
          replyToPreview: replyingTo ? (replyingTo.messageType === 'text' ? replyingTo.content : `[${replyingTo.messageType.toUpperCase()}]`) : undefined,
          replyTo: replyingTo ? {
            messageId: replyingTo.id,
            senderId: replyingTo.senderId,
            preview: replyingTo.messageType === 'text' ? replyingTo.content : `[${replyingTo.messageType.toUpperCase()}]`
          } : undefined
        });
        setReplyingTo(null);
      }
      setInputContent('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputContent(e.target.value);
    if (!conversationId || !currentUser) return;
    // Set typing indicator
    setTypingIndicator(conversationId, currentUser.uid, true);
    // Auto-clear after 3 seconds of inactivity
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setTypingIndicator(conversationId, currentUser.uid, false);
    }, 3000);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !conversationId) return;

    setUploading(true);
    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      const downloadURL = await uploadDMMedia(file, conversationId, currentUser.uid);
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const type = isImg ? 'image' : (isVid ? 'video' : 'file');

      await sendDirectMessage(conversationId, '', currentUser, {
        messageType: type as any,
        attachment: {
          url: downloadURL,
          filename: file.name,
          mimeType: file.type
        }
      });
      toast.success('Media sent successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload media.', { id: toastId });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-indigo-500/20 animate-pulse');
      setTimeout(() => {
        el.classList.remove('bg-indigo-500/20', 'animate-pulse');
      }, 2000);
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser || !conversationId) return;
    try {
      await updateConversationStatus(conversationId, 'active', currentUser);
      toast.success('Message request accepted!');
    } catch (err) {
      toast.error('Failed to accept request.');
    }
  };

  const handleDeclineRequest = async () => {
    if (!currentUser || !conversationId) return;
    try {
      await updateConversationStatus(conversationId, 'declined', currentUser);
      toast.success('Message request declined.');
      navigate('/messages');
    } catch (err) {
      toast.error('Failed to decline request.');
    }
  };

  const handleBlockUser = async () => {
    if (!currentUser || !targetUid) return;
    try {
      await blockUser(targetUid, targetName, currentUser);
      toast.success(`Blocked ${targetName}.`);
    } catch (err) {
      toast.error('Failed to block user.');
    }
  };

  const handleUnblockUser = async () => {
    if (!currentUser || !targetUid) return;
    try {
      await unblockUser(targetUid, currentUser);
      toast.success(`Unblocked ${targetName}.`);
    } catch (err) {
      toast.error('Failed to unblock user.');
    }
  };

  const handleDeleteMessage = async (msg: DirectMessage) => {
    if (!currentUser || !conversationId) return;
    if (!window.confirm('Delete this message?')) return;
    try {
      await deleteDirectMessage(conversationId, msg.id, currentUser);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete message.');
    }
  };

  const handleLoadOlder = useCallback(async () => {
    if (!conversationId || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await getDirectMessagesPaginated(conversationId, 30, olderLastDoc);
      if (res.messages.length > 0) {
        setMessages((prev) => [...res.messages, ...prev]);
        setOlderLastDoc(res.lastDoc);
        setHasOlderMessages(res.messages.length === 30);
      } else {
        setHasOlderMessages(false);
      }
    } catch (err) {
      toast.error('Failed to load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, olderLastDoc, loadingOlder]);

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-5rem)] flex flex-col py-4 px-3 sm:px-4">
      {/* Header Bar */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-lg shrink-0">
        <div className="flex items-center gap-3 truncate">
          <BackButton customFallback="/messages" />

          <div className="truncate">
            <h2 className="text-sm font-bold text-white truncate flex items-center gap-2">
              <span>{targetName}</span>
              {isBlocked && (
                <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-[10px] font-bold">
                  BLOCKED
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isTargetOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
              <span>{isTargetOnline ? 'Online' : 'Offline'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isBlocked && (
            <button
              onClick={async () => {
                try {
                  const nextMuted = !isMuted;
                  await muteConversationPref(conversationId!, nextMuted, nextMuted ? 1440 : null, currentUser!);
                  setIsMuted(nextMuted);
                  toast.success(nextMuted ? 'Muted notifications for 24h' : 'Notifications unmuted');
                } catch {
                  toast.error('Failed to update mute state');
                }
              }}
              className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all"
              title={isMuted ? "Unmute Notifications" : "Mute Notifications"}
            >
              {isMuted ? <BellOff className="w-4 h-4 text-amber-500" /> : <Bell className="w-4 h-4" />}
            </button>
          )}

          {isBlocked ? (
            blockedByMe && (
              <button
                onClick={handleUnblockUser}
                className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-xl border border-indigo-500/30 text-xs font-bold transition-all"
              >
                Unblock
              </button>
            )
          ) : (
            <button
              onClick={handleBlockUser}
              className="p-2 bg-slate-950 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded-xl border border-slate-800"
              title="Block User"
            >
              <UserX className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Message Request Banner */}
      {isPendingRequest && (
        <div className="my-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl space-y-2 shrink-0">
          <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
            <ShieldAlert className="w-4 h-4 text-purple-400" />
            <span>Message Request from {targetName}</span>
          </div>
          <p className="text-xs text-slate-400">
            Accepting allows {targetName} to message you. You can decline or block anytime.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleAcceptRequest}
              className="px-4 py-1.5 bg-purple-500 hover:bg-purple-400 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept</span>
            </button>
            <button
              onClick={handleDeclineRequest}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Decline</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Messages List */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 px-1">
        {/* Load Earlier Button */}
        {hasOlderMessages && (
          <div className="flex justify-center py-2">
            <button
              onClick={handleLoadOlder}
              disabled={loadingOlder}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-400 hover:text-white rounded-xl transition-all"
            >
              {loadingOlder ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ChevronUp className="w-3.5 h-3.5" />}
              <span>Load earlier messages</span>
            </button>
          </div>
        )}
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
            <span>Loading private conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center space-y-2 text-slate-500">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-xs italic">No messages yet. Send a message to start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.uid;
            const isDeleted = msg.status === 'deleted';

            const msgTime = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now();
            const canEdit = isMe && !isDeleted && (Date.now() - msgTime < 15 * 60 * 1000);

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`flex flex-col relative p-1.5 rounded-2xl transition-all duration-300 ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className={`flex items-center gap-2 group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Message Bubble itself */}
                  <div
                    className={`max-w-[70%] p-3.5 rounded-2xl space-y-1 relative ${
                      isMe
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    {msg.replyToMessageId && (
                      <div
                        onClick={() => scrollToMessage(msg.replyToMessageId!)}
                        className="mb-2 p-2 bg-slate-950/60 rounded-xl border-l-2 border-indigo-400 text-[10px] text-slate-300 truncate cursor-pointer hover:bg-slate-950/90 transition-all"
                        title="Jump to original message"
                      >
                        <span className="font-bold text-indigo-300 block">Replying to:</span>
                        {msg.replyToPreview}
                      </div>
                    )}

                    {isDeleted ? (
                      <p className="text-xs italic text-slate-400">This message was deleted.</p>
                    ) : msg.messageType === 'image' && msg.attachment ? (
                      <div className="space-y-1">
                        <img src={msg.attachment.url} alt={msg.attachment.filename} className="max-w-full rounded-lg object-cover max-h-60" />
                        {msg.content && <p className="text-xs mt-1">{msg.content}</p>}
                      </div>
                    ) : msg.messageType === 'video' && msg.attachment ? (
                      <div className="space-y-1">
                        <video src={msg.attachment.url} controls className="max-w-full rounded-lg max-h-60" />
                        {msg.content && <p className="text-xs mt-1">{msg.content}</p>}
                      </div>
                    ) : msg.messageType === 'file' && msg.attachment ? (
                      <div className="flex items-center gap-2 p-2 bg-slate-950/40 rounded-xl border border-slate-800">
                        <File className="w-4 h-4 text-indigo-400 shrink-0" />
                        <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-300 hover:underline truncate max-w-[200px]">
                          {msg.attachment.filename}
                        </a>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        {msg.isEdited && (
                          <span className="text-[9px] text-indigo-300/70 italic block mt-0.5">edited</span>
                        )}
                      </div>
                    )}

                    {/* Emoji Reaction Picker Dropdown */}
                    {activeReactionPickerMsgId === msg.id && (
                      <div className="absolute z-20 bottom-full mb-1 flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-2 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                        {['👍', '❤️', '😂', '🎉', '🤝', '💡'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              toggleDMReaction(conversationId!, msg.id, currentUser!.uid, emoji);
                              setActiveReactionPickerMsgId(null);
                            }}
                            className="hover:scale-130 active:scale-95 transition-transform text-sm p-0.5"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Toolbar next to bubble */}
                  {!isDeleted && (
                    <div className="flex items-center gap-0.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 p-1 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md">
                      <button
                        onClick={() => setActiveReactionPickerMsgId(activeReactionPickerMsgId === msg.id ? null : msg.id)}
                        className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                        title="React"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setReplyingTo(msg)}
                        className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                        title="Reply"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => {
                            setEditingMsg(msg);
                            setInputContent(msg.content);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors"
                          title="Edit Message"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setForwardingMsg(msg)}
                        className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                        title="Forward"
                      >
                        <Forward className="w-3.5 h-3.5" />
                      </button>
                      {isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg)}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Reaction Summary Pills */}
                {msg.reactionCounts && Object.keys(msg.reactionCounts).length > 0 && (
                  <div className="flex items-center gap-1 px-1 mt-1 flex-wrap">
                    {Object.entries(msg.reactionCounts)
                      .filter(([_, count]) => count > 0)
                      .map(([emoji, count]) => (
                        <button
                           key={emoji}
                           onClick={() => toggleDMReaction(conversationId!, msg.id, currentUser!.uid, emoji)}
                           className="flex items-center gap-1 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800/60 rounded-full px-2 py-0.5 text-[9px] transition-all"
                        >
                          <span>{emoji}</span>
                          <span className="text-slate-400 font-bold">{count}</span>
                        </button>
                      ))}
                  </div>
                )}

                <span className="text-[10px] text-slate-500 px-1 mt-1 font-mono">
                  {msg.createdAt
                    ? typeof msg.createdAt.toDate === 'function'
                      ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />

        {/* Typing Indicator */}
        {typingUids.length > 0 && (
          <div className="flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2 px-1">
            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center shrink-0">
              <User className="w-3 h-3" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-none px-4 py-3">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
            <span className="text-[10px] text-slate-500 self-end pb-1">
              {targetName} is typing...
            </span>
          </div>
        )}
      </div>

      {/* Replying Status Strip */}
      {replyingTo && (
        <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl mb-2 shrink-0 animate-in fade-in slide-in-from-bottom-2">
          <div className="truncate space-y-0.5 border-l-2 border-indigo-500 pl-3">
            <span className="text-[10px] font-bold text-indigo-400 block">
              Replying to {replyingTo.senderId === currentUser?.uid ? 'yourself' : replyingTo.senderName}
            </span>
            <p className="text-xs text-slate-400 truncate">
              {replyingTo.messageType === 'text' ? replyingTo.content : `[${replyingTo.messageType.toUpperCase()}]`}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-slate-500 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editing Status Strip */}
      {editingMsg && (
        <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl mb-2 shrink-0 animate-in fade-in slide-in-from-bottom-2">
          <div className="truncate space-y-0.5 border-l-2 border-amber-500 pl-3">
            <span className="text-[10px] font-bold text-amber-400 block">
              Editing Message
            </span>
            <p className="text-xs text-slate-400 truncate">
              {editingMsg.content}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingMsg(null);
              setInputContent('');
            }}
            className="text-slate-500 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Composer Bar */}
      {isBlocked ? (
        blockedByMe ? (
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2.5 shrink-0 shadow-lg">
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold">
              <Lock className="w-4 h-4" />
              <span>You blocked this user.</span>
            </div>
            <button
              onClick={handleUnblockUser}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              Unblock {targetName}
            </button>
          </div>
        ) : (
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs text-rose-400 font-semibold flex items-center justify-center gap-1.5 shrink-0">
            <Lock className="w-4 h-4" />
            <span>Messaging is disabled for blocked conversations.</span>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800 shrink-0">
          {uploading && (
            <div className="py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-2 text-[10px] text-slate-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Uploading media file... Please wait.</span>
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-2">
            {/* Attachment File Input */}
            <input
              type="file"
              id="dm-media-upload"
              accept="image/*,video/*,application/*"
              className="hidden"
              onChange={handleMediaUpload}
              disabled={sending || uploading}
            />
            <label
              htmlFor="dm-media-upload"
              className="p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-2xl cursor-pointer transition-all shrink-0 flex items-center justify-center"
              title="Attach photo, video or file"
            >
              <Paperclip className="w-4 h-4" />
            </label>

            <input
              type="text"
              value={inputContent}
              onChange={handleInputChange}
              placeholder={editingMsg ? "Edit message..." : "Type a private message..."}
              disabled={sending || uploading}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
            />

            <button
              type="submit"
              disabled={sending || uploading || !inputContent.trim()}
              className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all shrink-0"
            >
              {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : editingMsg ? <Check className="w-4 h-4 text-emerald-400" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}

      {/* Forward Modal */}
      {forwardingMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setForwardingMsg(null)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Forward className="w-5 h-5 text-indigo-400" />
                <span>Forward Message</span>
              </h3>
              <button onClick={() => setForwardingMsg(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 italic bg-slate-950/60 p-3 border border-slate-800 rounded-2xl truncate">
              {forwardingMsg.messageType === 'text' ? forwardingMsg.content : `[${forwardingMsg.messageType.toUpperCase()}] ${forwardingMsg.attachment?.filename || ''}`}
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {forwardChats.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500 italic">No other conversations to forward to.</p>
              ) : (
                forwardChats.map((c) => {
                  const partnerId = c.participantIds.find((id) => id !== currentUser?.uid);
                  const partnerName = partnerId && c.participantNames ? c.participantNames[partnerId] || 'Campus Peer' : 'Campus Peer';
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 p-3 bg-slate-950/80 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-white truncate">{partnerName}</span>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await sendDirectMessage(c.id, forwardingMsg.content || '', currentUser!, {
                              messageType: forwardingMsg.messageType,
                              attachment: forwardingMsg.attachment
                            });
                            toast.success(`Message forwarded to ${partnerName}!`);
                            setForwardingMsg(null);
                          } catch (err) {
                            toast.error('Failed to forward message.');
                          }
                        }}
                        className="px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-bold shadow-md transition-all shrink-0"
                      >
                        Send
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
