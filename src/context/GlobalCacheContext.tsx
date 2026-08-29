import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, doc, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types';

export interface GlobalCacheType {
  joinedGroupIds: string[];
  friendIds: string[];
  blockedUserIds: string[];
  unreadMsgCount: number;
  notificationCount: number;
  loadingCache: boolean;
  refreshCache: () => Promise<void>;
}

const GlobalCacheContext = createContext<GlobalCacheType | undefined>(undefined);

export const useGlobalCache = () => {
  const context = useContext(GlobalCacheContext);
  if (!context) {
    throw new Error('useGlobalCache must be used within a GlobalCacheProvider');
  }
  return context;
};

export const GlobalCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [unreadMsgCount, setUnreadMsgCount] = useState<number>(0);
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [loadingCache, setLoadingCache] = useState<boolean>(false);

  const loadStaticCache = async () => {
    if (!currentUser) return;
    setLoadingCache(true);
    try {
      // Fetch blocked user IDs
      const blockedColl = collection(db, 'users', currentUser.uid, 'blockedUsers');
      const blockedSnap = await getDocs(blockedColl);
      setBlockedUserIds(blockedSnap.docs.map((d) => d.id));

      // Fetch friendships
      const friendsColl = collection(db, 'users', currentUser.uid, 'friends');
      const friendsSnap = await getDocs(friendsColl);
      setFriendIds(friendsSnap.docs.map((d) => d.id));
    } catch (err) {
      console.error('Failed to pre-fetch cache logs:', err);
    } finally {
      setLoadingCache(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      setJoinedGroupIds([]);
      setFriendIds([]);
      setBlockedUserIds([]);
      setUnreadMsgCount(0);
      setNotificationCount(0);
      return;
    }

    loadStaticCache();

    // 1. Real-time Joined Groups Subscriptions
    const userRef = doc(db, 'users', currentUser.uid);
    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as User;
        setJoinedGroupIds(data.joinedChannelIds || []);
      }
    });

    // 2. Real-time Unread Messages count subscription (e.g. from users/{uid}/unreadCount or from direct messages unread subcollection)
    const unreadRef = doc(db, 'users', currentUser.uid, 'unreadStats', 'messages');
    const unsubUnread = onSnapshot(unreadRef, (snap) => {
      if (snap.exists()) {
        setUnreadMsgCount(snap.data()?.count || 0);
      } else {
        setUnreadMsgCount(0);
      }
    }, () => {});

    // 3. Real-time Notifications count subscription
    const notifsStatsRef = doc(db, 'users', currentUser.uid, 'unreadStats', 'notifications');
    const unsubNotifs = onSnapshot(notifsStatsRef, (snap) => {
      if (snap.exists()) {
        setNotificationCount(snap.data()?.count || 0);
      } else {
        setNotificationCount(0);
      }
    }, () => {});

    return () => {
      unsubUser();
      unsubUnread();
      unsubNotifs();
    };
  }, [currentUser]);

  return (
    <GlobalCacheContext.Provider
      value={{
        joinedGroupIds,
        friendIds,
        blockedUserIds,
        unreadMsgCount,
        notificationCount,
        loadingCache,
        refreshCache: loadStaticCache,
      }}
    >
      {children}
    </GlobalCacheContext.Provider>
  );
};
