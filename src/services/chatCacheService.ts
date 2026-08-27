import type { ChannelChatCache } from '../types/chat';
import { MAX_CACHED_MESSAGES_PER_CHANNEL } from '../types/chat';

/**
 * In-Memory Channel Chat Cache
 * Retains up to MAX_CACHED_MESSAGES_PER_CHANNEL (200) messages per channel in memory.
 * Strictly bounded to browser session. No localStorage or IndexedDB.
 */
const chatCache = new Map<string, ChannelChatCache>();

export const getChannelCache = (channelId: string): ChannelChatCache | undefined => {
  if (!channelId) return undefined;
  return chatCache.get(channelId);
};

export const setChannelCache = (channelId: string, state: Omit<ChannelChatCache, 'lastLoadedAt'>): void => {
  if (!channelId) return;

  // Enforce maximum 200 cached messages per channel (retaining the most recent 200)
  const messages = state.messages.length > MAX_CACHED_MESSAGES_PER_CHANNEL
    ? state.messages.slice(state.messages.length - MAX_CACHED_MESSAGES_PER_CHANNEL)
    : state.messages;

  chatCache.set(channelId, {
    ...state,
    messages,
    lastLoadedAt: Date.now(),
  });
};

export const clearChatCache = (): void => {
  chatCache.clear();
};
