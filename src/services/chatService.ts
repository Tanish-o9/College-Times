import { 
  collection, 
  doc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  getDocs, 
  getDoc,
  startAfter, 
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction, 
  serverTimestamp,
  type QueryDocumentSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { ChatMessage, TypingUser, ChatFileAttachment } from '../types/chat';
import type { User } from '../types';
import { isContentBlocked } from '../config/chatModeration';

export interface PaginatedChatResult {
  messages: ChatMessage[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Bounded real-time listener for latest messages in a channel.
 * STRICT SCALE RULE: Always capped at windowSize (default: 50). Never unbounded.
 * Returns a deterministic cleanup function that can be called safely multiple times.
 */
export const subscribeToRecentMessages = (
  channelId: string,
  windowSize: number = 50,
  onUpdate: (messages: ChatMessage[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  if (!channelId) {
    onUpdate([]);
    return () => {};
  }

  const messagesRef = collection(db, 'channels', channelId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(windowSize));

  let unsubscribed = false;

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      if (unsubscribed) return;
      const liveMessages = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .reverse() as ChatMessage[]; // Reverse to chronological order (oldest -> newest)

      onUpdate(liveMessages);
    },
    (error) => {
      console.error(`Error in chat subscription for channel ${channelId}:`, error);
      if (onError && !unsubscribed) onError(error);
    }
  );

  return () => {
    if (!unsubscribed) {
      unsubscribed = true;
      unsub();
    }
  };
};

/**
 * Backward compatibility alias for subscribeToRecentMessages.
 */
export const subscribeToLatestMessages = subscribeToRecentMessages;

/**
 * One-time cursor pagination for scrolling up into older message history.
 * STRICT SCALE RULE: Uses one-time getDocs with startAfter(). Never onSnapshot.
 */
export const getOlderMessages = async (
  channelId: string,
  beforeDoc?: QueryDocumentSnapshot | null,
  pageSize: number = 30
): Promise<PaginatedChatResult> => {
  if (!channelId) return { messages: [], lastDoc: null, hasMore: false };

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages');
    const q = beforeDoc
      ? query(messagesRef, orderBy('createdAt', 'desc'), startAfter(beforeDoc), limit(pageSize))
      : query(messagesRef, orderBy('createdAt', 'desc'), limit(pageSize));

    const snapshot = await getDocs(q);
    const messages = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      .reverse() as ChatMessage[];

    const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    const hasMore = snapshot.docs.length >= pageSize;

    return { messages, lastDoc: newLastDoc, hasMore };
  } catch (error) {
    console.error(`Error fetching older messages for channel ${channelId}:`, error);
    throw error;
  }
};

/**
 * Backward compatibility alias for getOlderMessages.
 */
export const getOlderMessagesPage = getOlderMessages;

/**
 * Sends a message to a channel with server-side moderation, rate-limiting, and mention notifications.
 */
export const sendMessage = async (
  channelId: string,
  content: string,
  currentUser: FirebaseUser,
  userProfile?: User | null,
  imageUrl?: string,
  replyToMessageId?: string,
  replyToSnippet?: string,
  mentionedUids: string[] = [],
  attachment?: ChatFileAttachment
): Promise<ChatMessage> => {
  const cleanContent = content.trim();
  if (!cleanContent && !imageUrl && !attachment) {
    throw new Error('Message must contain text, an image, or a file attachment.');
  }

  if (cleanContent.length > 1000) {
    throw new Error('Message length exceeds 1000 characters limit.');
  }

  // 1. Server-Side Word Filter Check
  const blockedCheck = isContentBlocked(cleanContent);
  if (blockedCheck.isBlocked) {
    throw new Error(`This message contains blocked content ("${blockedCheck.term}").`);
  }

  try {
    const channelRef = doc(db, 'channels', channelId);
    const channelSnap = await getDoc(channelRef);
    if (!channelSnap.exists()) {
      throw new Error(`Channel ${channelId} does not exist.`);
    }

    if (channelSnap.data().isArchived) {
      throw new Error('Channel is archived and cannot receive new messages.');
    }

    // 2. Server-Side Mute & Membership Check
    const memberRef = doc(db, 'channels', channelId, 'members', currentUser.uid);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists() && memberSnap.data().muted === true) {
      throw new Error("You've been muted in this channel by a moderator.");
    }
    if (!memberSnap.exists() && userProfile?.role !== 'admin') {
      throw new Error('You must be a member of this channel to send messages.');
    }

    // 3. Server-Side Transactional Rate Limiting (10 msgs / 30s)
    const userRef = doc(db, 'users', currentUser.uid);
    const now = Date.now();

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists()) {
        const timestamps: number[] = userSnap.data().recentMessageTimestamps || [];
        const validTimestamps = timestamps.filter((ts) => now - ts < 30000);

        if (validTimestamps.length >= 10 && userProfile?.role !== 'admin') {
          throw new Error('Rate limit exceeded. You can send at most 10 messages per 30 seconds.');
        }

        transaction.update(userRef, {
          recentMessageTimestamps: [...validTimestamps, now],
        });
      }
    });

    const messagesRef = collection(db, 'channels', channelId, 'messages');
    const newMessageRef = doc(messagesRef);

    const senderName = userProfile?.displayName || currentUser.displayName || 'Student';
    const senderRole = userProfile?.role || 'student';

    // Deduplicate & cap mentions at 20 max, excluding self
    const cleanMentions = Array.from(new Set(mentionedUids))
      .filter((uid) => uid && typeof uid === 'string' && uid !== currentUser.uid)
      .slice(0, 20);

    const messageData: ChatMessage = {
      id: newMessageRef.id,
      channelId,
      senderId: currentUser.uid,
      senderName,
      senderRole,
      ...(currentUser.photoURL ? { senderAvatar: currentUser.photoURL } : {}),
      content: cleanContent,
      ...(imageUrl ? { imageUrl } : {}),
      ...(attachment ? { attachment } : {}),
      ...(replyToMessageId ? { replyToMessageId, replyToSnippet } : {}),
      mentionedUids: cleanMentions,
      reactionCounts: {},
      reportCount: 0,
      status: 'active',
      createdAt: serverTimestamp(),
    };

    const previewText = cleanContent || (attachment ? `📄 ${attachment.name}` : '[Image]');
    const lastPreview = previewText.length > 100 ? `${previewText.slice(0, 97)}...` : previewText;

    await runTransaction(db, async (transaction) => {
      transaction.set(newMessageRef, messageData);
      transaction.update(channelRef, {
        lastMessageAt: serverTimestamp(),
        lastMessagePreview: lastPreview,
        lastMessageId: newMessageRef.id,
      });
    });

    logAnalyticsEvent('chat_message_sent', { 
      channelId, 
      hasImage: !!imageUrl, 
      hasFile: !!attachment,
      isReply: !!replyToMessageId,
      mentionCount: cleanMentions.length 
    });

    return {
      ...messageData,
      createdAt: new Date(),
    };
  } catch (error: any) {
    console.error('Error sending chat message:', error);
    throw new Error(error.message || 'Failed to send message.');
  }
};

