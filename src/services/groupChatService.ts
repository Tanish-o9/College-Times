import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  limit,
  getDocs,
  serverTimestamp,
  runTransaction,
  QueryDocumentSnapshot,
  increment,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, storage, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import type { Channel, ChatMessage, GroupChatReadState } from '../types/chat';
import type { CampusGroup } from '../types/group';
import { createNotification } from './notificationService';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * Ensures a canonical group chat channel document exists for a group.
 * Channel ID format: `group-{groupId}`
 */
export const ensureGroupChannel = async (
  groupId: string,
  currentUser: FirebaseUser,
  _userProfile?: User | null
): Promise<Channel> => {
  if (!groupId || !currentUser) {
    throw new Error('Group ID and authentication are required.');
  }

  const channelId = groupId.startsWith('group-') ? groupId : `group-${groupId}`;
  const actualGroupId = groupId.startsWith('group-') ? groupId.replace('group-', '') : groupId;

  const channelRef = doc(db, 'channels', channelId);
  const snap = await getDoc(channelRef);

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Channel;
  }

  // Fetch group metadata to populate channel title and description
  const groupRef = doc(db, 'groups', actualGroupId);
  const groupSnap = await getDoc(groupRef);

  let name = `Group ${actualGroupId}`;
  let createdBy = currentUser.uid;
  let memberCount = 1;

  if (groupSnap.exists()) {
    const groupData = groupSnap.data() as CampusGroup;
    name = groupData.name;
    createdBy = groupData.createdBy || currentUser.uid;
    memberCount = groupData.memberCount || 1;
  }

  const channelData: Channel = {
    id: channelId,
    name: `${name} Chat`,
    description: `Dedicated private group chat for ${name}.`,
    category: 'group',
    type: 'group',
    groupId: actualGroupId,
    createdAt: serverTimestamp(),
    createdBy,
    memberCount,
    isArchived: false,
  };

  const memberRef = doc(db, 'channels', channelId, 'members', currentUser.uid);

  try {
    await runTransaction(db, async (tx) => {
      tx.set(channelRef, channelData);
      tx.set(memberRef, {
        channelId,
        userId: currentUser.uid,
        role: 'member',
        joinedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    await setDoc(channelRef, channelData, { merge: true });
    await setDoc(memberRef, {
      channelId,
      userId: currentUser.uid,
      role: 'member',
      joinedAt: serverTimestamp(),
    }, { merge: true });
  }

  logAnalyticsEvent('group_chat_opened', { groupId: actualGroupId });

  return channelData;
};

/**
 * Checks if a user is an active member of the specified campus group.
 */
export const isUserGroupChatMember = async (groupId: string, uid: string): Promise<boolean> => {
  if (!groupId || !uid) return false;
  const actualGroupId = groupId.startsWith('group-') ? groupId.replace('group-', '') : groupId;

  try {
    const memberRef = doc(db, 'groups', actualGroupId, 'members', uid);
    const snap = await getDoc(memberRef);
    if (snap.exists()) return true;

    const groupRef = doc(db, 'groups', actualGroupId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const gData = groupSnap.data();
      if (gData?.createdBy === uid || (gData as any)?.ownerId === uid) {
        return true;
      }
    }

    return false;
  } catch (err) {
    return false;
  }
};

/**
 * Sends a message to a group chat channel with ZERO broadcast notification fan-out.
 * Only creates targeted notification documents for explicit @mentions and direct message replies.
 */
export const sendGroupChatMessage = async (
  groupId: string,
  content: string,
  currentUser: FirebaseUser,
  userProfile?: User | null,
  options?: {
    imageUrl?: string;
    replyToMessageId?: string;
    replyToSnippet?: string;
    mentionedUids?: string[];
    replyToAuthorId?: string;
  }
): Promise<ChatMessage> => {
  if (!groupId || !currentUser) {
    throw new Error('Authentication and group ID are required.');
  }

  const actualGroupId = groupId.startsWith('group-') ? groupId.replace('group-', '') : groupId;
  const isMember = await isUserGroupChatMember(actualGroupId, currentUser.uid);

  if (!isMember && userProfile?.role !== 'admin') {
    throw new Error('Access denied: You must be a member of this campus group to send messages.');
  }

  const channelId = groupId.startsWith('group-') ? groupId : `group-${groupId}`;
  await ensureGroupChannel(actualGroupId, currentUser, userProfile);

  const cleanText = content.trim();
  const senderName = userProfile?.displayName || currentUser.displayName || 'Campus Member';
  const senderRole = userProfile?.role === 'admin' ? 'admin' : 'student';

  const messageData: Omit<ChatMessage, 'id'> = {
    channelId,
    senderId: currentUser.uid,
    senderName,
    senderRole,
    ...(userProfile?.photoURL ? { senderAvatar: userProfile.photoURL } : {}),
    content: cleanText,
    ...(options?.imageUrl ? { imageUrl: options.imageUrl, mediaUrl: options.imageUrl } : {}),
    ...(options?.replyToMessageId ? { replyToMessageId: options.replyToMessageId } : {}),
    ...(options?.replyToSnippet ? { replyToSnippet: options.replyToSnippet } : {}),
    ...(options?.mentionedUids && options.mentionedUids.length > 0
      ? { mentionedUids: options.mentionedUids }
      : {}),
    status: 'active',
    createdAt: serverTimestamp(),
  };

  const messagesRef = collection(db, 'channels', channelId, 'messages');
  const channelRef = doc(db, 'channels', channelId);

  const newDoc = await addDoc(messagesRef, messageData);

  await updateDoc(channelRef, {
    lastMessageAt: serverTimestamp(),
    lastMessagePreview: cleanText.slice(0, 100) || '[Image]',
    lastMessageId: newDoc.id,
  }).catch(() => {});

  // --------------------------------------------------------------------------
  // TARGETED NOTIFICATIONS (ZERO FAN-OUT STRATEGY FOR 10K MEMBERS)
  // --------------------------------------------------------------------------
  // Normal messages generate 0 broadcast notification writes.
  // 1. Mention Notifications (1 per mentioned user)
  if (options?.mentionedUids && options.mentionedUids.length > 0) {
    for (const recipientId of options.mentionedUids) {
      if (recipientId !== currentUser.uid) {
        createNotification({
          recipientId,
          senderId: currentUser.uid,
          message: `${senderName} mentioned you in a group chat`,
          relatedPostId: channelId,
        });
      }
    }
    logAnalyticsEvent('group_message_mentioned', { groupId: actualGroupId });
  }

  // 2. Reply Notification (1 to original message author)
  if (options?.replyToAuthorId && options.replyToAuthorId !== currentUser.uid) {
    createNotification({
      recipientId: options.replyToAuthorId,
      senderId: currentUser.uid,
      message: `${senderName} replied to your message`,
      relatedPostId: channelId,
    });
    logAnalyticsEvent('group_message_replied', { groupId: actualGroupId });
  }

  logAnalyticsEvent('group_message_sent', { groupId: actualGroupId });

  return {
    id: newDoc.id,
    ...messageData,
    createdAt: new Date(),
  } as ChatMessage;
};

/**
 * Uploads group chat media to `groupChatMedia/{groupId}/{userId}/{filename}`.
 */
export const uploadGroupChatMedia = async (
  groupId: string,
  file: File,
  currentUser: FirebaseUser
): Promise<string> => {
  if (!file || !currentUser) {
    throw new Error('File and user authentication required.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error(`File '${file.name}' exceeds the 10MB limit.`);
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`File type '${file.type}' is not supported. Allowed: JPEG, PNG, WEBP, GIF.`);
  }

  const actualGroupId = groupId.startsWith('group-') ? groupId.replace('group-', '') : groupId;
  const cleanName = file.name.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').slice(0, 80);
  const storagePath = `groupChatMedia/${actualGroupId}/${currentUser.uid}/${Date.now()}_${cleanName}`;
  const storageRef = ref(storage, storagePath);

  const readFileAsDataUrl = (f: File): Promise<string> => {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = (e) => rej(e);
      reader.readAsDataURL(f);
    });
  };

  return new Promise<string>((resolve) => {
    let isDone = false;
    const timeoutTimer = setTimeout(async () => {
      if (!isDone) {
        isDone = true;
        console.warn(`Storage upload timed out for group chat media ${file.name}, using local Data URL fallback.`);
        try {
          const dataUrl = await readFileAsDataUrl(file);
          resolve(dataUrl);
        } catch {
          resolve('');
        }
      }
    }, 6000);

    const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });

    uploadTask.on(
      'state_changed',
      null,
      async (error) => {
        console.error('Storage error for group chat media, using fallback:', error);
        if (!isDone) {
          isDone = true;
          clearTimeout(timeoutTimer);
          try {
            const dataUrl = await readFileAsDataUrl(file);
            resolve(dataUrl);
          } catch {
            resolve('');
          }
        }
      },
      async () => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeoutTimer);
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch {
            const dataUrl = await readFileAsDataUrl(file);
            resolve(dataUrl);
          }
        }
      }
    );
  });
};

