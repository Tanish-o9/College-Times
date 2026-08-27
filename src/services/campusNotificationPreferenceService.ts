import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { CampusNotificationPreferences } from '../types/models';
import { DEFAULT_CAMPUS_NOTIFICATION_PREFERENCES } from '../types/models';

/**
 * Fetches user-scoped campus notification preferences from users/{uid}/notificationPreferences/campus.
 * Returns safe defaults if document does not exist or retrieval fails.
 */
export const getCampusNotificationPreferences = async (
  uid: string
): Promise<CampusNotificationPreferences> => {
  if (!uid) {
    return DEFAULT_CAMPUS_NOTIFICATION_PREFERENCES;
  }

  try {
    const docRef = doc(db, 'users', uid, 'notificationPreferences', 'campus');
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return DEFAULT_CAMPUS_NOTIFICATION_PREFERENCES;
    }

    const data = snap.data() as CampusNotificationPreferences;
    return {
      enabled: data.enabled ?? true,
      importantEnabled: data.importantEnabled ?? true,
      emergencyEnabled: data.emergencyEnabled ?? true,
      mentionsEnabled: data.mentionsEnabled ?? true,
      repliesEnabled: data.repliesEnabled ?? true,
      reactionsEnabled: data.reactionsEnabled ?? false,
    };
  } catch (err) {
    return DEFAULT_CAMPUS_NOTIFICATION_PREFERENCES;
  }
};

/**
 * Saves user campus notification preferences.
 */
export const setCampusNotificationPreferences = async (
  uid: string,
  preferences: Partial<CampusNotificationPreferences>
): Promise<void> => {
  if (!uid) return;

  try {
    const docRef = doc(db, 'users', uid, 'notificationPreferences', 'campus');
    const current = await getCampusNotificationPreferences(uid);

    const updated: CampusNotificationPreferences = {
      ...current,
      ...preferences,
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, updated, { merge: true });

    logAnalyticsEvent('campus_notification_preferences_updated', {
      setting: Object.keys(preferences).join(','),
    });
  } catch (err: any) {
    console.error('Error saving campus notification preferences:', err);
    throw new Error(err.message || 'Failed to update campus notification preferences.');
  }
};

/**
 * Helper to update a single toggle setting.
 */
export const updateCampusNotificationPreference = async (
  uid: string,
  key: keyof CampusNotificationPreferences,
  value: boolean
): Promise<void> => {
  await setCampusNotificationPreferences(uid, { [key]: value });
};
