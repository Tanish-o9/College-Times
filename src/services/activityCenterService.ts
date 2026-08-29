import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';

export interface CampusActivityItem {
  id?: string;
  type: 'friend' | 'group' | 'event' | 'marketplace' | 'opportunity' | 'academic' | 'challenge' | 'support' | 'system';
  action: string;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  groupId?: string;
  groupName?: string;
  targetId?: string;
  targetTitle?: string;
  previewText?: string;
  isPrivate?: boolean;
  createdAt: any;
}

/**
 * Logs a new campus activity event to the global campusActivities collection.
 */
export const logCampusActivity = async (
  activity: Omit<CampusActivityItem, 'id' | 'createdAt'>
): Promise<string> => {
  try {
    const colRef = collection(db, 'campusActivities');
    const docRef = await addDoc(colRef, {
      ...activity,
      createdAt: serverTimestamp(),
    });
    logAnalyticsEvent('campus_activity_logged', { type: activity.type, action: activity.action });
    return docRef.id;
  } catch (err) {
    console.error('Failed to log campus activity:', err);
    throw err;
  }
};

/**
 * Fetches cursor-paginated campus activities with in-memory block and privacy group filters.
 */
export const getCampusActivitiesPaginated = async (
  joinedGroupIds: string[],
  blockedUserIds: string[],
  categoryFilter?: string,
  limitCount: number = 20,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<{ activities: CampusActivityItem[]; lastDoc: QueryDocumentSnapshot | null }> => {
  try {
    const colRef = collection(db, 'campusActivities');
    const q = lastDoc
      ? query(colRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(limitCount * 2))
      : query(colRef, orderBy('createdAt', 'desc'), limit(limitCount * 2));

    const snap = await getDocs(q);
    const rawList: CampusActivityItem[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as CampusActivityItem));

    const filteredList = rawList.filter((item) => {
      if (categoryFilter && categoryFilter !== 'all' && item.type !== categoryFilter) return false;
      if (item.groupId && item.isPrivate) {
        if (!joinedGroupIds.includes(item.groupId)) return false;
      }
      if (blockedUserIds.includes(item.actorId)) return false;
      return true;
    });

    const paginatedResult = filteredList.slice(0, limitCount);
    const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return {
      activities: paginatedResult,
      lastDoc: newLastDoc,
    };
  } catch (err) {
    console.error('Failed to fetch campus activities:', err);
    return { activities: [], lastDoc: null };
  }
};
