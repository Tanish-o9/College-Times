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
  increment,
  runTransaction,
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
  publishAt?: any;
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
  userProfile?: User | null,
  publishAt?: Date | null
): Promise<ExtendedGroupAnnouncement> => {
  if (!groupId || !currentUser) {
    throw new Error('Group ID and authentication required.');
  }

  const isScheduled = publishAt && publishAt.getTime() > Date.now();
  const status = isScheduled ? 'scheduled' : 'active';

  const annRef = collection(db, 'groups', groupId, 'announcements');
  const annData: Omit<ExtendedGroupAnnouncement, 'id'> = {
    groupId,
    title: title.trim().slice(0, 150),
    content: content.trim().slice(0, 2000),
    createdBy: currentUser.uid,
    creatorName: userProfile?.displayName || currentUser.displayName || 'Group Admin',
    createdAt: serverTimestamp(),
    publishAt: publishAt || null,
    pinned: priority === 'urgent' || priority === 'important',
    priority,
    status,
  };

  const newDoc = await addDoc(annRef, annData);
  const actorName = userProfile?.displayName || currentUser.displayName || 'Admin';

  if (status === 'active') {
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
  }

  logAnalyticsEvent('group_announcement_created', { groupId, priority, status });

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
/**
 * Marks an announcement as read for the user inside the announcement subcollection reads.
 */
export const markAnnouncementAsRead = async (
  groupId: string,
  announcementId: string,
  userId: string
): Promise<void> => {
  if (!groupId || !announcementId || !userId) return;

  const readRef = doc(db, 'groups', groupId, 'announcements', announcementId, 'reads', userId);
  await setDoc(readRef, {
    userId,
    readAt: serverTimestamp(),
  });
};

/**
 * Archives a group announcement (status = 'archived').
 */
export const archiveAnnouncement = async (
  groupId: string,
  announcementId: string
): Promise<void> => {
  if (!groupId || !announcementId) return;
  const annRef = doc(db, 'groups', groupId, 'announcements', announcementId);
  await updateDoc(annRef, {
    status: 'archived',
    archivedAt: serverTimestamp(),
  });
};

/**
 * Transactionally updates or toggles emoji reactions on an announcement.
 */
export const toggleAnnouncementReaction = async (
  groupId: string,
  announcementId: string,
  userId: string,
  emoji: string
): Promise<void> => {
  if (!groupId || !announcementId || !userId || !emoji) return;

  const reactionRef = doc(db, 'groups', groupId, 'announcements', announcementId, 'reactions', userId);
  const annRef = doc(db, 'groups', groupId, 'announcements', announcementId);

  await runTransaction(db, async (transaction) => {
    const annSnap = await transaction.get(annRef);
    if (!annSnap.exists()) {
      throw new Error('Announcement no longer exists.');
    }

    const reactionSnap = await transaction.get(reactionRef);

    if (!reactionSnap.exists()) {
      transaction.set(reactionRef, {
        emoji,
        userId,
        createdAt: serverTimestamp(),
      });
      transaction.update(annRef, {
        [`reactionCounts.${emoji}`]: increment(1),
      });
    } else {
      const existingEmoji = reactionSnap.data().emoji;

      if (existingEmoji === emoji) {
        transaction.delete(reactionRef);
        const currentCounts = annSnap.data().reactionCounts || {};
        const currentVal = currentCounts[emoji] || 0;
        const newVal = Math.max(0, currentVal - 1);
        transaction.update(annRef, {
          [`reactionCounts.${emoji}`]: newVal,
        });
      } else {
        transaction.set(reactionRef, {
          emoji,
          userId,
          updatedAt: serverTimestamp(),
        });
        const currentCounts = annSnap.data().reactionCounts || {};
        const oldVal = currentCounts[existingEmoji] || 0;
        const newOldVal = Math.max(0, oldVal - 1);
        transaction.update(annRef, {
          [`reactionCounts.${existingEmoji}`]: newOldVal,
          [`reactionCounts.${emoji}`]: increment(1),
        });
      }
    }
  });

  logAnalyticsEvent('announcement_reaction_toggled', { groupId, announcementId, emoji });
};

/**
 * Releases scheduled announcements whose publish time has arrived.
 */
export const publishScheduledAnnouncements = async (groupId: string): Promise<void> => {
  if (!groupId) return;
  try {
    const annRef = collection(db, 'groups', groupId, 'announcements');
    const q = query(
      annRef,
      where('status', '==', 'scheduled'),
      where('publishAt', '<=', new Date())
    );
    const snap = await getDocs(q);

    for (const d of snap.docs) {
      await updateDoc(d.ref, {
        status: 'active',
        createdAt: serverTimestamp(), // reset creation to publish time
      });
    }
  } catch (err) {
    console.error('Error publishing scheduled announcements:', err);
  }
};

/**
 * Pin or unpin an announcement in a group (admin/owner only).
 */
export const pinAnnouncement = async (
  groupId: string,
  announcementId: string,
  isPinned: boolean
): Promise<void> => {
  if (!groupId || !announcementId) return;
  const annRef = doc(db, 'groups', groupId, 'announcements', announcementId);
  await updateDoc(annRef, {
    pinned: isPinned,
    pinnedAt: isPinned ? serverTimestamp() : null,
  });
  logAnalyticsEvent('announcement_pinned_toggled', { groupId, announcementId, isPinned });
};
