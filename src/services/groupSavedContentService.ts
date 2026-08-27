import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';

export type SavedGroupContentType = 'post' | 'moment' | 'poll' | 'event' | 'announcement';

export interface SavedGroupContentItem {
  id?: string;
  groupId: string;
  targetType: SavedGroupContentType;
  targetId: string;
  savedAt: any;
}

/**
 * Saves group content privately for a user (idempotent deterministic document ID).
 */
export const saveGroupContent = async (
  groupId: string,
  targetType: SavedGroupContentType,
  targetId: string,
  userId: string
): Promise<void> => {
  if (!groupId || !targetType || !targetId || !userId) return;

  const saveId = `${groupId}_${targetType}_${targetId}`;
  const saveRef = doc(db, 'users', userId, 'savedGroupContent', saveId);

  await setDoc(saveRef, {
    groupId,
    targetType,
    targetId,
    savedAt: serverTimestamp(),
  });

  logAnalyticsEvent('group_content_saved', { groupId, targetType, targetId });
};

/**
 * Unsaves a previously saved group content item.
 */
export const unsaveGroupContent = async (
  groupId: string,
  targetType: SavedGroupContentType,
  targetId: string,
  userId: string
): Promise<void> => {
  if (!groupId || !targetType || !targetId || !userId) return;

  const saveId = `${groupId}_${targetType}_${targetId}`;
  const saveRef = doc(db, 'users', userId, 'savedGroupContent', saveId);

  await deleteDoc(saveRef);
  logAnalyticsEvent('group_content_unsaved', { groupId, targetType, targetId });
};

/**
 * Checks if a group content item is saved by the user.
 */
export const isGroupContentSaved = async (
  groupId: string,
  targetType: SavedGroupContentType,
  targetId: string,
  userId: string
): Promise<boolean> => {
  if (!groupId || !targetType || !targetId || !userId) return false;

  try {
    const saveId = `${groupId}_${targetType}_${targetId}`;
    const saveRef = doc(db, 'users', userId, 'savedGroupContent', saveId);
    const snap = await getDoc(saveRef);
    return snap.exists();
  } catch (err) {
    return false;
  }
};

/**
 * Fetches user's saved group content list.
 */
export const getSavedGroupContent = async (
  userId: string,
  limitCount: number = 30
): Promise<SavedGroupContentItem[]> => {
  if (!userId) return [];

  const boundedSize = Math.min(50, Math.max(1, limitCount));
  const savedColRef = collection(db, 'users', userId, 'savedGroupContent');
  const q = query(savedColRef, orderBy('savedAt', 'desc'), limit(boundedSize));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as SavedGroupContentItem[];
};
