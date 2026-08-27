import {
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import app, { db } from '../lib/firebase';

export interface PushTokenDoc {
  token: string;
  platform: 'web';
  createdAt: any;
  updatedAt: any;
  active: boolean;
}

// Configurable policy constant for urgent alerts
export const CAN_STUDENTS_SEND_URGENT_ALERTS = false;

/**
 * Checks if browser environment supports Notification API and Service Worker.
 */
export const isPushSupported = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
};

/**
 * Requests browser push notification permission.
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isPushSupported()) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
};

/**
 * Safely fetches the FCM Web Registration Token.
 */
export const getFcmToken = async (): Promise<string | null> => {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const { getMessaging, getToken } = await import('firebase/messaging');
    const messaging = getMessaging(app);
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

    const token = await getToken(messaging, {
      ...(vapidKey ? { vapidKey } : {}),
    });

    return token || null;
  } catch (err) {
    console.warn('FCM Messaging token retrieval unavailable in current browser environment:', err);
    return null;
  }
};

/**
 * Registers user's FCM push token in Firestore under users/{uid}/pushTokens/{tokenId}.
 */
export const registerPushTokenIfNeeded = async (currentUser: FirebaseUser): Promise<string | null> => {
  if (!currentUser || Notification.permission !== 'granted') return null;

  try {
    const token = await getFcmToken();
    if (!token) return null;

    // Sanitize doc ID from token hash or slice
    const tokenId = token.slice(-32).replace(/[^a-zA-Z0-9]/g, '_');
    const tokenRef = doc(db, 'users', currentUser.uid, 'pushTokens', tokenId);

    const docData: PushTokenDoc = {
      token,
      platform: 'web',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      active: true,
    };

    await setDoc(tokenRef, docData, { merge: true });
    return token;
  } catch (err) {
    console.error('Failed to register push token:', err);
    return null;
  }
};

/**
 * Deterministically constructs FCM topic names for target audiences.
 */
export const resolveAudienceTopicName = (
  type: 'campus' | 'department' | 'batch' | 'community' | 'channel',
  targetId?: string
): string => {
  if (type === 'campus') return 'campus_all';
  if (type === 'department') return `department_${(targetId || 'general').toLowerCase()}`;
  if (type === 'batch') return `batch_${(targetId || '2026').replace('batch-', '')}`;
  if (type === 'community') return `group_${targetId || 'community'}`;
  if (type === 'channel') return `channel_${targetId || 'general'}`;
  return 'campus_all';
};

/**
 * Marks an invalid or expired push token inactive in Firestore.
 */
export const markPushTokenInactive = async (uid: string, tokenId: string): Promise<void> => {
  if (!uid || !tokenId) return;
  try {
    const tokenRef = doc(db, 'users', uid, 'pushTokens', tokenId);
    await setDoc(tokenRef, { active: false, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error(`Error marking push token ${tokenId} inactive:`, err);
  }
};

// In-Memory Deduplication Set for Foreground Push Alerts (Max 100 entries)
const seenNotificationIds = new Set<string>();

/**
 * Checks and records notification ID to prevent duplicate foreground toast popups.
 */
export const isDuplicateNotification = (notifId: string): boolean => {
  if (!notifId) return false;
  if (seenNotificationIds.has(notifId)) return true;

  seenNotificationIds.add(notifId);
  if (seenNotificationIds.size > 100) {
    const firstItem = Array.from(seenNotificationIds)[0];
    if (firstItem) seenNotificationIds.delete(firstItem);
  }
  return false;
};
