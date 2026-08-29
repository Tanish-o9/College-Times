import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  getDocs,
  serverTimestamp,
  orderBy,
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
  userProfile?: User | null
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
