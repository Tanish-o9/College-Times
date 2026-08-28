import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { QuietHoursConfig } from '../types/notification';

export interface UserNotificationPreferences {
  // Legacy fields
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
  chatMentions: boolean;
  chatActivity: boolean;
  postInteractions: boolean;
  eventUpdates: boolean;
  lostFoundUpdates: boolean;
  adminAnnouncements: boolean;
  campusAlerts: boolean;

  // Phase 50 taxonomy fields
  social: boolean;
  opportunities: boolean;
  marketplace: boolean;
  feed: boolean;
  system: boolean;

  // Unified preferences
  dmNotifications?: boolean;
  groupChatNotifications?: boolean;
  mentionNotifications?: boolean;
  momentNotifications?: boolean;
  commentReplyNotifications?: boolean;
  eventNotifications?: boolean;
  pollNotifications?: boolean;
  announcementNotifications?: boolean;
  emailNotifications?: boolean;
  pushNotifications?: boolean;

  // Communication controls
  quietHours?: QuietHoursConfig;
  digestMode?: 'immediate' | 'hourly' | 'daily';
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
  chatMentions: true,
  chatActivity: true,
  postInteractions: true,
  eventUpdates: true,
  lostFoundUpdates: true,
  adminAnnouncements: true,
  campusAlerts: true,

  social: true,
  opportunities: true,
  marketplace: true,
  feed: true,
  system: true,

  dmNotifications: true,
  groupChatNotifications: true,
  mentionNotifications: true,
  momentNotifications: true,
  commentReplyNotifications: true,
  eventNotifications: true,
  pollNotifications: true,
  announcementNotifications: true,
  emailNotifications: false,
  pushNotifications: true,

  quietHours: { enabled: false, start: '22:00', end: '07:00' },
  digestMode: 'immediate',
};

export const getUserNotificationPreferences = async (uid: string): Promise<UserNotificationPreferences> => {
  if (!uid) return defaultPreferences;
  try {
    // Try the new path first
    const ref = doc(db, 'users', uid, 'notificationPreferences', 'preferences');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { ...defaultPreferences, ...snap.data() };
    }

    // Try legacy path
    const legacyRef = doc(db, 'users', uid, 'settings', 'notificationPreferences');
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
      return { ...defaultPreferences, ...legacySnap.data() };
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
  // Write to both paths for full compatibility
  const ref = doc(db, 'users', uid, 'notificationPreferences', 'preferences');
  const legacyRef = doc(db, 'users', uid, 'settings', 'notificationPreferences');
  
  await Promise.all([
    setDoc(ref, prefs, { merge: true }),
    setDoc(legacyRef, prefs, { merge: true }),
  ]);
};
