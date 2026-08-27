import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';

export interface GroupNotificationMutePreferences {
  muted: boolean;
  announcements: boolean;
  moments: boolean;
  chat: boolean;
  updatedAt?: any;
}

export const DEFAULT_GROUP_MUTE_PREFERENCES: GroupNotificationMutePreferences = {
  muted: false,
  announcements: true,
  moments: true,
  chat: true,
};

/**
 * Updates notification mute preferences for a specific campus group.
 */
export const updateGroupMutePreferences = async (
  groupId: string,
  userId: string,
  prefs: Partial<GroupNotificationMutePreferences>
): Promise<void> => {
  if (!groupId || !userId) return;

  const prefRef = doc(db, 'users', userId, 'groupNotificationPreferences', groupId);
  await setDoc(
    prefRef,
    {
      ...prefs,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  logAnalyticsEvent('group_mute_updated', { groupId, muted: prefs.muted });
};

/**
 * Reads group notification mute preferences for a user.
 */
export const getGroupMutePreferences = async (
  groupId: string,
  userId: string
): Promise<GroupNotificationMutePreferences> => {
  if (!groupId || !userId) return DEFAULT_GROUP_MUTE_PREFERENCES;

  try {
    const prefRef = doc(db, 'users', userId, 'groupNotificationPreferences', groupId);
    const snap = await getDoc(prefRef);

    if (snap.exists()) {
      return { ...DEFAULT_GROUP_MUTE_PREFERENCES, ...snap.data() } as GroupNotificationMutePreferences;
    }

    return DEFAULT_GROUP_MUTE_PREFERENCES;
  } catch (err) {
    return DEFAULT_GROUP_MUTE_PREFERENCES;
  }
};
