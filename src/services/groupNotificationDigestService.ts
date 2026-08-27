import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface GroupNotificationDigest {
  groupId: string;
  unreadActivitiesCount: number;
  latestActivityPreview?: string;
  digestText: string;
}

/**
 * Generates a lightweight aggregated presentation summary for group activity notifications
 * without producing per-user Firestore notification document fan-out.
 */
export const generateGroupNotificationDigest = async (
  groupId: string,
  _userId: string
): Promise<GroupNotificationDigest> => {
  if (!groupId) {
    return { groupId, unreadActivitiesCount: 0, digestText: 'No recent group activity.' };
  }

  try {
    const activityColRef = collection(db, 'groups', groupId, 'activity');
    const snap = await getDocs(query(activityColRef, limit(5)));

    if (snap.empty) {
      return { groupId, unreadActivitiesCount: 0, digestText: 'No recent group activity.' };
    }

    const count = snap.size;
    const latestDoc = snap.docs[0].data();
    const actorName = latestDoc.actorName || 'Group member';
    const preview = latestDoc.preview || 'new updates';

    return {
      groupId,
      unreadActivitiesCount: count,
      latestActivityPreview: preview,
      digestText: `${actorName} and ${count - 1 > 0 ? count - 1 + ' others' : 'others'} posted recent updates in group.`,
    };
  } catch (err) {
    return { groupId, unreadActivitiesCount: 0, digestText: 'No recent group activity.' };
  }
};
