import { collection, doc, getDocs, setDoc, query, orderBy, limit, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

const VIEW_THROTTLE_MS = 60000; // 1 minute throttle per entityId
const viewThrottleCache = new Map<string, number>();

export interface RecentlyViewedItem {
  id: string;
  entityId: string;
  entityType: 'post' | 'profile' | 'group' | 'event' | 'marketplace' | 'opportunity';
  viewedAt: any;
}

/**
 * Records a view for a given entity, with client-side throttling to avoid duplicate writes.
 */
export const recordEntityView = async (
  userId: string,
  entityId: string,
  entityType: 'post' | 'profile' | 'group' | 'event' | 'marketplace' | 'opportunity'
): Promise<void> => {
  if (!userId || !entityId) return;

  // 1. Check in-memory throttle cache
  const cacheKey = `${userId}_${entityId}`;
  const now = Date.now();
  const lastViewed = viewThrottleCache.get(cacheKey) || 0;
  if (now - lastViewed < VIEW_THROTTLE_MS) {
    return; // Throttled
  }
  viewThrottleCache.set(cacheKey, now);

  try {
    // 2. Write view log
    const docRef = doc(db, 'users', userId, 'recentlyViewed', entityId);
    await setDoc(docRef, {
      entityId,
      entityType,
      viewedAt: serverTimestamp(),
    });

    // 3. Prune old records (Limit to 30 items)
    const colRef = collection(db, 'users', userId, 'recentlyViewed');
    const q = query(colRef, orderBy('viewedAt', 'desc'));
    const snap = await getDocs(q);

    if (snap.docs.length > 25) {
      const batch = writeBatch(db);
      for (let i = 25; i < snap.docs.length; i++) {
        batch.delete(snap.docs[i].ref);
      }
      await batch.commit();
    }
  } catch (err) {
    console.error('Failed to record recently viewed entity:', err);
  }
};

/**
 * Fetches user recently viewed entities.
 */
export const getRecentlyViewed = async (
  userId: string,
  limitCount: number = 20
): Promise<RecentlyViewedItem[]> => {
  if (!userId) return [];
  const boundedLimit = Math.min(50, Math.max(1, limitCount));
  try {
    const colRef = collection(db, 'users', userId, 'recentlyViewed');
    const q = query(colRef, orderBy('viewedAt', 'desc'), limit(boundedLimit));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as RecentlyViewedItem[];
  } catch (err) {
    console.error('Failed to load recently viewed list:', err);
    return [];
  }
};

/**
 * Clears recently viewed history.
 */
export const clearRecentlyViewed = async (userId: string): Promise<void> => {
  if (!userId) return;
  try {
    const colRef = collection(db, 'users', userId, 'recentlyViewed');
    const snap = await getDocs(colRef);
    if (snap.docs.length === 0) return;

    const batch = writeBatch(db);
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  } catch (err) {
    console.error('Failed to clear recently viewed history:', err);
  }
};
