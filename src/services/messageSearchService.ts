import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { DirectMessage } from '../types/directMessage';
import type { ChatMessage } from '../types/chat';

/**
 * Searches direct messages inside a conversation for a substring match.
 * Scoped and paginated.
 */
export const searchConversationMessages = async (
  conversationId: string,
  searchQuery: string,
  limitCount: number = 50
): Promise<DirectMessage[]> => {
  if (!conversationId || !searchQuery.trim()) return [];
  const cleanQuery = searchQuery.trim().toLowerCase();

  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    // Load latest messages (bounded read)
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(150));
    const snap = await getDocs(q);

    const filtered = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as DirectMessage))
      .filter((msg) => msg.status === 'active' && (msg.content || '').toLowerCase().includes(cleanQuery));

    return filtered.slice(0, limitCount);
  } catch (err) {
    console.error('Error searching conversation messages:', err);
    return [];
  }
};

/**
 * Searches group chat messages inside a channel for a substring match.
 * Scoped and paginated.
 */
export const searchGroupChannelMessages = async (
  channelId: string,
  searchQuery: string,
  limitCount: number = 50
): Promise<ChatMessage[]> => {
  if (!channelId || !searchQuery.trim()) return [];
  const cleanQuery = searchQuery.trim().toLowerCase();

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(150));
    const snap = await getDocs(q);

    const filtered = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as ChatMessage))
      .filter((msg) => msg.status === 'active' && (msg.content || '').toLowerCase().includes(cleanQuery));

    return filtered.slice(0, limitCount);
  } catch (err) {
    console.error('Error searching group channel messages:', err);
    return [];
  }
};
