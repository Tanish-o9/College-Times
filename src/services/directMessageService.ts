import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc,
  query, 
  orderBy, 
  limit, 
  runTransaction, 
  serverTimestamp,
  deleteDoc,
  increment,
  startAfter,
  Timestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { ref as rtdbRef, set as rtdbSet, onValue, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, storage, rtdb, logAnalyticsEvent } from '../lib/firebase';
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
 * Unblocks a target user.
 */
export const unblockUser = async (targetUid: string, currentUser: FirebaseUser): Promise<void> => {
  if (!currentUser || !targetUid) throw new Error('Authentication required.');
  const uid = currentUser.uid;

  const blockRef = doc(db, 'users', uid, 'blockedUsers', targetUid);
  await deleteDoc(blockRef);

  const conversationId = getConversationId(uid, targetUid);
  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);

  if (convSnap.exists()) {
    const convData = convSnap.data() as DirectConversation;
    if (convData.status === 'blocked' && convData.blockedBy === uid) {
      await setDoc(convRef, { status: 'active', blockedBy: null }, { merge: true });
    }
  }

  logAnalyticsEvent('dm_user_unblocked', { targetUid });
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

  const blocked = (await isUserBlocked(uid, targetUid)) || (await isUserBlocked(targetUid, uid));
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
    replyTo?: { messageId: string; senderId: string; preview: string };
    forwardedFromMessageId?: string;
    forwardedFromConversationId?: string;
    originalSenderId?: string;
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
    replyTo: options?.replyTo || undefined,
    forwardedFromMessageId: options?.forwardedFromMessageId || undefined,
    forwardedFromConversationId: options?.forwardedFromConversationId || undefined,
    originalSenderId: options?.originalSenderId || undefined,
    status: 'active' as const,
    createdAt: serverTimestamp(),
  };

  const msgDoc = await addDoc(messagesRef, messageData);
  const preview = cleanContent ? cleanContent.slice(0, 80) : `[${(options?.messageType || 'attachment').toUpperCase()}]`;

  // Update conversation parent metadata & status
  const recipientId = convData.participantIds.find((id) => id !== uid);
  await setDoc(
    convRef,
    {
      lastMessageId: msgDoc.id,
      lastMessagePreview: preview,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: uid,
      updatedAt: serverTimestamp(),
      ...(convData.status === 'pending' ? { status: 'active' } : {}),
      ...(recipientId ? { [`unreadCounts.${recipientId}`]: increment(1) } : {}),
    },
    { merge: true }
  );

  // Targeted 1-to-1 notification for recipient
  if (recipientId) {
    let isMuted = convData.participantMeta?.[recipientId]?.muted === true;
    try {
      const prefRef = doc(db, 'users', recipientId, 'conversationPreferences', conversationId);
      const prefSnap = await getDoc(prefRef);
      if (prefSnap.exists()) {
        const prefData = prefSnap.data();
        if (prefData.muted === true) {
          if (prefData.mutedUntil) {
            const until = prefData.mutedUntil.toDate ? prefData.mutedUntil.toDate() : new Date(prefData.mutedUntil);
            if (until.getTime() > Date.now()) {
              isMuted = true;
            }
          } else {
            isMuted = true;
          }
        }
      }
    } catch {
      // fallback to participantMeta if error
    }

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

/**
 * Transactionally toggles or updates an emoji reaction on a DM message.
 */
export const toggleDMReaction = async (
  conversationId: string,
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> => {
  if (!conversationId || !messageId || !userId || !emoji) return;

  const reactionRef = doc(db, 'conversations', conversationId, 'messages', messageId, 'reactions', userId);
  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

  await runTransaction(db, async (transaction) => {
    const messageSnap = await transaction.get(messageRef);
    if (!messageSnap.exists()) {
      throw new Error('Message no longer exists.');
    }

    const reactionSnap = await transaction.get(reactionRef);

    if (!reactionSnap.exists()) {
      transaction.set(reactionRef, {
        emoji,
        userId,
        createdAt: serverTimestamp(),
      });
      transaction.update(messageRef, {
        [`reactionCounts.${emoji}`]: increment(1),
      });
    } else {
      const existingEmoji = reactionSnap.data().emoji;

      if (existingEmoji === emoji) {
        transaction.delete(reactionRef);
        const currentCounts = messageSnap.data().reactionCounts || {};
        const currentVal = currentCounts[emoji] || 0;
        const newVal = Math.max(0, currentVal - 1);
        transaction.update(messageRef, {
          [`reactionCounts.${emoji}`]: newVal,
        });
      } else {
        transaction.set(reactionRef, {
          emoji,
          userId,
          updatedAt: serverTimestamp(),
        });
        const currentCounts = messageSnap.data().reactionCounts || {};
        const oldVal = currentCounts[existingEmoji] || 0;
        const newOldVal = Math.max(0, oldVal - 1);
        transaction.update(messageRef, {
          [`reactionCounts.${existingEmoji}`]: newOldVal,
          [`reactionCounts.${emoji}`]: increment(1),
        });
      }
    }
  });

  logAnalyticsEvent('dm_reaction_toggled', { conversationId, emoji });
};

/**
 * Uploads media (photo/video) for a private conversation.
 * Path: dmMedia/{conversationId}/{userId}/{timestamp}_{filename}
 */
export const uploadDMMedia = async (
  file: File,
  conversationId: string,
  userId: string
): Promise<string> => {
  if (!file || !conversationId || !userId) {
    throw new Error('File, Conversation ID, and User ID are required.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Media files must be 10MB or smaller.');
  }

  const timestamp = Date.now();
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `dmMedia/${conversationId}/${userId}/${timestamp}_${cleanFileName}`;

  const mediaRef = storageRef(storage, storagePath);
  await uploadBytes(mediaRef, file);

  const downloadURL = await getDownloadURL(mediaRef);
  return downloadURL;
};

/**
 * Sets / clears typing indicator in RTDB for a conversation.
 * Path: typing/{conversationId}/{uid}
 * Auto-expires: caller should clear after 3s of inactivity.
 */
export const setTypingIndicator = (
  conversationId: string,
  uid: string,
  isTyping: boolean
): void => {
  if (!conversationId || !uid) return;
  const typingRef = rtdbRef(rtdb, `typing/${conversationId}/${uid}`);
  rtdbSet(typingRef, isTyping ? { typing: true, at: rtdbServerTimestamp() } : null).catch(() => {});
};

/**
 * Subscribes to typing indicators in a conversation.
 * Returns unsubscribe function.
 */
export const subscribeToTypingIndicators = (
  conversationId: string,
  currentUid: string,
  callback: (typingUids: string[]) => void
): (() => void) => {
  if (!conversationId) return () => {};
  const typingConvRef = rtdbRef(rtdb, `typing/${conversationId}`);

  const unsubscribe = onValue(typingConvRef, (snapshot) => {
    const data = snapshot.val() as Record<string, { typing: boolean }> | null;
    if (!data) {
      callback([]);
      return;
    }
    const typingUids = Object.entries(data)
      .filter(([uid, val]) => uid !== currentUid && val?.typing === true)
      .map(([uid]) => uid);
    callback(typingUids);
  });

  return () => unsubscribe();
};

/**
 * Soft-deletes a DM message (sets status = 'deleted', clears content).
 * Only the original sender may delete their own message.
 */
export const deleteDirectMessage = async (
  conversationId: string,
  messageId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !conversationId || !messageId) throw new Error('Authentication required.');

  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  const snap = await getDoc(messageRef);
  if (!snap.exists()) throw new Error('Message not found.');

  const data = snap.data();
  if (data.senderId !== currentUser.uid) {
    throw new Error('You can only delete your own messages.');
  }

  await updateDoc(messageRef, {
    status: 'deleted',
    content: '',
    deletedAt: serverTimestamp(),
  });

  logAnalyticsEvent('dm_message_deleted', { conversationId, messageId });
};

/**
 * Fetches paginated messages for a conversation (cursor-based).
 */
export const getDirectMessagesPaginated = async (
  conversationId: string,
  limitCount: number = 30,
  lastVisibleDoc?: QueryDocumentSnapshot | null
): Promise<{ messages: DirectMessage[]; lastDoc: QueryDocumentSnapshot | null }> => {
  if (!conversationId) return { messages: [], lastDoc: null };
  const bounded = Math.min(50, Math.max(1, limitCount));
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  // Load newest messages: orderBy desc, then reverse for display
  const q = lastVisibleDoc
    ? query(messagesRef, orderBy('createdAt', 'desc'), startAfter(lastVisibleDoc), limit(bounded))
    : query(messagesRef, orderBy('createdAt', 'desc'), limit(bounded));

  const snap = await getDocs(q);
  const messages = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as DirectMessage)
    .reverse(); // Display oldest → newest
  const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { messages, lastDoc: newLastDoc };
};

