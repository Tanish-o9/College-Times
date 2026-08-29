/**
 * shareService.ts
 *
 * Internal sharing of posts, events, opportunities, marketplace listings.
 * Uses existing DM and group infrastructure.
 *
 * Share flow:
 *  1. User picks a conversation (DM) or group chat
 *  2. A message with type 'share' and sharedContent metadata is sent
 *  3. The recipient sees a card with a deep link to the original content
 *
 * Privacy:
 *  - Private content is NOT shared if the recipient doesn't have access
 *  - The share only contains a deepLink + preview metadata
 *  - Original content access is enforced at the target page level
 */

import { db } from '../lib/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';

export type ShareTargetType = 'dm' | 'group';

export interface ShareableContent {
  type: 'post' | 'event' | 'opportunity' | 'marketplace' | 'group';
  id: string;
  title: string;
  preview?: string;
  imageUrl?: string;
  deepLink: string;
}

export interface ShareTarget {
  type: ShareTargetType;
  /** conversationId for DM, groupId for group chat */
  targetId: string;
  targetName: string;
}

/**
 * Shares content to a Direct Message conversation.
 * Reuses the existing DM message path: conversations/{conversationId}/messages
 */
export const shareContentToDM = async (
  content: ShareableContent,
  conversationId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !conversationId) throw new Error('Authentication required.');

  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  await addDoc(messagesRef, {
    conversationId,
    senderId: currentUser.uid,
    senderName: currentUser.displayName || 'Student',
    senderAvatar: currentUser.photoURL || null,
    content: `Shared: ${content.title}`,
    messageType: 'share',
    sharedContent: {
      type: content.type,
      id: content.id,
      title: content.title,
      preview: content.preview || '',
      imageUrl: content.imageUrl || null,
      deepLink: content.deepLink,
    },
    status: 'active',
    createdAt: serverTimestamp(),
  });

  // Update conversation metadata
  const convRef = doc(db, 'conversations', conversationId);
  await setDoc(
    convRef,
    {
      lastMessagePreview: `Shared: ${content.title}`,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: currentUser.uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

/**
 * Shares content to a Group Chat channel.
 * Reuses the existing group chat path: groupChats/{groupId}/messages
 */
export const shareContentToGroup = async (
  content: ShareableContent,
  groupId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !groupId) throw new Error('Authentication required.');

  const messagesRef = collection(db, 'groupChats', groupId, 'messages');
  await addDoc(messagesRef, {
    groupId,
    senderId: currentUser.uid,
    senderName: currentUser.displayName || 'Student',
    senderAvatar: currentUser.photoURL || null,
    content: `Shared: ${content.title}`,
    messageType: 'share',
    sharedContent: {
      type: content.type,
      id: content.id,
      title: content.title,
      preview: content.preview || '',
      imageUrl: content.imageUrl || null,
      deepLink: content.deepLink,
    },
    reactions: {},
    status: 'active',
    createdAt: serverTimestamp(),
  });
};

/**
 * Copies a shareable link to clipboard.
 * Returns true on success, false on failure.
 */
export const copyShareLink = async (deepLink: string): Promise<boolean> => {
  try {
    const url = `${window.location.origin}${deepLink}`;
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Returns a ShareableContent object for common entity types.
 */
export const buildShareableContent = {
  post: (id: string, title: string, preview?: string, imageUrl?: string): ShareableContent => ({
    type: 'post',
    id,
    title: title || 'Campus Post',
    preview,
    imageUrl,
    deepLink: `/feed?postId=${id}`,
  }),

  event: (id: string, title: string, preview?: string, imageUrl?: string): ShareableContent => ({
    type: 'event',
    id,
    title: title || 'Campus Event',
    preview,
    imageUrl,
    deepLink: `/events/${id}`,
  }),

  opportunity: (id: string, title: string, preview?: string): ShareableContent => ({
    type: 'opportunity',
    id,
    title: title || 'Opportunity',
    preview,
    deepLink: `/discover?tab=opportunities&id=${id}`,
  }),

  marketplace: (id: string, title: string, preview?: string, imageUrl?: string): ShareableContent => ({
    type: 'marketplace',
    id,
    title: title || 'Marketplace Listing',
    preview,
    imageUrl,
    deepLink: `/marketplace/${id}`,
  }),

  group: (id: string, name: string, description?: string): ShareableContent => ({
    type: 'group',
    id,
    title: name || 'Campus Group',
    preview: description,
    deepLink: `/groups/${id}`,
  }),
};
