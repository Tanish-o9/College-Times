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

    // Do all reads first
    const curSnap = await tx.get(currentUserRef);
    const targetSnap = await tx.get(targetUserRef);

    // Do all writes after
    tx.set(followingRef, { uid: targetUid, createdAt: serverTimestamp() });
    tx.set(followerRef, { uid: currentUid, createdAt: serverTimestamp() });

    const curFollowingCount = curSnap.exists() ? curSnap.data()?.followingCount || 0 : 0;
    tx.set(currentUserRef, { followingCount: curFollowingCount + 1 }, { merge: true });

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

    // Do all reads first
    const curSnap = await tx.get(currentUserRef);
    const targetSnap = await tx.get(targetUserRef);

    // Do all writes after
    tx.delete(followingRef);
    tx.delete(followerRef);

    const curFollowingCount = curSnap.exists() ? Math.max(0, (curSnap.data()?.followingCount || 1) - 1) : 0;
    tx.set(currentUserRef, { followingCount: curFollowingCount }, { merge: true });

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

export const hasPendingFollowRequest = async (currentUid: string, targetUid: string): Promise<boolean> => {
  if (!currentUid || !targetUid) return false;
  const ref = doc(db, 'users', targetUid, 'followRequests', currentUid);
  const snap = await getDoc(ref);
  return snap.exists() && snap.data()?.status === 'pending';
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

/**
 * Fetches pending follow requests for a user.
 */
export const getFollowRequests = async (
  uid: string
): Promise<{ uids: string[] }> => {
  if (!uid) return { uids: [] };
  try {
    const colRef = collection(db, 'users', uid, 'followRequests');
    const snap = await getDocs(colRef);
    const uids = snap.docs.map((d) => d.id);
    return { uids };
  } catch (err) {
    console.error('Error fetching follow requests:', err);
    return { uids: [] };
  }
};

/**
 * Accepts a follow request:
 * Adds requesterUid to targetUid's followers collection and targetUid to requesterUid's following collection.
 * Increments counters, deletes the follow request.
 */
export const acceptFollowRequest = async (
  targetUid: string,
  requesterUid: string
): Promise<void> => {
  if (!targetUid || !requesterUid) return;

  const requestRef = doc(db, 'users', targetUid, 'followRequests', requesterUid);
  const followingRef = doc(db, 'users', requesterUid, 'following', targetUid);
  const followerRef = doc(db, 'users', targetUid, 'followers', requesterUid);
  const requesterUserRef = doc(db, 'users', requesterUid);
  const targetUserRef = doc(db, 'users', targetUid);

  await runTransaction(db, async (tx) => {
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists()) {
      throw new Error('Follow request does not exist or has already been processed.');
    }

    // Do all reads first
    const reqSnap = await tx.get(requesterUserRef);
    const tarSnap = await tx.get(targetUserRef);

    // Do all writes after
    tx.set(followingRef, { uid: targetUid, createdAt: serverTimestamp() });
    tx.set(followerRef, { uid: requesterUid, createdAt: serverTimestamp() });

    const reqFollowingCount = reqSnap.exists() ? reqSnap.data()?.followingCount || 0 : 0;
    tx.set(requesterUserRef, { followingCount: reqFollowingCount + 1 }, { merge: true });

    const tarFollowersCount = tarSnap.exists() ? tarSnap.data()?.followersCount || 0 : 0;
    tx.set(targetUserRef, { followersCount: tarFollowersCount + 1 }, { merge: true });

    tx.delete(requestRef);
  });

  createNotification({
    recipientId: requesterUid,
    senderId: targetUid,
    message: 'accepted your follow request.',
  });

  logAnalyticsEvent('follow_request_accepted', { targetUid, requesterUid });
};

/**
 * Rejects a follow request:
 * Simply deletes the request document.
 */
export const rejectFollowRequest = async (
  targetUid: string,
  requesterUid: string
): Promise<void> => {
  if (!targetUid || !requesterUid) return;

  const requestRef = doc(db, 'users', targetUid, 'followRequests', requesterUid);
  await runTransaction(db, async (tx) => {
    tx.delete(requestRef);
  });

  logAnalyticsEvent('follow_request_rejected', { targetUid, requesterUid });
};
