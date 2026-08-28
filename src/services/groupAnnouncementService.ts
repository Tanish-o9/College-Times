import {
  collection,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import type { GroupAnnouncement } from '../types/group';
import { logGroupActivity } from './groupManagementService';
import { logGroupActivityEvent } from './groupActivityService';

export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export interface ExtendedGroupAnnouncement extends GroupAnnouncement {
  priority?: AnnouncementPriority;
}

/**
 * Creates an official Group Announcement (Owner/Admin only).
 * Publishes 1 FCM topic notification to `group_{groupId}` with 0 document fan-out.
 */
export const createGroupAnnouncement = async (
  groupId: string,
  title: string,
  content: string,
  priority: AnnouncementPriority = 'normal',
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<ExtendedGroupAnnouncement> => {
  if (!groupId || !currentUser) {
    throw new Error('Group ID and authentication required.');
  }

  const annRef = collection(db, 'groups', groupId, 'announcements');
  const annData: Omit<ExtendedGroupAnnouncement, 'id'> = {
    groupId,
    title: title.trim().slice(0, 150),
    content: content.trim().slice(0, 2000),
    createdBy: currentUser.uid,
    creatorName: userProfile?.displayName || currentUser.displayName || 'Group Admin',
    createdAt: serverTimestamp(),
    pinned: priority === 'urgent' || priority === 'important',
    priority,
    status: 'active',
  };

  const newDoc = await addDoc(annRef, annData);
  const actorName = userProfile?.displayName || currentUser.displayName || 'Admin';
  logGroupActivity(groupId, 'announcement_created', currentUser.uid, actorName, `Created ${priority} announcement: ${title}`);
  
  await logGroupActivityEvent(
    groupId,
    'announcement',
    currentUser.uid,
    actorName,
    userProfile?.photoURL || currentUser.photoURL || undefined,
    newDoc.id,
    'announcement',
    `Created announcement: ${title}`
  );

  logAnalyticsEvent('group_announcement_created', { groupId, priority });

  return {
    id: newDoc.id,
    ...annData,
    createdAt: new Date(),
  } as ExtendedGroupAnnouncement;
};

/**
 * Fetches active group announcements.
 */
export const getGroupAnnouncements = async (
  groupId: string,
  limitCount: number = 10
): Promise<ExtendedGroupAnnouncement[]> => {
  if (!groupId) return [];

  const annRef = collection(db, 'groups', groupId, 'announcements');
  const q = query(annRef, where('status', '==', 'active'), orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ExtendedGroupAnnouncement[];
};

/**
 * Soft deletes an announcement.
 */
export const deleteGroupAnnouncement = async (
  groupId: string,
  announcementId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!groupId || !announcementId || !currentUser) return;

  const annRef = doc(db, 'groups', groupId, 'announcements', announcementId);
  await updateDoc(annRef, {
    status: 'deleted',
    updatedAt: serverTimestamp(),
  });

  logGroupActivity(groupId, 'announcement_deleted', currentUser.uid, 'Admin', `Deleted announcement ${announcementId}`);
};

/**
 * Marks an announcement as read for the user.
 */
export const markAnnouncementAsRead = async (
  groupId: string,
  announcementId: string,
  userId: string
): Promise<void> => {
  if (!groupId || !announcementId || !userId) return;

  const readRef = doc(db, 'users', userId, 'groupAnnouncementReads', announcementId);
  await setDoc(readRef, {
    groupId,
    announcementId,
    readAt: serverTimestamp(),
  });
};
