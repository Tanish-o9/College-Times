import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Efficiently computes the count of mutual friends between currentUid and targetUid.
 *
 * Strategy:
 * 1. Fetch currentUid's friends (UIDs only, bounded to 200 max)
 * 2. Fetch targetUid's friends (UIDs only, bounded to 200 max)
 * 3. Intersect the two sets in memory — O(n) with Set lookup
 *
 * This avoids N+1 Firestore reads by using array-contains queries that return
 * friend UID lists, then computing intersection in-memory.
 */

const FRIEND_FETCH_LIMIT = 200;

/** Returns the Set of friend UIDs for a given user. */
const getFriendUidSet = async (uid: string): Promise<Set<string>> => {
  if (!uid) return new Set();
  try {
    const q = query(
      collection(db, 'friendships'),
      where('userUids', 'array-contains', uid),
      limit(FRIEND_FETCH_LIMIT)
    );
    const snap = await getDocs(q);
    const uids = new Set<string>();
    snap.docs.forEach((d) => {
      const data = d.data();
      // Each friendship doc stores uidA and uidB; add the "other" one
      const other = data.uidA === uid ? data.uidB : data.uidA;
      if (other) uids.add(other);
    });
    return uids;
  } catch (err) {
    console.error(`mutualFriendsService: failed to get friends for ${uid}`, err);
    return new Set();
  }
};

/**
 * Returns the count of mutual friends between currentUid and targetUid.
 * Returns 0 for same user or on error (never throws).
 */
export const getMutualFriendsCount = async (
  currentUid: string,
  targetUid: string
): Promise<number> => {
  if (!currentUid || !targetUid || currentUid === targetUid) return 0;
  try {
    const [myFriends, theirFriends] = await Promise.all([
      getFriendUidSet(currentUid),
      getFriendUidSet(targetUid),
    ]);

    let count = 0;
    // Iterate the smaller set for efficiency
    const [smaller, larger] =
      myFriends.size <= theirFriends.size
        ? [myFriends, theirFriends]
        : [theirFriends, myFriends];

    smaller.forEach((uid) => {
      if (uid !== currentUid && uid !== targetUid && larger.has(uid)) {
        count++;
      }
    });
    return count;
  } catch (err) {
    console.error('mutualFriendsService: error computing mutual friends count', err);
    return 0;
  }
};

/**
 * Returns the UIDs of mutual friends (for showing avatars, etc.).
 * Bounded to `limitCount` results.
 */
export const getMutualFriendUids = async (
  currentUid: string,
  targetUid: string,
  limitCount = 5
): Promise<string[]> => {
  if (!currentUid || !targetUid || currentUid === targetUid) return [];
  try {
    const [myFriends, theirFriends] = await Promise.all([
      getFriendUidSet(currentUid),
      getFriendUidSet(targetUid),
    ]);

    const mutual: string[] = [];
    myFriends.forEach((uid) => {
      if (uid !== currentUid && uid !== targetUid && theirFriends.has(uid)) {
        mutual.push(uid);
      }
    });
    return mutual.slice(0, limitCount);
  } catch (err) {
    return [];
  }
};
