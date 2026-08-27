import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import {
  type UserNotificationPreferences,
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
} from '../types/notification';

/**
 * Reads user notification preferences from users/{uid}/notificationPreferences/settings.
 */
export const getUserNotificationPreferences = async (
  userId: string
): Promise<UserNotificationPreferences> => {
  if (!userId) return DEFAULT_USER_NOTIFICATION_PREFERENCES;

  try {
    const prefRef = doc(db, 'users', userId, 'notificationPreferences', 'settings');
    const snap = await getDoc(prefRef);

    if (!snap.exists()) {
      return DEFAULT_USER_NOTIFICATION_PREFERENCES;
    }

    return {
      ...DEFAULT_USER_NOTIFICATION_PREFERENCES,
      ...(snap.data() as UserNotificationPreferences),
      campusAlerts: true, // Safety mandatory
    };
  } catch (err) {
    console.error('Error reading user notification preferences:', err);
    return DEFAULT_USER_NOTIFICATION_PREFERENCES;
  }
};

/**
 * Saves user notification preferences to users/{uid}/notificationPreferences/settings.
 */
export const updateUserNotificationPreferences = async (
  userId: string,
  newSettings: Partial<UserNotificationPreferences>
): Promise<void> => {
  if (!userId) throw new Error('Authentication required to save settings.');

  const prefRef = doc(db, 'users', userId, 'notificationPreferences', 'settings');

  const updatedPayload: UserNotificationPreferences = {
    ...DEFAULT_USER_NOTIFICATION_PREFERENCES,
    ...newSettings,
    campusAlerts: true, // Always enforce safety alert delivery
    updatedAt: serverTimestamp(),
  };

  await setDoc(prefRef, updatedPayload, { merge: true });

  logAnalyticsEvent('notification_preferences_updated', {
    pushEnabled: updatedPayload.pushEnabled,
    chatMentions: updatedPayload.chatMentions,
  });
};
