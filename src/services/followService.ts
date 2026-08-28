import { QueryDocumentSnapshot } from 'firebase/firestore';
import {
  getRelationshipStatus,
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getIncomingFriendRequests,
  getFriends
} from './friendService';

export const followUser = async (
  currentUid: string,
  targetUid: string,
  _targetIsPrivate: boolean = false
): Promise<boolean> => {
  return sendFriendRequest(currentUid, targetUid);
};

export const unfollowUser = async (currentUid: string, targetUid: string): Promise<void> => {
  const status = await getRelationshipStatus(currentUid, targetUid);
  if (status === 'FRIENDS') {
    await removeFriend(currentUid, targetUid);
  } else if (status === 'OUTGOING_PENDING') {
    await cancelFriendRequest(currentUid, targetUid);
  }
};

export const isFollowingUser = async (currentUid: string, targetUid: string): Promise<boolean> => {
  const status = await getRelationshipStatus(currentUid, targetUid);
  return status === 'FRIENDS';
};

export const hasPendingFollowRequest = async (currentUid: string, targetUid: string): Promise<boolean> => {
  const status = await getRelationshipStatus(currentUid, targetUid);
  return status === 'OUTGOING_PENDING';
};

export const getFollowersPage = async (
  uid: string,
  limitCount: number = 20
): Promise<{ uids: string[]; lastDoc: QueryDocumentSnapshot | null }> => {
  return getFriends(uid, limitCount);
};

export const getFollowingPage = async (
  uid: string,
  limitCount: number = 20
): Promise<{ uids: string[]; lastDoc: QueryDocumentSnapshot | null }> => {
  return getFriends(uid, limitCount);
};

export const getFollowRequests = async (
  uid: string
): Promise<{ uids: string[] }> => {
  return getIncomingFriendRequests(uid);
};

export const acceptFollowRequest = async (
  targetUid: string,
  requesterUid: string
): Promise<void> => {
  return acceptFriendRequest(targetUid, requesterUid);
};

export const rejectFollowRequest = async (
  targetUid: string,
  requesterUid: string
): Promise<void> => {
  return declineFriendRequest(targetUid, requesterUid);
};