// Throttling map for client typing writes (at most once every 3000ms per channel)
const lastTypingWriteMap = new Map<string, number>();

/**
 * Bounded real-time listener for typing users in a channel.
 * STRICT SCALE RULE:
 * 1. Capped at limit(10).
 * 2. Filters out current user (currentUserId).
 * 3. Filters out expired items (> 5s old).
 */
export const subscribeToTypingUsers = (
  channelId: string,
  currentUserId: string | undefined,
  onUpdate: (typingUsers: TypingUser[]) => void
): Unsubscribe => {
  if (!channelId) {
    onUpdate([]);
    return () => {};
  }

  const typingRef = collection(db, 'channels', channelId, 'typing');
  const q = query(typingRef, limit(10));

  let unsubscribed = false;

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      if (unsubscribed) return;
      const now = Date.now();
      const activeTyping = snapshot.docs
        .map((d) => d.data() as TypingUser)
        .filter((t) => {
          if (!t || !t.userId) return false;
          if (currentUserId && t.userId === currentUserId) return false; // Exclude current user
          const tTime = t.timestamp?.toMillis ? t.timestamp.toMillis() : Date.now();
          return now - tTime < 5000; // Only show active typing within 5s window
        });

      onUpdate(activeTyping);
    },
    (error) => {
      console.error('Error in typing status listener:', error);
    }
  );

  return () => {
    if (!unsubscribed) {
      unsubscribed = true;
      unsub();
    }
  };
};

/**
 * Throttled write for setting or clearing typing status in a channel.
 * Throttles writes to at most once per 3000ms to protect Firestore write quotas at 10,000-user scale.
 */
