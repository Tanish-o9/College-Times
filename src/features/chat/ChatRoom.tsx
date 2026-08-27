import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getChannelById } from '../../services/channelService';
import { 
  subscribeToRecentMessages, 
  getOlderMessages, 
  sendMessage,
  subscribeToTypingUsers
} from '../../services/chatService';
import { uploadChatImage, uploadChatFile, deleteChatFile } from '../../services/storageService';
import { getChannelCache, setChannelCache } from '../../services/chatCacheService';
import { subscribeToMemberPresence } from '../../services/presenceService';
import { useChatHistorySentinel } from '../../hooks/useChatHistorySentinel';
import type { Channel, ChatMessage, TypingUser, ChatFileAttachment } from '../../types/chat';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Skeleton } from '../../components/Skeleton';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  Hash, 
  Shield, 
  Users, 
  ChevronDown, 
  RefreshCw, 
  AlertCircle,
  Inbox,
  Lock,
  Search,
  Bell
} from 'lucide-react';
import { useChatAccess } from '../../hooks/useChatAccess';
import { markChannelAsRead } from '../../services/chatReadStateService';
import { ChatSearch } from './ChatSearch';

export const ChatRoom: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const { isEligible, loading: accessLoading } = useChatAccess();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null);
  const [newMessagesCount, setNewMessagesCount] = useState<number>(0);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  const targetMsgId = searchParams.get('msgId');

  // Pagination state (Scoped strictly per channelId)
  const [lastVisibleDoc, setLastVisibleDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState<boolean>(true);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Scroll Preservation & Smart Auto-scroll Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const initialScrollDoneRef = useRef<boolean>(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState<boolean>(false);

  // Scroll height snapshot ref for older history injection
  const scrollAdjustRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);

  // Subscribe to Member Realtime Presence for Active Message Authors
  useEffect(() => {
    if (messages.length === 0) return;

    const activeSenderIds = Array.from(new Set(messages.map((m) => m.senderId).filter(Boolean)));
    const unsubPresence = subscribeToMemberPresence(activeSenderIds, (pMap) => {
      setPresenceMap(pMap);
    });

    return () => {
      unsubPresence();
    };
  }, [messages]);

  // 1. Channel Metadata & Real-Time Listener (Scoped per channelId)
  useEffect(() => {
    if (!channelId || !isEligible) return;

    const currentChannelId = channelId;
    let isSubscribed = true;

    setReplyingToMessage(null);
    setTypingUsers([]);

    // Check In-Memory Cache for Instant Render
    const cachedState = getChannelCache(currentChannelId);
    if (cachedState && cachedState.messages.length > 0) {
      setMessages(cachedState.messages);
      setLastVisibleDoc(cachedState.lastDoc);
      setHasMoreHistory(cachedState.hasMore);
      setLoadingInitial(false);
    } else {
      setLoadingInitial(true);
      setMessages([]);
      setLastVisibleDoc(null);
      setHasMoreHistory(true);
    }

    setError(null);
    initialScrollDoneRef.current = false;

    // Fetch Channel Metadata
    getChannelById(currentChannelId)
      .then((c) => {
        if (isSubscribed && channelId === currentChannelId) setChannel(c);
      })
      .catch(() => {
        if (isSubscribed && channelId === currentChannelId) setError('Channel not found or inaccessible.');
      });

    // Real-Time Bounded Listener for Typing Users (Excluding Current User)
    const unsubTyping = subscribeToTypingUsers(
      currentChannelId,
      currentUser?.uid,
      (activeTypers) => {
        if (isSubscribed && channelId === currentChannelId) {
          setTypingUsers(activeTypers);
        }
      }
    );

    // Real-Time Bounded Listener (50 latest messages)
    const unsubscribe = subscribeToRecentMessages(
      currentChannelId,
      50,
      (liveMessages) => {
        if (!isSubscribed || channelId !== currentChannelId) return;

        setMessages((prevMessages) => {
          const liveIds = new Set(liveMessages.map((m) => m.id));
          const historyMessages = prevMessages.filter((m) => m.id && !liveIds.has(m.id));
          const updatedMessages = [...historyMessages, ...liveMessages];

          setChannelCache(currentChannelId, {
            messages: updatedMessages,
            lastDoc: lastVisibleDoc,
            hasMore: hasMoreHistory,
          });

          return updatedMessages;
        });

        setLoadingInitial(false);
      },
      (err) => {
        if (isSubscribed && channelId === currentChannelId) {
          setError(err.message || 'Failed to connect to real-time chat.');
          setLoadingInitial(false);
        }
      }
    );

    return () => {
      isSubscribed = false;
      unsubTyping();
      unsubscribe();
    };
  }, [channelId, currentUser]);

  // 2. Adjust Scroll Position After Ingesting Older Messages (Scroll Preservation)
  useLayoutEffect(() => {
    if (scrollAdjustRef.current && scrollContainerRef.current) {
      const { prevHeight, prevTop } = scrollAdjustRef.current;
      const newHeight = scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTop = prevTop + (newHeight - prevHeight);
      scrollAdjustRef.current = null;
    }
  }, [messages]);

  // 3. Smart Auto-Scroll & Read State Logic on Message Arrivals
  useEffect(() => {
    if (loadingInitial || messages.length === 0) return;

    const latestMsg = messages[messages.length - 1];

    if (!initialScrollDoneRef.current) {
      scrollToBottom('auto');
      initialScrollDoneRef.current = true;
    } else if (isNearBottomRef.current && !scrollAdjustRef.current) {
      scrollToBottom('smooth');
    } else if (!isNearBottomRef.current && !scrollAdjustRef.current) {
      setShowJumpToBottom(true);
      if (latestMsg && latestMsg.senderId !== currentUser?.uid) {
        setNewMessagesCount((prev) => prev + 1);
      }
    }
  }, [messages, loadingInitial]);

  // Monitor Scroll Position & Persist Read State When Near Bottom
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNear = distanceToBottom < 150;
    isNearBottomRef.current = isNear;

    if (isNear) {
      setShowJumpToBottom(false);
      setNewMessagesCount(0);
      if (messages.length > 0 && channelId && currentUser?.uid) {
        const latest = messages[messages.length - 1];
        if (latest && latest.id) {
          markChannelAsRead(currentUser.uid, channelId, latest.id);
        }
      }
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
      setShowJumpToBottom(false);
      setNewMessagesCount(0);
      if (messages.length > 0 && channelId && currentUser?.uid) {
        const latest = messages[messages.length - 1];
        if (latest && latest.id) {
          markChannelAsRead(currentUser.uid, channelId, latest.id);
        }
      }
    }
  };

  // 4. One-Time Historical Cursor Pagination with Scroll Anchor
  const handleLoadOlderHistory = async () => {
    if (!channelId || loadingHistory || !hasMoreHistory) return;

    const currentChannelId = channelId;
    const container = scrollContainerRef.current;

    if (container) {
      scrollAdjustRef.current = {
        prevHeight: container.scrollHeight,
        prevTop: container.scrollTop,
      };
    }

    setLoadingHistory(true);
    try {
      const cursorDoc = lastVisibleDoc;
      const result = await getOlderMessages(currentChannelId, cursorDoc, 30);

      if (channelId !== currentChannelId) return;

      if (result.messages.length > 0) {
        setMessages((prev) => {
          const newIds = new Set(result.messages.map((m) => m.id));
          const existingFiltered = prev.filter((m) => m.id && !newIds.has(m.id));
          const combined = [...result.messages, ...existingFiltered];

          setChannelCache(currentChannelId, {
            messages: combined,
            lastDoc: result.lastDoc,
            hasMore: result.hasMore,
          });

          return combined;
        });

        setLastVisibleDoc(result.lastDoc);
        setHasMoreHistory(result.hasMore);
      } else {
        setHasMoreHistory(false);
        scrollAdjustRef.current = null;
      }
    } catch (err: any) {
      toast.error('Failed to load older chat history.');
      scrollAdjustRef.current = null;
    } finally {
      setLoadingHistory(false);
    }
  };

  // Target message jump & temporary highlight effect for search result clicks
  useEffect(() => {
    if (!targetMsgId || loadingInitial || messages.length === 0) return;

    const el = document.getElementById(`message-${targetMsgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-sky-400', 'bg-sky-500/10');
      const timer = setTimeout(() => {
        el.classList.remove('ring-2', 'ring-sky-400', 'bg-sky-500/10');
      }, 3000);
      return () => clearTimeout(timer);
    } else if (hasMoreHistory && !loadingHistory) {
      // Auto-paginate older history to locate target message (up to max safety limit)
      handleLoadOlderHistory();
    }
  }, [targetMsgId, messages, loadingInitial, hasMoreHistory, loadingHistory]);

  // Attach Sentinel Hook for Auto-Fetch when Scrolling to Top
  useChatHistorySentinel({
    targetRef: sentinelRef,
    scrollContainerRef,
    onLoadOlder: handleLoadOlderHistory,
    hasMore: hasMoreHistory,
    isLoadingOlder: loadingHistory,
  });

  // 5. Send Message Handler (Text + Optional Image + Optional Document + Optional Reply)
  const handleSendMessage = async (
    text: string, 
    imageFile?: File | null, 
    replyToMessageId?: string, 
    replyToSnippet?: string,
    mentionedUids: string[] = [],
    docFile?: File | null
  ) => {
    if (!channelId || !currentUser) return;

    let imageUrl: string | undefined;
    let fileAttachment: ChatFileAttachment | undefined;

    try {
      // Step 1: Upload compressed image if selected
      if (imageFile) {
        toast.loading('Compressing and uploading image...', { id: 'upload-media' });
        imageUrl = await uploadChatImage(imageFile, channelId, currentUser.uid);
        toast.success('Image uploaded!', { id: 'upload-media' });
      }

      // Step 2: Upload document file if selected
      if (docFile) {
        toast.loading('Uploading document...', { id: 'upload-doc' });
        fileAttachment = await uploadChatFile(docFile, channelId, currentUser.uid);
        toast.success('Document uploaded!', { id: 'upload-doc' });
      }

      // Step 3: Send Chat Message
      await sendMessage(
        channelId, 
        text, 
        currentUser, 
        userProfile, 
        imageUrl, 
        replyToMessageId, 
        replyToSnippet,
        mentionedUids,
        fileAttachment
      );

      setReplyingToMessage(null);
      scrollToBottom('smooth');
    } catch (err: any) {
      if (fileAttachment?.storagePath) {
        deleteChatFile(fileAttachment.storagePath);
      }
      toast.error(err.message || 'Failed to send message.');
      throw err;
    }
  };

  const isAnnouncementChannel = channel?.id === 'admin-announcements' || channel?.type === 'announcement';
  const isReadOnlyForStudent = isAnnouncementChannel && userProfile?.role !== 'admin';

  const formatTypingText = () => {
    if (typingUsers.length === 0) return null;
    const names = typingUsers.map((u) => u.displayName || u.userId || 'Student');
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names[0]}, ${names[1]} and ${names.length - 2} others are typing...`;
  };

  if (!accessLoading && !isEligible) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Community Chat Unavailable</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Community Chat is currently undergoing a staged rollout or temporary maintenance. Check back soon!
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-xl text-sm transition-all"
          >
            Return to Feed
          </button>
        </div>
      </div>
    );
  }

  const typingText = formatTypingText();

  return (
    <div className="relative w-full h-[calc(100vh-4.5rem)] flex flex-col bg-slate-950 overflow-hidden">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors shrink-0"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            {isAnnouncementChannel ? <Shield className="w-5 h-5 text-purple-400" /> : <Hash className="w-5 h-5" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white truncate">
                {channel?.name || channelId || 'Chat Room'}
              </h2>
              {isAnnouncementChannel && (
                <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-black uppercase rounded">
                  Official
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {channel?.topic || channel?.description || 'Campus Community Chat'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {channel?.memberCount !== undefined && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400 font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              <span>{channel.memberCount} members</span>
            </div>
          )}

          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-sky-400 rounded-xl border border-slate-800 transition-all text-xs flex items-center gap-1.5"
            title="Search channel messages"
            aria-label="Search channel messages"
          >
            <Search className="w-4 h-4 text-sky-400" />
            <span className="hidden md:inline font-semibold text-slate-200">Search</span>
          </button>

          <button
            onClick={() => navigate(`/chat/settings?channelId=${channelId}`)}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded-xl border border-slate-800 transition-all text-xs flex items-center gap-1.5"
            title="Notification Settings"
            aria-label="Notification Settings"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline font-semibold text-slate-200">Alerts</span>
          </button>
        </div>
      </div>

      {/* Messages Viewport */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {/* Top Sentinel for IntersectionObserver */}
        <div ref={sentinelRef} className="h-2 w-full" />

        {/* Error State */}
        {error && (
          <div className="h-full flex items-center justify-center p-4">
            <div className="max-w-md w-full p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-rose-300 text-sm text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="font-semibold">{error}</p>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-rose-500/20 text-rose-200 rounded-xl text-xs font-semibold"
              >
                Return to Channels
              </button>
            </div>
          </div>
        )}

        {/* Loading Initial Skeletons */}
        {loadingInitial && !error && (
          <div className="space-y-4 py-4">
            <Skeleton variant="card" className="h-16 w-3/4" />
            <Skeleton variant="card" className="h-16 w-2/3 ml-auto" />
            <Skeleton variant="card" className="h-16 w-1/2" />
          </div>
        )}

        {/* Older History Pagination Header */}
        {!loadingInitial && !error && (
          <div className="text-center py-2 shrink-0">
            {loadingHistory ? (
              <div className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 rounded-full text-xs font-semibold text-sky-400 shadow-md inline-flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Loading older messages...</span>
              </div>
            ) : !hasMoreHistory && messages.length > 0 ? (
              <span className="text-[10px] text-slate-500 font-mono">You've reached the beginning</span>
            ) : null}
          </div>
        )}

        {/* Empty State */}
        {!loadingInitial && !error && messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
              <Inbox className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">No messages yet</h3>
              <p className="text-slate-400 text-xs mt-1">Start the conversation in #{channel?.name || 'this channel'}!</p>
            </div>
          </div>
        )}

        {/* Live Message List */}
        {!loadingInitial && !error && messages.length > 0 && (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={currentUser?.uid === msg.senderId}
              isOnline={presenceMap[msg.senderId] ?? false}
              currentUserId={currentUser?.uid}
              onReply={(msgToReply) => setReplyingToMessage(msgToReply)}
            />
          ))
        )}
      </div>

      {/* Floating Jump to Latest Button */}
      {showJumpToBottom && (
        <button
          onClick={() => scrollToBottom('smooth')}
          aria-label={newMessagesCount > 0 ? `${newMessagesCount} unread new messages` : 'Jump to latest messages'}
          className="absolute bottom-20 right-6 z-40 px-3.5 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-full shadow-2xl text-xs font-bold flex items-center gap-1.5 animate-bounce transition-all"
        >
          <span>
            {newMessagesCount > 0
              ? `↓ ${newMessagesCount} new message${newMessagesCount > 1 ? 's' : ''}`
              : 'Jump to latest'}
          </span>
          <ChevronDown className="w-4 h-4" />
        </button>
      )}

      {/* Ephemeral Typing Indicator Bar */}
      {typingText && (
        <div className="px-4 py-1 bg-slate-950/90 border-t border-slate-900 flex items-center gap-2 text-xs text-sky-400 font-medium animate-in fade-in duration-200 shrink-0">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse delay-150" />
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse delay-300" />
          </div>
          <span className="truncate">{typingText}</span>
        </div>
      )}

      {/* Message Input Footer */}
      {!loadingInitial && !error && (
        <MessageInput
          channelId={channelId}
          onSendMessage={handleSendMessage}
          replyingToMessage={replyingToMessage}
          onCancelReply={() => setReplyingToMessage(null)}
          disabled={isReadOnlyForStudent}
          placeholder={
            isReadOnlyForStudent
              ? 'Only administrators can post to official announcements.'
              : `Message #${channel?.name || 'channel'}...`
          }
        />
      )}
      {/* Search Modal Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-200">
          <ChatSearch
            currentChannelId={channelId}
            onClose={() => setIsSearchOpen(false)}
            onSelectResult={(msg) => {
              setIsSearchOpen(false);
              setSearchParams({ msgId: msg.id || '' });
            }}
          />
        </div>
      )}
    </div>
  );
};
