import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type ActivityScope = 'notifications' | 'messages' | 'groups' | 'feed' | 'events';

export interface ActivityState {
  scope: ActivityScope;
  unreadCount: number;
  lastSeen?: any;
  updatedAt?: any;
}

/**
 * Subscribes to a user's unread activity state for a specific scope.
 */
export const subscribeToActivityState = (
  uid: string,
  scope: ActivityScope,
  callback: (state: ActivityState) => void,
  onError?: (err: Error) => void
) => {
  const docRef = doc(db, 'users', uid, 'activityState', scope);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as ActivityState);
      } else {
        callback({
          scope,
          unreadCount: 0,
        });
      }
    },
    onError
  );
};

/**
 * Increments the unread state count for a given user and activity scope.
 */
export const incrementScopeUnread = async (uid: string, scope: ActivityScope): Promise<void> => {
  if (!uid) return;
  const docRef = doc(db, 'users', uid, 'activityState', scope);
  await setDoc(
    docRef,
    {
      scope,
      unreadCount: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

/**
 * Resets the unread activity state count to 0 and updates lastSeen.
 */
export const markScopeAsRead = async (uid: string, scope: ActivityScope): Promise<void> => {
  if (!uid) return;
  const docRef = doc(db, 'users', uid, 'activityState', scope);
  await setDoc(
    docRef,
    {
      scope,
      unreadCount: 0,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

/**
 * Marks all activity state scopes as read in a single batch.
 */
export const markAllScopesAsRead = async (uid: string): Promise<void> => {
  if (!uid) return;
  const batch = writeBatch(db);
  const scopes: ActivityScope[] = ['notifications', 'messages', 'groups', 'feed', 'events'];

  scopes.forEach((scope) => {
    const docRef = doc(db, 'users', uid, 'activityState', scope);
    batch.set(
      docRef,
      {
        scope,
        unreadCount: 0,
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();
};