export const setTypingStatus = async (
  channelId: string,
  userId: string,
  displayName: string,
  isTyping: boolean
): Promise<void> => {
  if (!channelId || !userId) return;

  const typingDocRef = doc(db, 'channels', channelId, 'typing', userId);
  const cacheKey = `${channelId}_${userId}`;
  const now = Date.now();

  try {
    if (isTyping) {
      const lastWrite = lastTypingWriteMap.get(cacheKey) || 0;
      if (now - lastWrite < 3000) {
        return; // Throttled: skip write
      }
      lastTypingWriteMap.set(cacheKey, now);

      await setDoc(typingDocRef, {
        userId,
        displayName,
        timestamp: serverTimestamp(),
        expiresAt: now + 5000,
      });
    } else {
      lastTypingWriteMap.delete(cacheKey);
      await deleteDoc(typingDocRef);
    }
  } catch (err) {
    // Ephemeral typing errors fail silently
  }
};

/**
 * Edits the content of an active message sent by the current user within 15 minutes.
 */
export const editMessage = async (
  channelId: string,
  messageId: string,
  currentUser: FirebaseUser,
  newContent: string
): Promise<void> => {
  if (!channelId || !messageId || !currentUser?.uid) {
    throw new Error('Authentication and IDs required to edit message.');
  }

  const cleanText = newContent.trim();
  if (cleanText.length > 1000) {
    throw new Error('Message length exceeds 1000 characters limit.');
  }

  const blockedCheck = isContentBlocked(cleanText);
  if (blockedCheck.isBlocked) {
    throw new Error(`This message contains blocked content ("${blockedCheck.term}").`);
  }

  const msgRef = doc(db, 'channels', channelId, 'messages', messageId);
  const snap = await getDoc(msgRef);

  if (!snap.exists()) {
    throw new Error('Message not found.');
  }

  const msgData = snap.data() as ChatMessage;

  if (msgData.status !== 'active') {
    throw new Error('Cannot edit a deleted or hidden message.');
  }

  if (msgData.senderId !== currentUser.uid) {
    throw new Error('You can only edit your own messages.');
  }

  // 15-minute edit window check
  const createdAtMs = msgData.createdAt?.toMillis ? msgData.createdAt.toMillis() : 0;
  if (createdAtMs > 0 && Date.now() - createdAtMs > 15 * 60 * 1000) {
    throw new Error('Messages can only be edited within 15 minutes of sending.');
  }

  if (!cleanText && !msgData.imageUrl && !msgData.attachment) {
    throw new Error('Message cannot be completely empty.');
  }

  try {
    await updateDoc(msgRef, {
      content: cleanText,
      editedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    logAnalyticsEvent('chat_message_edited', {
      channelId,
      messageType: msgData.attachment ? 'file' : msgData.imageUrl ? 'image' : 'text',
    });
  } catch (err: any) {
    console.error('Error editing chat message:', err);
    throw new Error(err.message || 'Failed to edit message.');
  }
};

/**
 * Soft-deletes a message (User or Admin).
 * Sets status to 'deleted', stores deletedAt timestamp and deletedBy UID.
 */
export const deleteMessage = async (
  channelId: string,
  messageId: string,
  currentUser: FirebaseUser,
  userRole?: string
): Promise<void> => {
  if (!channelId || !messageId || !currentUser?.uid) {
    throw new Error('Authentication and IDs required to delete message.');
  }

  const msgRef = doc(db, 'channels', channelId, 'messages', messageId);
  const snap = await getDoc(msgRef);

  if (!snap.exists()) {
    throw new Error('Message not found.');
  }

  const msgData = snap.data() as ChatMessage;

  if (msgData.status === 'deleted') {
    return;
  }

  const isOwner = msgData.senderId === currentUser.uid;
  const isAdmin = userRole === 'admin';

  if (!isOwner && !isAdmin) {
    throw new Error('You do not have permission to delete this message.');
  }

  try {
    await updateDoc(msgRef, {
      status: 'deleted',
      deletedAt: serverTimestamp(),
      deletedBy: currentUser.uid,
      updatedAt: serverTimestamp(),
    });

    logAnalyticsEvent('chat_message_deleted', {
      channelId,
      messageType: msgData.attachment ? 'file' : msgData.imageUrl ? 'image' : 'text',
    });
  } catch (err: any) {
    console.error('Error deleting chat message:', err);
    throw new Error(err.message || 'Failed to delete message.');
  }
};
