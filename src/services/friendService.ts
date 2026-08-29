import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  limit,
  runTransaction,
  serverTimestamp,
  Timestamp,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import { createNotification } from './notificationService';
import { isUserBlocked } from './directMessageService';

export type RelationshipStatus = 'NONE' | 'OUTGOING_PENDING' | 'INCOMING_PENDING' | 'FRIENDS';

export interface FriendRequest {
  id: string; // senderId_receiverId
  senderId: string;
  receiverId: string;
  status: 'pending';
  createdAt: Timestamp | any;
}

export interface Friendship {
  id: string; // min(uidA, uidB)_max(uidA, uidB)
  userUids: string[];
  uidA: string;
  uidB: string;
  createdAt: Timestamp | any;
}

// Helpers
const getFriendshipId = (uidA: string, uidB: string): string => {
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
};

/**
 * Gets the current relationship status between two users.
 */
export const getRelationshipStatus = async (
  currentUid: string,
  targetUid: string
): Promise<RelationshipStatus> => {
  if (!currentUid || !targetUid || currentUid === targetUid) return 'NONE';

  // 1. Check if they are friends
  const friendshipId = getFriendshipId(currentUid, targetUid);
  const friendshipRef = doc(db, 'friendships', friendshipId);
  const friendshipSnap = await getDoc(friendshipRef);
  if (friendshipSnap.exists()) return 'FRIENDS';

  // 2. Check for outgoing request
  const outgoingRequestRef = doc(db, 'friendRequests', `${currentUid}_${targetUid}`);
  const outgoingSnap = await getDoc(outgoingRequestRef);
  if (outgoingSnap.exists()) return 'OUTGOING_PENDING';

  // 3. Check for incoming request
  const incomingRequestRef = doc(db, 'friendRequests', `${targetUid}_${currentUid}`);
  const incomingSnap = await getDoc(incomingRequestRef);
  if (incomingSnap.exists()) return 'INCOMING_PENDING';

  return 'NONE';
};

/**
 * Sends a friend request from currentUid to targetUid.
 */
export const sendFriendRequest = async (
  currentUid: string,
  targetUid: string
): Promise<boolean> => {
  if (!currentUid || !targetUid) return false;
  if (currentUid === targetUid) {
    throw new Error('You cannot send a friend request to yourself.');
  }

  // Check blocking
  const blockedA = await isUserBlocked(currentUid, targetUid);
  const blockedB = await isUserBlocked(targetUid, currentUid);
  if (blockedA || blockedB) {
    throw new Error('Action restricted by user privacy/block settings.');
  }

  // Check relationship status first
  const status = await getRelationshipStatus(currentUid, targetUid);
  if (status === 'FRIENDS') {
    throw new Error('You are already friends with this user.');
  }
  if (status === 'OUTGOING_PENDING') {
    throw new Error('A friend request has already been sent to this user.');
  }
  if (status === 'INCOMING_PENDING') {
    // Reverse request exists, so accept it instead of sending a new one
    await acceptFriendRequest(currentUid, targetUid);
    return true;
  }

  const requestId = `${currentUid}_${targetUid}`;
  const requestRef = doc(db, 'friendRequests', requestId);

  await setDoc(requestRef, {
    id: requestId,
    senderId: currentUid,
    receiverId: targetUid,
    status: 'pending',
    createdAt: serverTimestamp()
  });

  // Load sender details for the notification
  let senderName = 'Campus Student';
  let senderAvatar = '';
  try {
    const senderSnap = await getDoc(doc(db, 'users', currentUid));
    if (senderSnap.exists()) {
      const data = senderSnap.data();
      senderName = data.displayName || 'Campus Student';
      senderAvatar = data.photoURL || '';
    }
  } catch (err) {
    console.warn('Failed to load sender profile for notification:', err);
  }

  // Create notification for target user
  await createNotification({
    recipientId: targetUid,
    senderId: currentUid,
    senderName,
    senderAvatar,
    message: 'sent you a friend request.',
    type: 'friend_request',
    deepLink: '/discover'
  });

  logAnalyticsEvent('friend_request_sent', { targetUid });
  return false; // Not friends yet, pending
};

/**
 * Cancels a pending outgoing friend request.
 */
export const cancelFriendRequest = async (
  currentUid: string,
  targetUid: string
): Promise<void> => {
  if (!currentUid || !targetUid) return;
  const requestId = `${currentUid}_${targetUid}`;
  await deleteDoc(doc(db, 'friendRequests', requestId));
  logAnalyticsEvent('friend_request_cancelled', { targetUid });
};

/**
 * Accepts an incoming friend request from targetUid.
 */
