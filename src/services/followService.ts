import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  limit,
  getDocs,
  runTransaction,
  serverTimestamp,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import { createNotification } from './notificationService';

export const followUser = async (
  currentUid: string,
  targetUid: string,
  targetIsPrivate: boolean = false
): Promise<boolean> => {
  if (!currentUid || !targetUid) return false;
  if (currentUid === targetUid) {
    throw new Error('You cannot follow yourself.');
  }

  // Handle Private Profile Follow Request
  if (targetIsPrivate) {
    const requestRef = doc(db, 'users', targetUid, 'followRequests', currentUid);
    await setDoc(requestRef, {
      requesterUid: currentUid,
      targetUid,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    createNotification({
      recipientId: targetUid,
      senderId: currentUid,
      message: 'requested to follow you.',
    });

    logAnalyticsEvent('follow_request_created', { targetUid });
    return false; // Returns false for pending request
  }

  // Public Profile Instant Follow Transaction
  const followingRef = doc(db, 'users', currentUid, 'following', targetUid);
  const followerRef = doc(db, 'users', targetUid, 'followers', currentUid);
  const currentUserRef = doc(db, 'users', currentUid);
  const targetUserRef = doc(db, 'users', targetUid);

  await runTransaction(db, async (tx) => {
    const existingSnap = await tx.get(followingRef);
    if (existingSnap.exists()) return;

    tx.set(followingRef, { uid: targetUid, createdAt: serverTimestamp() });
    tx.set(followerRef, { uid: currentUid, createdAt: serverTimestamp() });

    const curSnap = await tx.get(currentUserRef);
    const curFollowingCount = curSnap.exists() ? curSnap.data()?.followingCount || 0 : 0;
    tx.set(currentUserRef, { followingCount: curFollowingCount + 1 }, { merge: true });

    const targetSnap = await tx.get(targetUserRef);
    const targetFollowersCount = targetSnap.exists() ? targetSnap.data()?.followersCount || 0 : 0;
    tx.set(targetUserRef, { followersCount: targetFollowersCount + 1 }, { merge: true });
  });

  createNotification({
    recipientId: targetUid,
    senderId: currentUid,
    message: 'started following you.',
  });

  logAnalyticsEvent('follow_created', { targetUid });
  return true;
};

export const unfollowUser = async (currentUid: string, targetUid: string): Promise<void> => {
  if (!currentUid || !targetUid || currentUid === targetUid) return;

  const followingRef = doc(db, 'users', currentUid, 'following', targetUid);
  const followerRef = doc(db, 'users', targetUid, 'followers', currentUid);
  const currentUserRef = doc(db, 'users', currentUid);
  const targetUserRef = doc(db, 'users', targetUid);

  await runTransaction(db, async (tx) => {
    const existingSnap = await tx.get(followingRef);
    if (!existingSnap.exists()) return;

    tx.delete(followingRef);
    tx.delete(followerRef);

    const curSnap = await tx.get(currentUserRef);
    const curFollowingCount = curSnap.exists() ? Math.max(0, (curSnap.data()?.followingCount || 1) - 1) : 0;
    tx.set(currentUserRef, { followingCount: curFollowingCount }, { merge: true });

    const targetSnap = await tx.get(targetUserRef);
    const targetFollowersCount = targetSnap.exists() ? Math.max(0, (targetSnap.data()?.followersCount || 1) - 1) : 0;
    tx.set(targetUserRef, { followersCount: targetFollowersCount }, { merge: true });
  });

  logAnalyticsEvent('follow_removed', { targetUid });
};

export const isFollowingUser = async (currentUid: string, targetUid: string): Promise<boolean> => {
  if (!currentUid || !targetUid) return false;
  const ref = doc(db, 'users', currentUid, 'following', targetUid);
  const snap = await getDoc(ref);
  return snap.exists();
};

export const getFollowersPage = async (
  uid: string,
  limitCount: number = 20
): Promise<{ uids: string[]; lastDoc: QueryDocumentSnapshot | null }> => {
  if (!uid) return { uids: [], lastDoc: null };
  const boundedLimit = Math.min(50, Math.max(1, limitCount));

  const colRef = collection(db, 'users', uid, 'followers');
  const snap = await getDocs(query(colRef, limit(boundedLimit)));

  const uids: string[] = snap.docs.map((d) => d.id);
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return { uids, lastDoc };
};

export const getFollowingPage = async (
  uid: string,
  limitCount: number = 20
): Promise<{ uids: string[]; lastDoc: QueryDocumentSnapshot | null }> => {
  if (!uid) return { uids: [], lastDoc: null };
  const boundedLimit = Math.min(50, Math.max(1, limitCount));

  const colRef = collection(db, 'users', uid, 'following');
  const snap = await getDocs(query(colRef, limit(boundedLimit)));

  const uids: string[] = snap.docs.map((d) => d.id);
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return { uids, lastDoc };
};
