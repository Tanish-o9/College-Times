import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';

export type PinnedTargetType = 'post' | 'moment' | 'poll' | 'announcement' | 'event';

export interface PinnedItem {
  id?: string;
  groupId: string;
  targetType: PinnedTargetType;
  targetId: string;
  pinnedBy: string;
  pinnedAt: any;
  position?: number;
  status: 'active' | 'removed';
}

/**
 * Pins a post, moment, poll, announcement, or event to the group home header (bounded max 20 pins).
 */
export const pinGroupContent = async (
  groupId: string,
  targetType: PinnedTargetType,
  targetId: string,
  pinnedBy: string
): Promise<PinnedItem> => {
  if (!groupId || !targetId || !pinnedBy) {
    throw new Error('Group ID, target item, and user authentication required.');
  }

  // Enforce max 20 pinned items check
  const pinnedColRef = collection(db, 'groups', groupId, 'pinnedItems');
  const existingSnap = await getDocs(query(pinnedColRef, where('status', '==', 'active'), limit(20)));
  if (existingSnap.size >= 20) {
    throw new Error('Maximum limit of 20 pinned items reached for this group.');
  }

  const pinDocRef = doc(pinnedColRef);
  const pinData: Omit<PinnedItem, 'id'> = {
    groupId,
    targetType,
    targetId,
    pinnedBy,
    pinnedAt: serverTimestamp(),
    position: existingSnap.size + 1,
    status: 'active',
  };

  await setDoc(pinDocRef, pinData);
  logAnalyticsEvent('group_content_pinned', { groupId, targetType, targetId });

  return { id: pinDocRef.id, ...pinData, pinnedAt: new Date() } as PinnedItem;
};

/**
 * Unpins a pinned item from the group home header.
 */
export const unpinGroupContent = async (groupId: string, pinId: string): Promise<void> => {
  if (!groupId || !pinId) return;

  const pinRef = doc(db, 'groups', groupId, 'pinnedItems', pinId);
  await updateDoc(pinRef, {
    status: 'removed',
    updatedAt: serverTimestamp(),
  });

  logAnalyticsEvent('group_content_unpinned', { groupId, pinId });
};

/**
 * Fetches active pinned items for a group (limit 20).
 */
export const getPinnedGroupContent = async (groupId: string): Promise<PinnedItem[]> => {
  if (!groupId) return [];

  const pinnedColRef = collection(db, 'groups', groupId, 'pinnedItems');
  const q = query(pinnedColRef, where('status', '==', 'active'), orderBy('pinnedAt', 'desc'), limit(20));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PinnedItem[];
};
