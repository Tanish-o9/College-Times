import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import { type UserFeedPreferences, DEFAULT_USER_FEED_PREFERENCES } from '../types/feed';

/**
 * Reads user feed category preferences from users/{uid}/feedPreferences/settings.
 */
export const getUserFeedPreferences = async (
  userId: string
): Promise<UserFeedPreferences> => {
  if (!userId) return DEFAULT_USER_FEED_PREFERENCES;

  try {
    const prefRef = doc(db, 'users', userId, 'feedPreferences', 'settings');
    const snap = await getDoc(prefRef);

    if (!snap.exists()) {
      return DEFAULT_USER_FEED_PREFERENCES;
    }

    return {
      ...DEFAULT_USER_FEED_PREFERENCES,
      ...(snap.data() as UserFeedPreferences),
    };
  } catch (err) {
    console.error('Error reading user feed preferences:', err);
    return DEFAULT_USER_FEED_PREFERENCES;
  }
};

/**
 * Saves user feed category preferences to users/{uid}/feedPreferences/settings.
 */
export const updateUserFeedPreferences = async (
  userId: string,
  newSettings: Partial<UserFeedPreferences>
): Promise<void> => {
  if (!userId) throw new Error('Authentication required to save feed preferences.');

  const prefRef = doc(db, 'users', userId, 'feedPreferences', 'settings');

  const updatedPayload: UserFeedPreferences = {
    ...DEFAULT_USER_FEED_PREFERENCES,
    ...newSettings,
    updatedAt: serverTimestamp(),
  };

  await setDoc(prefRef, updatedPayload, { merge: true });

  logAnalyticsEvent('feed_personalization_updated', {
    preferredCount: updatedPayload.preferredCategories.length,
    mutedCount: updatedPayload.mutedCategories.length,
  });
};