export const acceptFriendRequest = async (
  currentUid: string,
  targetUid: string
): Promise<void> => {
  if (!currentUid || !targetUid) return;

  const requestId = `${targetUid}_${currentUid}`;
  const requestRef = doc(db, 'friendRequests', requestId);
  const friendshipId = getFriendshipId(currentUid, targetUid);
  const friendshipRef = doc(db, 'friendships', friendshipId);

  const currentUserRef = doc(db, 'users', currentUid);
  const targetUserRef = doc(db, 'users', targetUid);

  await runTransaction(db, async (tx) => {
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists()) {
      throw new Error('Friend request does not exist or has already been accepted.');
    }

    const friendshipSnap = await tx.get(friendshipRef);
    if (friendshipSnap.exists()) {
      // Friendship already exists, just cleanup the stale request
      tx.delete(requestRef);
      return;
    }

    const curSnap = await tx.get(currentUserRef);
    const tarSnap = await tx.get(targetUserRef);

    // Create Friendship
    tx.set(friendshipRef, {
      id: friendshipId,
      userUids: [currentUid, targetUid],
      uidA: currentUid < targetUid ? currentUid : targetUid,
      uidB: currentUid < targetUid ? targetUid : currentUid,
      createdAt: serverTimestamp()
    });

    // Increment friend, follower, and following counts for both users
    const curFriendsCount = curSnap.exists() ? curSnap.data()?.friendsCount || 0 : 0;
    tx.set(currentUserRef, {
      friendsCount: curFriendsCount + 1,
      followersCount: curFriendsCount + 1,
      followingCount: curFriendsCount + 1
    }, { merge: true });

    const tarFriendsCount = tarSnap.exists() ? tarSnap.data()?.friendsCount || 0 : 0;
    tx.set(targetUserRef, {
      friendsCount: tarFriendsCount + 1,
      followersCount: tarFriendsCount + 1,
      followingCount: tarFriendsCount + 1
    }, { merge: true });

    // Delete pending request
    tx.delete(requestRef);
  });

  // Load current user details for notification
  let currentUserName = 'Campus Student';
  let currentUserAvatar = '';
  try {
    const userSnap = await getDoc(currentUserRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      currentUserName = data.displayName || 'Campus Student';
      currentUserAvatar = data.photoURL || '';
    }
  } catch (err) {
    console.warn('Failed to load user profile for notification:', err);
  }

  // Notify target user that their request was accepted
  await createNotification({
    recipientId: targetUid,
    senderId: currentUid,
    senderName: currentUserName,
    senderAvatar: currentUserAvatar,
    message: 'accepted your friend request. You are now friends! 🎉',
    type: 'friend_accept',
    deepLink: `/profile/${currentUserName}`
  });

  logAnalyticsEvent('friend_request_accepted', { targetUid });
};

/**
 * Declines an incoming friend request from targetUid.
 */
export const declineFriendRequest = async (
  currentUid: string,
  targetUid: string
): Promise<void> => {
  if (!currentUid || !targetUid) return;
  const requestId = `${targetUid}_${currentUid}`;
  await deleteDoc(doc(db, 'friendRequests', requestId));
  logAnalyticsEvent('friend_request_declined', { targetUid });
};

/**
 * Removes an existing friendship.
 */
export const removeFriend = async (
  currentUid: string,
  targetUid: string
): Promise<void> => {
  if (!currentUid || !targetUid) return;

  const friendshipId = getFriendshipId(currentUid, targetUid);
  const friendshipRef = doc(db, 'friendships', friendshipId);

  const currentUserRef = doc(db, 'users', currentUid);
  const targetUserRef = doc(db, 'users', targetUid);

  await runTransaction(db, async (tx) => {
    const friendshipSnap = await tx.get(friendshipRef);
    if (!friendshipSnap.exists()) return;

    const curSnap = await tx.get(currentUserRef);
    const tarSnap = await tx.get(targetUserRef);

    // Delete friendship
    tx.delete(friendshipRef);

    // Decrement counts
    const curFriendsCount = curSnap.exists() ? curSnap.data()?.friendsCount || 1 : 1;
    tx.set(currentUserRef, {
      friendsCount: Math.max(0, curFriendsCount - 1),
      followersCount: Math.max(0, curFriendsCount - 1),
      followingCount: Math.max(0, curFriendsCount - 1)
    }, { merge: true });

    const tarFriendsCount = tarSnap.exists() ? tarSnap.data()?.friendsCount || 1 : 1;
    tx.set(targetUserRef, {
      friendsCount: Math.max(0, tarFriendsCount - 1),
      followersCount: Math.max(0, tarFriendsCount - 1),
      followingCount: Math.max(0, tarFriendsCount - 1)
    }, { merge: true });
  });

  logAnalyticsEvent('friend_removed', { targetUid });
};

/**
 * Fetches all incoming pending friend requests for a user.
 */
export const getIncomingFriendRequests = async (
  uid: string
): Promise<{ uids: string[] }> => {
  if (!uid) return { uids: [] };
  const colRef = collection(db, 'friendRequests');
  const q = query(colRef, where('receiverId', '==', uid));
  const snap = await getDocs(q);
  const uids = snap.docs.map((d) => d.data().senderId);
  return { uids };
};

/**
 * Fetches all outgoing pending friend requests for a user.
 */
export const getOutgoingFriendRequests = async (
  uid: string
): Promise<{ uids: string[] }> => {
  if (!uid) return { uids: [] };
  const colRef = collection(db, 'friendRequests');
  const q = query(colRef, where('senderId', '==', uid));
  const snap = await getDocs(q);
  const uids = snap.docs.map((d) => d.data().receiverId);
  return { uids };
};

/**
 * Fetches a page of friends for a user.
 * Fits the paging layout used in ConnectionsPage.tsx.
 */
export const getFriends = async (
  uid: string,
  limitCount: number = 20
): Promise<{ uids: string[]; lastDoc: QueryDocumentSnapshot | null }> => {
  if (!uid) return { uids: [], lastDoc: null };
  const boundedLimit = Math.min(50, Math.max(1, limitCount));

  const colRef = collection(db, 'friendships');
  // Query friendships where userUids contains the target uid
  const q = query(colRef, where('userUids', 'array-contains', uid), limit(boundedLimit));
  const snap = await getDocs(q);

  const uids: string[] = snap.docs.map((d) => {
    const data = d.data();
    return data.uidA === uid ? data.uidB : data.uidA;
  });
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return { uids, lastDoc };
};
