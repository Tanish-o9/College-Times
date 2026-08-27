import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';

export interface GroupNotificationPreferences {
  groupId: string;
  allNotifications: boolean;
  mentions: boolean;
  replies: boolean;
  chatMessages: boolean;
  newMoments: boolean;
  momentComments: boolean;
  polls: boolean;
  pollResults: boolean;
  events: boolean;
  eventReminders: boolean;
  announcements: boolean;
  joinRequests: boolean;
  membershipChanges: boolean;
  moderationActions: boolean;
  pinnedContent: boolean;
  groupActivity: boolean;
  pushEnabled: boolean;
  mutedUntil?: Timestamp | Date | null;
  updatedAt: any;
}

export const DEFAULT_GROUP_NOTIFICATION_PREFERENCES: Omit<GroupNotificationPreferences, 'groupId' | 'updatedAt'> = {
  allNotifications: true,
  mentions: true,
  replies: true,
  chatMessages: true,
  newMoments: true,
  momentComments: true,
  polls: true,
  pollResults: true,
  events: true,
  eventReminders: true,
  announcements: true,
  joinRequests: true,
  membershipChanges: true,
  moderationActions: true,
  pinnedContent: true,
  groupActivity: true,
  pushEnabled: true,
  mutedUntil: null,
};

/**
 * Fetches group notification preferences for a user.
 */
export const getGroupNotificationPreferences = async (
  userId: string,
  groupId: string
): Promise<GroupNotificationPreferences> => {
  if (!userId || !groupId) {
    return { groupId, ...DEFAULT_GROUP_NOTIFICATION_PREFERENCES, updatedAt: new Date() };
  }

  try {
    const prefRef = doc(db, 'users', userId, 'groupNotificationPreferences', groupId);
    const snap = await getDoc(prefRef);
    if (snap.exists()) {
      return { ...(snap.data() as GroupNotificationPreferences), groupId };
    }
  } catch (err) {
    console.error('Failed to get group notification preferences:', err);
  }

  return { groupId, ...DEFAULT_GROUP_NOTIFICATION_PREFERENCES, updatedAt: new Date() };
};

/**
 * Updates group notification preferences for a user.
 */
export const updateGroupNotificationPreferences = async (
  userId: string,
  groupId: string,
  prefs: Partial<GroupNotificationPreferences>
): Promise<void> => {
  if (!userId || !groupId) return;

  const prefRef = doc(db, 'users', userId, 'groupNotificationPreferences', groupId);
  await setDoc(
    prefRef,
    {
      groupId,
      ...prefs,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  logAnalyticsEvent('group_notification_preference_updated', { groupId });
};

/**
 * Mutes group notifications for a specified duration in minutes.
 */
export const muteGroupNotifications = async (
  userId: string,
  groupId: string,
  durationMinutes: number
): Promise<void> => {
  if (!userId || !groupId) return;

  const mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
  const prefRef = doc(db, 'users', userId, 'groupNotificationPreferences', groupId);

  await setDoc(
    prefRef,
    {
      groupId,
      mutedUntil,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  logAnalyticsEvent('group_notifications_muted', { groupId, durationMinutes });
};

/**
 * Unmutes group notifications for a user.
 */
export const unmuteGroupNotifications = async (
  userId: string,
  groupId: string
): Promise<void> => {
  if (!userId || !groupId) return;

  const prefRef = doc(db, 'users', userId, 'groupNotificationPreferences', groupId);
  await updateDoc(prefRef, {
    mutedUntil: null,
    updatedAt: serverTimestamp(),
  });

  logAnalyticsEvent('group_notifications_unmuted', { groupId });
};

/**
 * Checks if group notifications are muted for a user.
 */
export const isGroupNotificationMuted = async (
  userId: string,
  groupId: string
): Promise<boolean> => {
  if (!userId || !groupId) return false;

  try {
    const prefs = await getGroupNotificationPreferences(userId, groupId);
    if (!prefs.mutedUntil) return false;

    const muteTime = prefs.mutedUntil instanceof Date ? prefs.mutedUntil.getTime() : (prefs.mutedUntil as any).toMillis?.() || 0;
    return Date.now() < muteTime;
  } catch (err) {
    return false;
  }
};
