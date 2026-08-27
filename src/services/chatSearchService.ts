import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  type QueryConstraint,
  type DocumentSnapshot 
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { ChatMessage } from '../types/chat';

export interface SearchChannelMessagesOptions {
  channelId: string;
  queryText?: string;
  authorId?: string;
  startDate?: Date;
  endDate?: Date;
  pageSize?: number;
  cursor?: DocumentSnapshot | null;
  isAdmin?: boolean;
}

export interface SearchAccessibleMessagesOptions {
  joinedChannelIds: string[];
  queryText?: string;
  channelId?: string;
  authorId?: string;
  startDate?: Date;
  endDate?: Date;
  pageSize?: number;
  cursor?: DocumentSnapshot | null;
  isAdmin?: boolean;
}

export interface SearchResult {
  messages: ChatMessage[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Normalizes user search input string (trims, lowercases, removes excess spaces).
 */
export const normalizeSearchQuery = (text: string): string => {
  if (!text) return '';
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Searches messages within a specific channel using bounded Firestore queries.
 * Respects status === 'active' for non-admin students.
 * Hard limit: Max 50 results per page (Default 20).
 */
export const searchChannelMessages = async (
  options: SearchChannelMessagesOptions
): Promise<SearchResult> => {
  const { 
    channelId, 
    queryText = '', 
    authorId, 
    startDate, 
    endDate, 
    pageSize = 20, 
    cursor, 
    isAdmin = false 
  } = options;

  if (!channelId) {
    return { messages: [], lastDoc: null, hasMore: false };
  }

  const effectivePageSize = Math.min(Math.max(1, pageSize), 50);
  const normalizedQuery = normalizeSearchQuery(queryText);

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages');
    const constraints: QueryConstraint[] = [];

    // Filter by moderation status for non-admin users
    if (!isAdmin) {
      constraints.push(where('status', '==', 'active'));
    }

    // Filter by author if specified
    if (authorId) {
      constraints.push(where('senderId', '==', authorId));
    }

    // Date range filters
    if (startDate) {
      constraints.push(where('createdAt', '>=', startDate));
    }
    if (endDate) {
      constraints.push(where('createdAt', '<=', endDate));
    }

    // Default order by timestamp DESC
    constraints.push(orderBy('createdAt', 'desc'));

    // Pagination cursor
    if (cursor) {
      constraints.push(startAfter(cursor));
    }

    // Bounded fetch size
    constraints.push(limit(effectivePageSize));

    const q = query(messagesRef, ...constraints);
    const snap = await getDocs(q);

    let messages = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage));

    // Client-side text matching on bounded page for keyword filter
    if (normalizedQuery && normalizedQuery.length >= 2) {
      messages = messages.filter((msg) => {
        const contentMatch = msg.content && msg.content.toLowerCase().includes(normalizedQuery);
        const senderMatch = msg.senderName && msg.senderName.toLowerCase().includes(normalizedQuery);
        return contentMatch || senderMatch;
      });
    }

    const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    const hasMore = snap.docs.length >= effectivePageSize;

    logAnalyticsEvent('chat_search_performed', {
      channelScope: 'channel_local',
      queryLength: normalizedQuery.length,
      resultCount: messages.length,
      filtersUsed: !!authorId || !!startDate || !!endDate,
    });

    return {
      messages,
      lastDoc,
      hasMore,
    };
  } catch (err) {
    console.error(`Error searching messages in channel ${channelId}:`, err);
    throw err;
  }
};

/**
 * Searches messages across a list of user's accessible/joined channels.
 * Strictly verifies joinedChannelIds before querying.
 */
export const searchMyAccessibleMessages = async (
  options: SearchAccessibleMessagesOptions
): Promise<SearchResult> => {
  const { 
    joinedChannelIds, 
    channelId, 
    queryText = '', 
    authorId, 
    startDate, 
    endDate, 
    pageSize = 20, 
    cursor, 
    isAdmin = false 
  } = options;

  const targetChannels = channelId 
    ? joinedChannelIds.filter((id) => id === channelId)
    : joinedChannelIds;

  if (targetChannels.length === 0) {
    return { messages: [], lastDoc: null, hasMore: false };
  }

  // If a single channel is selected or joined list has 1 item, search directly
  if (targetChannels.length === 1) {
    return searchChannelMessages({
      channelId: targetChannels[0],
      queryText,
      authorId,
      startDate,
      endDate,
      pageSize,
      cursor,
      isAdmin,
    });
  }

  // Perform bounded parallel searches over top joined channels (limit max 5 channels)
  const channelsToSearch = targetChannels.slice(0, 5);
  const perChannelPageSize = Math.max(5, Math.floor(pageSize / channelsToSearch.length));

  try {
    const results = await Promise.all(
      channelsToSearch.map((cId) =>
        searchChannelMessages({
          channelId: cId,
          queryText,
          authorId,
          startDate,
          endDate,
          pageSize: perChannelPageSize,
          cursor,
          isAdmin,
        })
      )
    );

    let combinedMessages: ChatMessage[] = [];
    results.forEach((res) => {
      combinedMessages = combinedMessages.concat(res.messages);
    });

    // Sort combined messages by createdAt DESC
    combinedMessages.sort((a, b) => {
      const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tB - tA;
    });

    const finalMessages = combinedMessages.slice(0, pageSize);
    const hasMore = results.some((r) => r.hasMore);

    logAnalyticsEvent('chat_search_performed', {
      channelScope: 'multi_channel',
      queryLength: normalizeSearchQuery(queryText).length,
      resultCount: finalMessages.length,
      filtersUsed: !!authorId || !!startDate || !!endDate,
    });

    return {
      messages: finalMessages,
      lastDoc: null,
      hasMore,
    };
  } catch (err) {
    console.error('Error searching multi-channel messages:', err);
    throw err;
  }
};
