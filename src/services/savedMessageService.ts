import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { ChatMessage, SavedChatMessage } from '../types/chat';

export interface PaginatedSavedMessagesResult {
  items: SavedChatMessage[];
  lastDocSnapshot: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Saves a message bookmark to the user's personal collection (users/{uid}/savedMessages/{messageId}).
 * Deterministic messageId path guarantees idempotency.
 * Does NOT modify the original message document.
 */
export const saveMessage = async (
  uid: string,
  message: ChatMessage
): Promise<SavedChatMessage> => {
  if (!uid || !message?.id || !message?.channelId) {
    throw new Error('User ID, Message ID, and Channel ID are required to save message.');
  }

  const messageId = message.id;
  const docRef = doc(db, 'users', uid, 'savedMessages', messageId);

  const messageType: 'text' | 'image' | 'file' = message.attachment
    ? 'file'
    : message.imageUrl
    ? 'image'
    : 'text';

  const rawPreview = message.content || (message.attachment ? `📄 ${message.attachment.name}` : '[Image]');
  const previewText = rawPreview.length > 100 ? `${rawPreview.slice(0, 97)}...` : rawPreview;

  const savedData: SavedChatMessage = {
    messageId,
    channelId: message.channelId,
    savedAt: serverTimestamp(),
    senderId: message.senderId,
    senderName: message.senderName || 'Student',
    messageType,
    previewText,
  };

  try {
    await setDoc(docRef, savedData);

    logAnalyticsEvent('chat_message_saved', {
      channelId: message.channelId,
      messageType,
      source: 'chat',
    });

    return savedData;
  } catch (err: any) {
    console.error('Error saving message bookmark:', err);
    throw new Error(err.message || 'Failed to save message.');
  }
};

/**
 * Removes a saved message bookmark (Idempotent deleteDoc).
 * Does NOT modify the original message document.
 */
export const unsaveMessage = async (
  uid: string,
  messageId: string,
  channelId?: string,
  messageType?: string
): Promise<void> => {
  if (!uid || !messageId) {
    throw new Error('User ID and Message ID are required to unsave message.');
  }

  try {
    const docRef = doc(db, 'users', uid, 'savedMessages', messageId);
    await deleteDoc(docRef);

    logAnalyticsEvent('chat_message_unsaved', {
      channelId: channelId || 'unknown',
      messageType: messageType || 'unknown',
      source: 'saved_messages',
    });
  } catch (err: any) {
    console.error('Error removing saved message bookmark:', err);
    throw new Error(err.message || 'Failed to remove saved message.');
  }
};

/**
 * Checks if a specific message is saved by the user (One-time getDoc).
 */
export const hasMessageSaved = async (
  uid: string,
  messageId: string
): Promise<boolean> => {
  if (!uid || !messageId) return false;
  try {
    const docRef = doc(db, 'users', uid, 'savedMessages', messageId);
    const snap = await getDoc(docRef);
    return snap.exists();
  } catch (err) {
    return false;
  }
};

/**
 * Fetches saved message IDs for in-memory bookmark status mapping in the UI.
 * Bounded query limit = 200.
 */
export const getUserSavedMessageIds = async (uid: string): Promise<Set<string>> => {
  if (!uid) return new Set();
  try {
    const savedRef = collection(db, 'users', uid, 'savedMessages');
    const q = query(savedRef, limit(200));
    const snap = await getDocs(q);
    const ids = new Set<string>();
    snap.docs.forEach((d) => ids.add(d.id));
    return ids;
  } catch (err) {
    return new Set();
  }
};

/**
 * Fetches a cursor-paginated list of saved messages for the current user.
 * Bounded page size (default 20, max 50).
 */
export const getSavedMessages = async (
  uid: string,
  pageSize = 20,
  lastDocSnapshot: QueryDocumentSnapshot | null = null
): Promise<PaginatedSavedMessagesResult> => {
  if (!uid) {
    return { items: [], lastDocSnapshot: null, hasMore: false };
  }

  const safePageSize = Math.min(Math.max(pageSize, 1), 50);
  const savedRef = collection(db, 'users', uid, 'savedMessages');

  let q = query(savedRef, orderBy('savedAt', 'desc'), limit(safePageSize));
  if (lastDocSnapshot) {
    q = query(savedRef, orderBy('savedAt', 'desc'), startAfter(lastDocSnapshot), limit(safePageSize));
  }

  try {
    const snapshot = await getDocs(q);
    const items: SavedChatMessage[] = snapshot.docs.map((docSnap) => ({
      ...(docSnap.data() as SavedChatMessage),
      messageId: docSnap.id,
    }));

    const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    const hasMore = snapshot.docs.length === safePageSize;

    return {
      items,
      lastDocSnapshot: newLastDoc,
      hasMore,
    };
  } catch (err: any) {
    console.error('Error fetching saved messages:', err);
    throw new Error(err.message || 'Failed to load saved messages.');
  }
};
