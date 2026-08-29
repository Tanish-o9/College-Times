import { collection, query, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getUserGroupIds } from './groupService';
import type { CampusGroup } from '../types/group';

export interface SuggestedGroup extends CampusGroup {
  score: number;
  explanation: string;
}

/**
 * Recommends groups to join based on user department, batch, and group popularity.
 */
export const getSuggestedGroups = async (
  currentUserId: string,
  limitCount: number = 5
): Promise<SuggestedGroup[]> => {
  if (!currentUserId) return [];
  try {
    // 1. Fetch user joined group IDs
    const joinedGroupIds = await getUserGroupIds(currentUserId);

    // 2. Fetch user profile for department/batch match
    const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUserId), limit(1)));
    const currentUser = userSnap.docs.length > 0 ? userSnap.docs[0].data() : null;

    // 3. Fetch active groups (limit 50)
    const groupsRef = collection(db, 'groups');
    const q = query(groupsRef, where('active', '==', true), limit(50));
    const snap = await getDocs(q);
    let candidates = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CampusGroup));

    // 4. Exclude already joined groups
    candidates = candidates.filter((g) => !joinedGroupIds.includes(g.id));

    // 5. Score remaining groups
    const scored = candidates.map((g) => {
      let score = g.memberCount || 0;
      let explanation = 'Popular group on campus';

      if (currentUser) {
        if (currentUser.departmentId && g.description?.toLowerCase().includes(currentUser.departmentId.toLowerCase())) {
          score += 40;
          explanation = 'Recommended for your department';
        } else if (currentUser.department && g.description?.toLowerCase().includes(currentUser.department.toLowerCase())) {
          score += 40;
          explanation = 'Recommended for your department';
        }

        if (currentUser.batchYear && g.description?.toLowerCase().includes(String(currentUser.batchYear))) {
          score += 30;
          explanation = 'Popular in your batch year';
        }
      }

      return {
        ...g,
        score,
        explanation,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limitCount);
  } catch (err) {
    console.error('Error generating suggested groups:', err);
    return [];
  }
};
