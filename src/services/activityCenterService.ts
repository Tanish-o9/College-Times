import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  onSnapshot,
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
  targetType?: string;
  previewText?: string;
  isPrivate?: boolean;
  createdAt: any;
}

/**
 * Logs a new campus activity event to the global campusActivities collection.
 * Non-blocking: swallows errors so primary app actions are protected.
 */
export const logCampusActivity = async (
  activity: Omit<CampusActivityItem, 'id' | 'createdAt'>,
  customDocId?: string
): Promise<string | null> => {
  try {
    if (!activity.actorId) return null;

    const colRef = collection(db, 'campusActivities');
    const sanitizedData = {
      ...activity,
      actorName: (activity.actorName || 'Student').trim().slice(0, 100),
      action: (activity.action || '').trim().slice(0, 150),
      targetTitle: activity.targetTitle ? activity.targetTitle.trim().slice(0, 150) : undefined,
      previewText: activity.previewText ? activity.previewText.trim().slice(0, 250) : undefined,
      createdAt: serverTimestamp(),
    };

    if (customDocId) {
      const docRef = doc(colRef, customDocId);
      await setDoc(docRef, sanitizedData, { merge: true });
      logAnalyticsEvent('campus_activity_logged', { type: activity.type, action: activity.action });
      return customDocId;
    } else {
      const docRef = await addDoc(colRef, sanitizedData);
      logAnalyticsEvent('campus_activity_logged', { type: activity.type, action: activity.action });
      return docRef.id;
    }
  } catch (err) {
    console.warn('[ACTIVITY DEBUG] Non-blocking activity log warning:', err);
    return null;
  }
};

/**
 * Subscribes in real-time to campus activities.
 */
export const subscribeCampusActivities = (
  onUpdate: (activities: CampusActivityItem[], lastDocSnap: QueryDocumentSnapshot | null) => void,
  onError: (err: Error) => void,
  limitCount: number = 30
): (() => void) => {
  const colRef = collection(db, 'campusActivities');
  const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: CampusActivityItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as CampusActivityItem));

      const lastDocSnap = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
      onUpdate(items, lastDocSnap);
    },
    (err) => {
      console.error('[ACTIVITY DEBUG] Error in campus activities snapshot:', err);
      onError(err);
    }
  );
};

/**
 * Fetches cursor-paginated campus activities.
 */
export const getCampusActivitiesPaginated = async (
  limitCount: number = 20,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<{ activities: CampusActivityItem[]; lastDoc: QueryDocumentSnapshot | null }> => {
  try {
    const colRef = collection(db, 'campusActivities');
    const q = lastDoc
      ? query(colRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(limitCount))
      : query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));

    const snap = await getDocs(q);
    const activities: CampusActivityItem[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as CampusActivityItem));

    const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return {
      activities,
      lastDoc: newLastDoc,
    };
  } catch (err) {
    console.error('Failed to fetch campus activities:', err);
    throw err;
  }
};