/**
 * Marks group chat as read for current user in `users/{uid}/groupChatReadState/{groupId}`.
 */
export const markGroupChatAsRead = async (
  groupId: string,
  uid: string,
  lastReadMessageId: string
): Promise<void> => {
  if (!groupId || !uid || !lastReadMessageId) return;

  const actualGroupId = groupId.startsWith('group-') ? groupId.replace('group-', '') : groupId;
  const readStateRef = doc(db, 'users', uid, 'groupChatReadState', actualGroupId);

  const data: GroupChatReadState = {
    groupId: actualGroupId,
    lastReadMessageId,
    lastReadAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(readStateRef, data, { merge: true }).catch(() => {});
};

/**
 * Toggles notification mute status for a group chat.
 */
export const toggleMuteGroupChat = async (groupId: string, uid: string): Promise<boolean> => {
  if (!groupId || !uid) return false;

  const actualGroupId = groupId.startsWith('group-') ? groupId.replace('group-', '') : groupId;
  const readStateRef = doc(db, 'users', uid, 'groupChatReadState', actualGroupId);

  const snap = await getDoc(readStateRef);
  let nextMuted = true;

  if (snap.exists()) {
    const existing = snap.data() as GroupChatReadState;
    nextMuted = !existing.isMuted;
  }

  await setDoc(readStateRef, { isMuted: nextMuted, updatedAt: serverTimestamp() }, { merge: true });
  logAnalyticsEvent('group_chat_muted', { groupId: actualGroupId, isMuted: nextMuted });

  return nextMuted;
};

/**
 * Edits a group chat message enforcing a 15-minute edit window from creation.
 */
export const editGroupMessage = async (
  channelId: string,
  messageId: string,
  newContent: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!channelId || !messageId || !newContent.trim() || !currentUser) return;

  const msgRef = doc(db, 'channels', channelId, 'messages', messageId);
  const snap = await getDoc(msgRef);

  if (!snap.exists()) {
    throw new Error('Message not found.');
  }

  const msgData = snap.data();
  if (msgData.senderId !== currentUser.uid) {
    throw new Error('Access denied: You can only edit your own messages.');
  }

  // 15-minute edit window enforcement
  const createdAtMillis = msgData.createdAt?.toMillis ? msgData.createdAt.toMillis() : (msgData.createdAt instanceof Date ? msgData.createdAt.getTime() : Date.now());
  const elapsedMinutes = (Date.now() - createdAtMillis) / (1000 * 60);

  if (elapsedMinutes > 15) {
    throw new Error('Editing window expired (messages can only be edited within 15 minutes of creation).');
  }

  await updateDoc(msgRef, {
    content: newContent.trim().slice(0, 2000),
    isEdited: true,
    editedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  logAnalyticsEvent('group_chat_message_edited', { channelId, messageId });
};

/**
 * Soft deletes a group chat message by updating status to 'deleted'.
 */
/**
 * Helper to fetch a user's role in a group.
 */
export const getUserGroupRole = async (groupId: string, uid: string): Promise<string | null> => {
  if (!groupId || !uid) return null;
  const actualGroupId = groupId.startsWith('group-') ? groupId.replace('group-', '') : groupId;
  try {
    const memberRef = doc(db, 'groups', actualGroupId, 'members', uid);
    const snap = await getDoc(memberRef);
    if (snap.exists()) {
      return snap.data().role || 'member';
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Soft deletes a group chat message by updating status to 'deleted'.
 * Author or group owners/admins/moderators can delete messages.
 */
export const deleteGroupMessage = async (
  channelId: string,
  messageId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!channelId || !messageId || !currentUser) return;

  const actualGroupId = channelId.replace('group-', '');
  const msgRef = doc(db, 'channels', channelId, 'messages', messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) return;

  const msgData = snap.data();
  const userRole = await getUserGroupRole(actualGroupId, currentUser.uid);
  const isAdminOrMod = userRole === 'owner' || userRole === 'admin' || userRole === 'moderator' || msgData.senderRole === 'admin';

  if (msgData.senderId !== currentUser.uid && !isAdminOrMod) {
    throw new Error('Access denied: Unauthorized to remove this message.');
  }

  await updateDoc(msgRef, {
    status: 'deleted',
    content: 'This message was deleted by a moderator.',
    deletedAt: serverTimestamp(),
    deletedBy: currentUser.uid,
    updatedAt: serverTimestamp(),
  });

  logAnalyticsEvent('group_chat_message_deleted', { channelId, messageId });
};

/**
 * Pins a group chat message (max 5 pins per channel, owner/admin/moderator only).
 */
export const pinGroupChatMessage = async (
  channelId: string,
  messageId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!channelId || !messageId || !currentUser) return;

  const actualGroupId = channelId.replace('group-', '');
  const userRole = await getUserGroupRole(actualGroupId, currentUser.uid);
  const isAuthorized = userRole === 'owner' || userRole === 'admin' || userRole === 'moderator';
  if (!isAuthorized) {
    throw new Error('Only owners, admins, or moderators can pin messages.');
  }

  const pinnedColRef = collection(db, 'channels', channelId, 'pinnedMessages');
  const snap = await getDocs(query(pinnedColRef, limit(10)));
  const activePins = snap.docs.filter(d => d.data().status !== 'removed');

  if (activePins.length >= 5) {
    throw new Error('Maximum limit of 5 pinned messages reached for this chat.');
  }

  const pinDocRef = doc(pinnedColRef, messageId);
  await setDoc(pinDocRef, {
    messageId,
    pinnedBy: currentUser.uid,
    pinnedAt: serverTimestamp(),
    status: 'pinned',
  });

  // Post system message
  await sendGroupChatSystemMessage(actualGroupId, `A message was pinned.`, currentUser);

  logAnalyticsEvent('group_chat_message_pinned', { channelId, messageId });
};

/**
 * Unpins a group chat message.
 */
export const unpinGroupChatMessage = async (
  channelId: string,
  messageId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!channelId || !messageId || !currentUser) return;

  const actualGroupId = channelId.replace('group-', '');
  const userRole = await getUserGroupRole(actualGroupId, currentUser.uid);
  const isAuthorized = userRole === 'owner' || userRole === 'admin' || userRole === 'moderator';
  if (!isAuthorized) {
    throw new Error('Only owners, admins, or moderators can unpin messages.');
  }

  const pinDocRef = doc(db, 'channels', channelId, 'pinnedMessages', messageId);
  await updateDoc(pinDocRef, { status: 'removed', updatedAt: serverTimestamp() });

  logAnalyticsEvent('group_chat_message_unpinned', { channelId, messageId });
};

/**
 * Searches group chat messages by text or sender (bounded max 50 results).
 */
export const searchGroupChatMessages = async (
  channelId: string,
  queryText: string,
  limitCount: number = 20
): Promise<ChatMessage[]> => {
  if (!channelId || !queryText.trim()) return [];

  const clean = queryText.trim().toLowerCase();
  const boundedSize = Math.min(50, Math.max(1, limitCount));

  const msgsRef = collection(db, 'channels', channelId, 'messages');
  const snap = await getDocs(query(msgsRef, limit(100)));

  const results: ChatMessage[] = [];
  snap.docs.forEach((d: QueryDocumentSnapshot) => {
    const data = d.data() as ChatMessage;
    const content = (data.content || '').toLowerCase();
    const sender = (data.senderName || '').toLowerCase();
    if (data.status !== 'deleted' && (content.includes(clean) || sender.includes(clean))) {
      results.push({ id: d.id, ...data });
    }
  });

  return results.slice(0, boundedSize);
};

/**
 * Sends a system notification message inside a group chat channel.
 */
export const sendGroupChatSystemMessage = async (
  groupId: string,
  content: string,
  _currentUser: FirebaseUser
): Promise<void> => {
  const channelId = groupId.startsWith('group-') ? groupId : `group-${groupId}`;
  const messagesRef = collection(db, 'channels', channelId, 'messages');
  await addDoc(messagesRef, {
    channelId,
    senderId: 'system',
    senderName: 'System',
    senderRole: 'admin',
    content,
    status: 'active',
    createdAt: serverTimestamp(),
  });
};

/**
 * Transactionally updates or toggles emoji reactions on a group chat message.
 */
export const toggleGroupMessageReaction = async (
  channelId: string,
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> => {
  if (!channelId || !messageId || !userId || !emoji) return;

  const reactionRef = doc(db, 'channels', channelId, 'messages', messageId, 'reactions', userId);
  const messageRef = doc(db, 'channels', channelId, 'messages', messageId);

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

  logAnalyticsEvent('group_message_reaction_toggled', { channelId, emoji });
};

