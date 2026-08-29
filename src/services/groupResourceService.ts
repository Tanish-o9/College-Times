import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  getDocs,
  setDoc,
  serverTimestamp,
  orderBy,
  increment,
  runTransaction,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import { logGroupActivityEvent } from './groupActivityService';

export interface GroupResource {
  id?: string;
  groupId: string;
  title: string;
  description?: string;
  link: string;
  type: 'link' | 'note' | 'document' | 'other';
  createdBy: string;
  creatorName: string;
  createdAt: any;
  category?: string;
  tags?: string[];
  department?: string;
  batch?: string;
  subject?: string;
  semester?: string;
  difficulty?: string;
  rating?: number;
  ratingCount?: number;
  viewCount?: number;
  downloadCount?: number;
}

/**
 * Creates a new resource link or study material document metadata in a group.
 */
export const createGroupResource = async (
  groupId: string,
  title: string,
  description: string,
  link: string,
  type: GroupResource['type'],
  currentUser: FirebaseUser,
  userProfile?: User | null,
  extendedData?: Partial<Pick<GroupResource, 'category' | 'tags' | 'department' | 'batch' | 'subject' | 'semester' | 'difficulty'>>
): Promise<GroupResource> => {
  if (!groupId || !currentUser) {
    throw new Error('Group ID and authentication are required.');
  }

  const cleanTitle = title.trim().slice(0, 100);
  const cleanDesc = description.trim().slice(0, 500);
  const cleanLink = link.trim();

  if (!cleanTitle) throw new Error('Resource title is required.');
  if (!cleanLink) throw new Error('Resource link or reference URL is required.');

  const resourceColRef = collection(db, 'groups', groupId, 'resources');
  const creatorName = userProfile?.displayName || currentUser.displayName || 'Campus Member';

  const newResource: Omit<GroupResource, 'id'> = {
    groupId,
    title: cleanTitle,
    description: cleanDesc,
    link: cleanLink,
    type,
    createdBy: currentUser.uid,
    creatorName,
    createdAt: serverTimestamp(),
    category: extendedData?.category || 'Notes',
    tags: extendedData?.tags || [],
    department: extendedData?.department || '',
    batch: extendedData?.batch || '',
    subject: extendedData?.subject || '',
    semester: extendedData?.semester || '',
    difficulty: extendedData?.difficulty || 'Medium',
    rating: 0,
    ratingCount: 0,
    viewCount: 0,
    downloadCount: 0,
  };

  const docRef = await addDoc(resourceColRef, newResource);

  await logGroupActivityEvent(
    groupId,
    'membership_change', // using generic membership change or custom preview
    currentUser.uid,
    creatorName,
    userProfile?.photoURL || currentUser.photoURL || undefined,
    docRef.id,
    'resource',
    `Added resource: ${cleanTitle}`
  );

  logAnalyticsEvent('group_resource_created', { groupId, type });

  return {
    id: docRef.id,
    ...newResource,
    createdAt: new Date(),
  };
};

/**
 * Fetches all active resources inside a group.
 */
export const getGroupResources = async (groupId: string): Promise<GroupResource[]> => {
  if (!groupId) return [];

  const resourceColRef = collection(db, 'groups', groupId, 'resources');
  const q = query(resourceColRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<GroupResource, 'id'>),
  }));
};

/**
 * Deletes a resource document.
 */
export const deleteGroupResource = async (
  groupId: string,
  resourceId: string
): Promise<void> => {
  if (!groupId || !resourceId) return;

  const resourceRef = doc(db, 'groups', groupId, 'resources', resourceId);
  await deleteDoc(resourceRef);
  logAnalyticsEvent('group_resource_deleted', { groupId, resourceId });
};

/**
 * Saves/bookmarks a resource link for the current user.
 */
export const saveResource = async (
  resourceId: string,
  groupId: string,
  title: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !resourceId || !groupId) throw new Error('Authentication required.');

  const saveRef = doc(db, 'users', currentUser.uid, 'savedResources', resourceId);
  await setDoc(saveRef, {
    resourceId,
    groupId,
    title,
    savedAt: serverTimestamp(),
  });

  logAnalyticsEvent('group_resource_saved', { groupId, resourceId });
};

/**
 * Reports a group resource for moderation.
 */
export const reportResource = async (
  groupId: string,
  resourceId: string,
  reason: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !resourceId || !groupId) throw new Error('Authentication required.');

  const reportRef = doc(db, 'reports', `resource_${resourceId}_${currentUser.uid}`);
  await setDoc(reportRef, {
    reportedEntityId: resourceId,
    reportedEntityType: 'resource',
    groupId,
    reason,
    reporterId: currentUser.uid,
    status: 'OPEN',
    createdAt: serverTimestamp(),
  });

  logAnalyticsEvent('group_resource_reported', { groupId, resourceId });
};

/**
 * Transactionally increments resource download or view counts.
 */
export const incrementResourceCount = async (
  groupId: string,
  resourceId: string,
  type: 'view' | 'download'
): Promise<void> => {
  if (!groupId || !resourceId) return;

  const resourceRef = doc(db, 'groups', groupId, 'resources', resourceId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(resourceRef);
    if (!snap.exists()) return;

    const field = type === 'view' ? 'viewCount' : 'downloadCount';
    tx.update(resourceRef, {
      [field]: increment(1),
    });
  });

  logAnalyticsEvent('group_resource_count_incremented', { groupId, resourceId, type });
};

/**
 * Submits a rating review (1-5) and transactionally updates resource avg score.
 * Prevents duplicate ratings by saving rating under subcollection with userId.
 */
export const submitResourceRating = async (
  groupId: string,
  resourceId: string,
  ratingVal: number,
  userId: string
): Promise<void> => {
  if (!groupId || !resourceId || !userId) throw new Error('Params missing for rating.');
  if (ratingVal < 1 || ratingVal > 5) throw new Error('Rating must be between 1 and 5.');

  const ratingDocRef = doc(db, 'groups', groupId, 'resources', resourceId, 'ratings', userId);
  const resourceRef = doc(db, 'groups', groupId, 'resources', resourceId);

  await runTransaction(db, async (tx) => {
    const ratingSnap = await tx.get(ratingDocRef);
    if (ratingSnap.exists()) throw new Error('You have already rated this study resource.');

    const resSnap = await tx.get(resourceRef);
    if (!resSnap.exists()) throw new Error('Resource not found.');

    const currentRating = resSnap.data().rating || 0;
    const currentCount = resSnap.data().ratingCount || 0;

    const nextCount = currentCount + 1;
    const nextRating = Math.round(((currentRating * currentCount + ratingVal) / nextCount) * 10) / 10;

    tx.set(ratingDocRef, {
      rating: ratingVal,
      userId,
      createdAt: serverTimestamp(),
    });

    tx.update(resourceRef, {
      rating: nextRating,
      ratingCount: nextCount,
    });
  });

  logAnalyticsEvent('group_resource_rated', { groupId, resourceId, ratingVal });
};
