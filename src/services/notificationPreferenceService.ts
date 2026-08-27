import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface UserNotificationPreferences {
  likes: boolean;
  comments: boolean;
  reactions: boolean;
  mentions: boolean;
  follows: boolean;
  messages: boolean;
  groups: boolean;
  events: boolean;
  polls: boolean;
  announcements: boolean;
}

const defaultPreferences: UserNotificationPreferences = {
  likes: true,
  comments: true,
  reactions: true,
  mentions: true,
  follows: true,
  messages: true,
  groups: true,
  events: true,
  polls: true,
  announcements: true,
};

export const getUserNotificationPreferences = async (uid: string): Promise<UserNotificationPreferences> => {
  if (!uid) return defaultPreferences;
  try {
    const ref = doc(db, 'users', uid, 'settings', 'notificationPreferences');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { ...defaultPreferences, ...snap.data() };
    }
  } catch (err) {
    console.error('Failed to load notification preferences:', err);
  }
  return defaultPreferences;
};

export const updateUserNotificationPreferences = async (
  uid: string,
  prefs: Partial<UserNotificationPreferences>
): Promise<void> => {
  if (!uid) return;
  const ref = doc(db, 'users', uid, 'settings', 'notificationPreferences');
  await setDoc(ref, prefs, { merge: true });
};
