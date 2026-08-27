import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  serverTimestamp, 
  type Unsubscribe 
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { ChannelReadState } from '../types/chat';

// Deduplication map to prevent redundant Firestore writes
// Key: `${uid}_${channelId}` -> lastReadMessageId
const lastSavedReadMessageIdMap = new Map<string, string>();

/**
 * Fetches single channel read-state document for a user.
 * Returns null if user has never read/opened this channel.
 */
export const getChannelReadState = async (
  uid: string, 
  channelId: string
): Promise<ChannelReadState | null> => {
  if (!uid || !channelId) return null;

  try {
    const docRef = doc(db, 'users', uid, 'channelReadState', channelId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return snap.data() as ChannelReadState;
    }
    return null;
  } catch (err) {
    console.error(`Error fetching read state for channel ${channelId}:`, err);
    return null;
  }
};

/**
 * Marks a channel as read up to a specific lastReadMessageId.
 * DEDUPLICATED: Only writes to Firestore if lastReadMessageId changed.
 */
export const markChannelAsRead = async (
  uid: string,
  channelId: string,
  lastReadMessageId: string,
  lastReadAt?: any
): Promise<void> => {
  if (!uid || !channelId || !lastReadMessageId) return;

  const mapKey = `${uid}_${channelId}`;
  const previousMessageId = lastSavedReadMessageIdMap.get(mapKey);

  // Deduplication check: Avoid writing if already marked for this message ID
  if (previousMessageId === lastReadMessageId) {
    return;
  }

  // Update in-memory tracking immediately
  lastSavedReadMessageIdMap.set(mapKey, lastReadReadMessageId(lastReadMessageId));

  try {
    const docRef = doc(db, 'users', uid, 'channelReadState', channelId);
    const payload: ChannelReadState = {
      channelId,
      lastReadMessageId,
      lastReadAt: lastReadAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, payload, { merge: true });

    logAnalyticsEvent('chat_channel_marked_read', {
      channelId,
      lastReadMessageId,
    });
  } catch (err) {
    console.error(`Failed to persist read state for ${channelId}:`, err);
    // On network failure, clear in-memory key so retry can re-attempt
    lastSavedReadMessageIdMap.delete(mapKey);
  }
};

/**
 * Normalizes input string
 */
function lastReadReadMessageId(id: string): string {
  return typeof id === 'string' ? id.trim() : String(id);
}

/**
 * Bounded real-time listener for all user's channel read states (1 collection listener for currentUser).
 * Listens to `users/{uid}/channelReadState`.
 */
export const subscribeToMyChannelReadStates = (
  uid: string,
  callback: (readStatesMap: Record<string, ChannelReadState>) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  if (!uid) {
    callback({});
    return () => {};
  }

  const colRef = collection(db, 'users', uid, 'channelReadState');
  return onSnapshot(
    colRef,
    (snap) => {
      const readStatesMap: Record<string, ChannelReadState> = {};
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data() as ChannelReadState;
        if (data && data.channelId) {
          readStatesMap[data.channelId] = data;
          // Seed in-memory deduplication map
          lastSavedReadMessageIdMap.set(`${uid}_${data.channelId}`, data.lastReadMessageId);
        }
      });
      callback(readStatesMap);
    },
    (err) => {
      console.error('Error listening to user channel read states:', err);
      if (onError) onError(err);
    }
  );
};
