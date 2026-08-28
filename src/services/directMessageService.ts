import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  runTransaction, 
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { 
  DirectConversation, 
  DirectMessage, 
  ConversationStatus, 
  DirectMessageType 
} from '../types/directMessage';
import { createNotification } from './notificationService';

/**
 * Returns deterministic conversation ID for 2 participants: [uidA, uidB].sort().join('_')
 */
export const getConversationId = (uidA: string, uidB: string): string => {
  if (!uidA || !uidB) throw new Error('Two participant UIDs required.');
  return [uidA, uidB].sort().join('_');
};

/**
 * Checks if targetUid is blocked by currentUser.
 * Path: users/{uid}/blockedUsers/{blockedUid}
 */
export const isUserBlocked = async (currentUid: string, targetUid: string): Promise<boolean> => {
  if (!currentUid || !targetUid) return false;
  try {
    const blockRef = doc(db, 'users', currentUid, 'blockedUsers', targetUid);
    const snap = await getDoc(blockRef);
    return snap.exists();
  } catch (err) {
    return false;
  }
};

/**
 * Blocks a target user.
 */
export const blockUser = async (targetUid: string, targetName: string | undefined, currentUser: FirebaseUser): Promise<void> => {
  if (!currentUser || !targetUid) throw new Error('Authentication required.');
  const uid = currentUser.uid;

  const blockRef = doc(db, 'users', uid, 'blockedUsers', targetUid);
  await setDoc(blockRef, {
    blockedUid: targetUid,
    blockedName: targetName || 'Student',
    createdAt: serverTimestamp(),
  });

  const conversationId = getConversationId(uid, targetUid);
  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);

  if (convSnap.exists()) {
    await setDoc(convRef, { status: 'blocked', blockedBy: uid }, { merge: true });
  }

  logAnalyticsEvent('dm_user_blocked', { targetUid });
};

/**
 * Retrieves or creates a 1-on-1 private conversation between currentUser and targetUid.
 */
export const getOrCreateConversation = async (
  targetUid: string,
  currentUser: FirebaseUser,
  targetName?: string
): Promise<DirectConversation> => {
  if (!currentUser || !targetUid) throw new Error('Authentication required.');
  const uid = currentUser.uid;
  if (uid === targetUid) throw new Error('Self private conversations are not supported.');

  const conversationId = getConversationId(uid, targetUid);
  const convRef = doc(db, 'conversations', conversationId);
  const snap = await getDoc(convRef);

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as DirectConversation;
  }

  const blocked = await isUserBlocked(uid, targetUid);
  const sortedParticipants: [string, string] = [uid, targetUid].sort() as [string, string];

  const newConvData: Record<string, any> = {
    participantIds: sortedParticipants,
    participantNames: {
      [uid]: currentUser.displayName || 'Student',
      [targetUid]: targetName || 'Campus Student',
    },
    status: blocked ? ('blocked' as ConversationStatus) : ('pending' as ConversationStatus),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    participantMeta: {
      [uid]: { muted: false, archived: false },
      [targetUid]: { muted: false, archived: false },
    },
  };

  await setDoc(convRef, newConvData, { merge: true });
  logAnalyticsEvent('dm_conversation_opened', { conversationId });

  return { id: conversationId, ...newConvData, createdAt: new Date() } as DirectConversation;
};

/**
 * Sends a private 1-on-1 direct message.
 * Path: conversations/{conversationId}/messages/{messageId}
 */