/**
 * Marks a conversation as read for the current user.
 * Updates participantMeta.{uid}.lastReadAt
 */
export const updateConversationReadState = async (
  conversationId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !conversationId) return;
  const convRef = doc(db, 'conversations', conversationId);
  await setDoc(
    convRef,
    {
      [`participantMeta.${currentUser.uid}.lastReadAt`]: serverTimestamp(),
      [`unreadCounts.${currentUser.uid}`]: 0,
    },
    { merge: true }
  ).catch(() => {});
};

/**
 * Edits a message sent by the current user within 15 minutes.
 */
export const editDirectMessage = async (
  conversationId: string,
  messageId: string,
  newContent: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !conversationId || !messageId) throw new Error('Authentication required.');
  const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(msgRef);
    if (!snap.exists()) throw new Error('Message not found.');

    const data = snap.data();
    if (data.senderId !== currentUser.uid) {
      throw new Error('Only the author can edit this message.');
    }

    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : (data.createdAt ? new Date(data.createdAt).getTime() : Date.now());
    if (Date.now() - createdAt > 15 * 60 * 1000) {
      throw new Error('The edit window (15 minutes) has expired.');
    }

    tx.update(msgRef, {
      content: newContent.trim().slice(0, 2000),
      editedAt: serverTimestamp(),
      isEdited: true,
      updatedAt: serverTimestamp(),
    });
  });
};

