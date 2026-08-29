import { collection, query, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getFriends, getIncomingFriendRequests, getOutgoingFriendRequests } from './friendService';
import { getUserGroupIds } from './groupService';
import { isUserBlocked } from './directMessageService';
import type { User } from '../types/models';

export interface SuggestedFriend extends User {
  score: number;
  explanation: string;
}

/**
 * Generates a list of recommended people to add as friends based on mutual signals.
 */
export const getSuggestedFriends = async (
  currentUserId: string,
  limitCount: number = 5
): Promise<SuggestedFriend[]> => {
  if (!currentUserId) return [];
  try {
    // 1. Fetch current user profile
    const userDoc = await getDoc(doc(db, 'users', currentUserId));
    if (!userDoc.exists()) return [];
    const currentUser = userDoc.data() as User;

    // 2. Fetch candidate users (limit 100)
    const usersCol = collection(db, 'users');
    const usersSnap = await getDocs(query(usersCol, limit(100)));
    let candidates = usersSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as User));

    // 3. Fetch user's connections, requests, and groups
    const [friendsData, incomingReqs, outgoingReqs, myGroupIds] = await Promise.all([
      getFriends(currentUserId, 100),
      getIncomingFriendRequests(currentUserId),
      getOutgoingFriendRequests(currentUserId),
      getUserGroupIds(currentUserId),
    ]);

    const friendsUids = friendsData.uids;
    const pendingUids = [...incomingReqs.uids, ...outgoingReqs.uids];

    // 4. Fetch blocked users list
    const blockedColRef = collection(db, 'users', currentUserId, 'blockedUsers');
    const blockedSnap = await getDocs(blockedColRef);
    const blockedUids = blockedSnap.docs.map((d) => d.id);

    // 5. Exclude invalid candidates
    candidates = candidates.filter((c) => {
      if (c.uid === currentUserId) return false;
      if (friendsUids.includes(c.uid)) return false;
      if (pendingUids.includes(c.uid)) return false;
      if (blockedUids.includes(c.uid)) return false;
      if (c.profileStatus === 'suspended') return false;
      if (c.profileVisibility === 'private') return false;
      // Basic info validity
      if (!c.username || c.username.trim() === '' || c.username.startsWith('student_')) return false;
      if (!c.displayName || c.displayName === 'Student') return false;
      return true;
    });

    // 6. Perform a bi-directional block check on the candidate list
    const blockStatuses: Record<string, boolean> = {};
    await Promise.all(
      candidates.map(async (c) => {
        const blockedByThem = await isUserBlocked(c.uid, currentUserId);
        blockStatuses[c.uid] = blockedByThem;
      })
    );

    candidates = candidates.filter((c) => !blockStatuses[c.uid]);

    // 7. Score remaining candidates
    const scored = await Promise.all(
      candidates.map(async (c) => {
        let score = 0;
        let explanation = 'Popular student';

        // Same department
        if (c.departmentId && c.departmentId === currentUser.departmentId) {
          score += 40;
          explanation = 'In your department';
        } else if (c.department && c.department === currentUser.department) {
          score += 40;
          explanation = 'In your department';
        }

        // Same batch
        if (c.batchYear && c.batchYear === currentUser.batchYear) {
          score += 30;
          explanation = `From your batch year ${c.batchYear}`;
        }

        // Mutual groups check
        try {
          const candidateGroupIds = await getUserGroupIds(c.uid);
          const mutualGroups = candidateGroupIds.filter((id) => myGroupIds.includes(id));
          if (mutualGroups.length > 0) {
            score += mutualGroups.length * 15;
            explanation = `Shares ${mutualGroups.length} mutual groups`;
          }
        } catch (_) {
          // Non-fatal
        }

        return {
          ...c,
          score,
          explanation,
        };
      })
    );

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limitCount);
  } catch (err) {
    console.error('Error generating suggested friends:', err);
    return [];
  }
};
