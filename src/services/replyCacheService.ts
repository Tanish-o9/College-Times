import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ChatMessage } from '../types/chat';

const MAX_REPLY_CACHE_SIZE = 200;
const replyCache = new Map<string, ChatMessage | null>();

/**
 * Fetches original referenced message for reply previews with in-memory caching.
 * Capped at MAX_REPLY_CACHE_SIZE = 200 to prevent memory growth.
 */
export const getReplyOriginalMessage = async (
  channelId: string, 
  replyToMessageId: string
): Promise<ChatMessage | null> => {
  if (!channelId || !replyToMessageId) return null;

  const cacheKey = `${channelId}_${replyToMessageId}`;
  if (replyCache.has(cacheKey)) {
    return replyCache.get(cacheKey) || null;
  }

  try {
    const msgRef = doc(db, 'channels', channelId, 'messages', replyToMessageId);
    const snap = await getDoc(msgRef);

    let messageData: ChatMessage | null = null;
    if (snap.exists()) {
      messageData = { id: snap.id, ...snap.data() } as ChatMessage;
    }

    // Maintain cache size limit <= 200
    if (replyCache.size >= MAX_REPLY_CACHE_SIZE) {
      const oldestKey = replyCache.keys().next().value;
      if (oldestKey) replyCache.delete(oldestKey);
    }

    replyCache.set(cacheKey, messageData);
    return messageData;
  } catch (err) {
    console.error(`Error fetching reply target ${replyToMessageId}:`, err);
    return null;
  }
};