/**
 * Forwards a message from one conversation to another.
 */
export const forwardDirectMessage = async (
  sourceConversationId: string,
  destinationConversationId: string,
  messageId: string,
  currentUser: FirebaseUser
): Promise<DirectMessage> => {
  if (!currentUser || !sourceConversationId || !destinationConversationId || !messageId) {
    throw new Error('All parameters required.');
  }

  const srcConvRef = doc(db, 'conversations', sourceConversationId);
  const srcSnap = await getDoc(srcConvRef);
  if (!srcSnap.exists()) throw new Error('Source conversation not found.');
  const srcData = srcSnap.data() as DirectConversation;
  if (!srcData.participantIds.includes(currentUser.uid)) {
    throw new Error('Access denied to source conversation.');
  }

  const dstConvRef = doc(db, 'conversations', destinationConversationId);
  const dstSnap = await getDoc(dstConvRef);
  if (!dstSnap.exists()) throw new Error('Destination conversation not found.');
  const dstData = dstSnap.data() as DirectConversation;
  if (!dstData.participantIds.includes(currentUser.uid)) {
    throw new Error('Access denied to destination conversation.');
  }

  const msgRef = doc(db, 'conversations', sourceConversationId, 'messages', messageId);
  const msgSnap = await getDoc(msgRef);
  if (!msgSnap.exists()) throw new Error('Message not found.');
  const msgData = msgSnap.data();

  return sendDirectMessage(destinationConversationId, msgData.content || '', currentUser, {
    messageType: msgData.messageType || 'text',
    attachment: msgData.attachment || undefined,
    forwardedFromMessageId: messageId,
    forwardedFromConversationId: sourceConversationId,
    originalSenderId: msgData.senderId,
  });
};

/**
 * Saves mute preference for a conversation under users/{uid}/conversationPreferences/{conversationId}
 */
export const muteConversationPref = async (
  conversationId: string,
  muted: boolean,
  durationMinutes: number | null,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !conversationId) throw new Error('Authentication required.');
  const uid = currentUser.uid;
  const prefRef = doc(db, 'users', uid, 'conversationPreferences', conversationId);

  const now = new Date();
  const mutedUntil = (muted && durationMinutes) ? new Date(now.getTime() + durationMinutes * 60 * 1000) : null;

  await setDoc(prefRef, {
    muted,
    mutedUntil: mutedUntil ? Timestamp.fromDate(mutedUntil) : null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

