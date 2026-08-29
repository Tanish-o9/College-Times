import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface GroupAnalytics {
  memberCount: number;
  postCount: number;
  eventCount: number;
  announcementCount: number;
  resourceCount: number;
}

/**
 * High-performance server-side aggregation for group metrics.
 * Runs concurrent counting queries to save bandwidth and read limits.
 */
export const getGroupAnalytics = async (groupId: string): Promise<GroupAnalytics> => {
  if (!groupId) {
    return { memberCount: 0, postCount: 0, eventCount: 0, announcementCount: 0, resourceCount: 0 };
  }

  try {
    const membersRef = collection(db, 'groups', groupId, 'members');
    const postsRef = collection(db, 'posts');
    const eventsRef = collection(db, 'events');
    const announcementsRef = collection(db, 'groups', groupId, 'announcements');
    const resourcesRef = collection(db, 'groups', groupId, 'resources');

    const [memberSnap, postsSnap, eventsSnap, announcementsSnap, resourcesSnap] = await Promise.all([
      getCountFromServer(query(membersRef)),
      getCountFromServer(query(postsRef, where('groupId', '==', groupId), where('status', '==', 'active'))),
      getCountFromServer(query(eventsRef, where('groupId', '==', groupId))),
      getCountFromServer(query(announcementsRef, where('status', '==', 'active'))),
      getCountFromServer(query(resourcesRef)),
    ]);

    return {
      memberCount: memberSnap.data().count,
      postCount: postsSnap.data().count,
      eventCount: eventsSnap.data().count,
      announcementCount: announcementsSnap.data().count,
      resourceCount: resourcesSnap.data().count,
    };
  } catch (err) {
    console.error('Failed to aggregate group analytics:', err);
    throw err;
  }
};