export const sendDirectMessage = async (
  conversationId: string,
  content: string,
  currentUser: FirebaseUser,
  options?: {
    messageType?: DirectMessageType;
    attachment?: { url: string; filename: string; size?: number; mimeType?: string };
    replyToMessageId?: string;
    replyToPreview?: string;
  }
): Promise<DirectMessage> => {
  if (!currentUser || !conversationId) throw new Error('Authentication required.');
  const uid = currentUser.uid;
  const cleanContent = content.trim();

  if (!cleanContent && !options?.attachment) {
    throw new Error('Message content cannot be empty.');
  }
  if (cleanContent.length > 2000) {
    throw new Error('Message length exceeds 2000 characters limit.');
  }

  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) throw new Error('Conversation not found.');

  const convData = convSnap.data() as DirectConversation;
  if (convData.status === 'blocked') {
    throw new Error('Cannot send message in a blocked conversation.');
  }

  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const messageData = {
    conversationId,
    senderId: uid,
    senderName: currentUser.displayName || 'Student',
    senderAvatar: currentUser.photoURL || undefined,
    content: cleanContent,
    messageType: options?.messageType || 'text',
    attachment: options?.attachment || undefined,
    replyToMessageId: options?.replyToMessageId || undefined,
    replyToPreview: options?.replyToPreview || undefined,
    status: 'active' as const,
    createdAt: serverTimestamp(),
  };

  const msgDoc = await addDoc(messagesRef, messageData);
  const preview = cleanContent ? cleanContent.slice(0, 80) : `[${(options?.messageType || 'attachment').toUpperCase()}]`;

  // Update conversation parent metadata & status
  await setDoc(
    convRef,
    {
      lastMessageId: msgDoc.id,
      lastMessagePreview: preview,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: uid,
      updatedAt: serverTimestamp(),
      ...(convData.status === 'pending' ? { status: 'active' } : {}),
    },
    { merge: true }
  );

  // Targeted 1-to-1 notification for recipient
  const recipientId = convData.participantIds.find((id) => id !== uid);
  if (recipientId) {
    const isMuted = convData.participantMeta?.[recipientId]?.muted === true;
    if (!isMuted) {
      createNotification({
        recipientId,
        senderId: uid,
        type: 'chat_activity',
        title: `New Message from ${currentUser.displayName || 'Student'}`,
        message: preview,
        deepLink: `/messages/${conversationId}`,
      }).catch(() => {});
    }
    try {
      const { incrementScopeUnread } = await import('./activityStateService');
      await incrementScopeUnread(recipientId, 'messages');
    } catch (err) {
      console.error('Failed to increment messages unread state:', err);
    }
  }

  logAnalyticsEvent('dm_message_sent', { conversationId, messageType: messageData.messageType });
  return { id: msgDoc.id, ...messageData, createdAt: new Date() } as DirectMessage;
};

/**
 * Reads direct messages for a conversation (limit = 50).
 */
export const getDirectMessages = async (
  conversationId: string,
  limitCount: number = 50
): Promise<DirectMessage[]> => {
  if (!conversationId) return [];
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const boundedLimit = Math.min(50, Math.max(1, limitCount));
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(boundedLimit));

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DirectMessage[];
  } catch (err) {
    console.error(`Error reading messages for conversation ${conversationId}:`, err);
    return [];
  }
};

/**
 * Updates conversation status (e.g. Accept / Decline / Block).
 */
export const updateConversationStatus = async (
  conversationId: string,
  status: ConversationStatus,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !conversationId) throw new Error('Authentication required.');
  const convRef = doc(db, 'conversations', conversationId);
  await setDoc(convRef, { status, updatedAt: serverTimestamp() }, { merge: true });
  logAnalyticsEvent(status === 'active' ? 'dm_request_accepted' : 'dm_request_declined', { conversationId });
};

/**
 * Toggles Mute or Archive settings for currentUser.
 */
export const toggleConversationSetting = async (
  conversationId: string,
  setting: 'muted' | 'archived',
  currentUser: FirebaseUser
): Promise<boolean> => {
  if (!currentUser || !conversationId) throw new Error('Authentication required.');
  const uid = currentUser.uid;

  const convRef = doc(db, 'conversations', conversationId);
  let newValue = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(convRef);
    if (!snap.exists()) throw new Error('Conversation not found.');

    const meta = snap.data().participantMeta || {};
    const userMeta = meta[uid] || { muted: false, archived: false };
    newValue = !userMeta[setting];

    tx.update(convRef, {
      [`participantMeta.${uid}.${setting}`]: newValue,
      updatedAt: serverTimestamp(),
    });
  });

  logAnalyticsEvent(setting === 'muted' ? 'dm_conversation_muted' : 'dm_conversation_archived', { conversationId, newValue });
  return newValue;
};

/**
 * Searches campus users bounded to 10–20 candidates for starting a DM.
 */
export const searchCampusUsers = async (
  searchQuery: string,
  currentUser: FirebaseUser
): Promise<{ uid: string; displayName: string; email?: string; photoURL?: string }[]> => {
  if (!currentUser || !searchQuery.trim()) return [];
  const qLower = searchQuery.trim().toLowerCase();

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, limit(20));
    const snap = await getDocs(q);

    return snap.docs
      .map((d) => ({ uid: d.id, ...d.data() } as any))
      .filter((u) => {
        if (u.uid === currentUser.uid) return false;
        const matchName = (u.displayName || '').toLowerCase().includes(qLower);
        const matchEmail = (u.email || '').toLowerCase().includes(qLower);
        return matchName || matchEmail;
      })
      .slice(0, 10);
  } catch (err) {
    console.error('Error searching campus users for DM:', err);
    return [];
  }
};

/**
 * Deletes a conversation document.
 */
export const deleteConversation = async (conversationId: string, currentUser: FirebaseUser): Promise<void> => {
  if (!currentUser || !conversationId) throw new Error('Authentication required.');
  const convRef = doc(db, 'conversations', conversationId);
  await deleteDoc(convRef);
  logAnalyticsEvent('dm_conversation_deleted', { conversationId });
};
