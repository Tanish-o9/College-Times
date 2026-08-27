import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import { 
  subscribeToMyChannelReadStates, 
  markChannelAsRead 
} from '../services/chatReadStateService';
import type { ChannelReadState, Channel } from '../types/chat';

export interface ChannelUnreadInfo {
  count: number;
  hasUnread: boolean;
}

export const useChatUnreadState = (myChannels: Channel[] = []) => {
  const { currentUser } = useAuth();
  const [readStatesMap, setReadStatesMap] = useState<Record<string, ChannelReadState>>({});
  
  // Local volatile unread increments map: channelId -> count
  const [localUnreadMap, setLocalUnreadMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!currentUser?.uid) {
      setReadStatesMap({});
      setLocalUnreadMap({});
      return;
    }

    const unsub = subscribeToMyChannelReadStates(currentUser.uid, (states) => {
      setReadStatesMap(states);
    });

    return () => {
      unsub();
    };
  }, [currentUser?.uid]);

  /**
   * Calculates unread state for each channel.
   * Scalable algorithm:
   * 1. If user has a read state and lastReadMessageId === channel.lastMessageId -> 0 unread (Read).
   * 2. If user has a read state, compares channel.lastMessageAt vs readState.lastReadAt.
   * 3. Incorporates localUnreadMap for live incoming messages while app is open.
   */
  const unreadInfoMap = useMemo(() => {
    const map: Record<string, ChannelUnreadInfo> = {};

    myChannels.forEach((channel) => {
      if (!channel.id) return;

      const channelId = channel.id;
      const readState = readStatesMap[channelId];
      const localCount = localUnreadMap[channelId] || 0;

      // Scenario 1: No last message in channel -> 0 unread
      if (!channel.lastMessageAt && !channel.lastMessageId) {
        map[channelId] = { count: 0, hasUnread: false };
        return;
      }

      // Scenario 2: User has read up to channel's lastMessageId
      if (readState && channel.lastMessageId && readState.lastReadMessageId === channel.lastMessageId) {
        // If localCount > 0 from new arrivals, show localCount, else 0
        map[channelId] = { 
          count: localCount, 
          hasUnread: localCount > 0 
        };
        return;
      }

      // Scenario 3: Never opened channel (no readState)
      if (!readState) {
        map[channelId] = { 
          count: localCount, 
          hasUnread: true 
        };
        return;
      }

      // Scenario 4: Timestamp comparison
      const lastMsgTime = channel.lastMessageAt?.toMillis ? channel.lastMessageAt.toMillis() : 0;
      const lastReadTime = readState.lastReadAt?.toMillis ? readState.lastReadAt.toMillis() : 0;

      if (lastMsgTime > lastReadTime) {
        const count = Math.max(1, localCount);
        map[channelId] = { count, hasUnread: true };
      } else {
        map[channelId] = { count: localCount, hasUnread: localCount > 0 };
      }
    });

    return map;
  }, [myChannels, readStatesMap, localUnreadMap]);

  /**
   * Total unread count across all joined channels for Navbar global badge.
   */
  const totalUnreadCount = useMemo(() => {
    let sum = 0;
    Object.values(unreadInfoMap).forEach((info) => {
      sum += info.count;
    });
    return sum;
  }, [unreadInfoMap]);

  /**
   * Helper to increment local unread count when a new message arrives from another user
   * while the current user is NOT at the bottom of the room.
   */
  const incrementLocalUnread = useCallback((channelId: string) => {
    setLocalUnreadMap((prev) => ({
      ...prev,
      [channelId]: (prev[channelId] || 0) + 1,
    }));
  }, []);

  /**
   * Clears local unread count and persists read state to Firestore deduplicated.
   */
  const markRead = useCallback(
    (channelId: string, lastReadMessageId: string) => {
      if (!currentUser?.uid || !channelId || !lastReadMessageId) return;

      setLocalUnreadMap((prev) => {
        if (!prev[channelId]) return prev;
        const copy = { ...prev };
        delete copy[channelId];
        return copy;
      });

      markChannelAsRead(currentUser.uid, channelId, lastReadMessageId);
    },
    [currentUser?.uid]
  );

  return {
    readStatesMap,
    unreadInfoMap,
    totalUnreadCount,
    incrementLocalUnread,
    markRead,
  };
};
