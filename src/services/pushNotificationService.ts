import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getMessaging, getToken } from 'firebase/messaging';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, app, logAnalyticsEvent } from '../lib/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

/**
 * Checks browser support for Push Notifications and Service Workers.
 */
export const isPushNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
};

/**
 * Gets current Notification permission state.
 */
export const getNotificationPermissionState = (): NotificationPermission | 'unsupported' => {
  if (!isPushNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

/**
 * Requests browser push permission & subscribes user to campus notifications.
 */
export const requestPushNotificationPermission = async (currentUser: FirebaseUser): Promise<boolean> => {
  if (!isPushNotificationSupported()) {
    console.warn('Push notifications not supported on this browser.');
    return false;
  }

  if (!currentUser) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      logAnalyticsEvent('campus_alert_permission_denied', {});
      return false;
    }

    // Register FCM Service Worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: VAPID_KEY || undefined,
    });

    if (token) {
      // Register push token in Firestore
      const tokenRef = doc(db, 'users', currentUser.uid, 'pushTokens', token);
      await setDoc(tokenRef, {
        token,
        userId: currentUser.uid,
        topics: ['campus_all'],
        platform: 'web',
        updatedAt: serverTimestamp(),
      });

      logAnalyticsEvent('campus_alert_permission_granted', {});
      return true;
    }

    return false;
  } catch (err) {
    console.error('Failed to enable push notifications:', err);
    return false;
  }
};

/**
 * Removes push token upon user logout.
 */
export const unregisterPushToken = async (currentUser: FirebaseUser, token?: string): Promise<void> => {
  if (!currentUser || !token) return;
  try {
    const tokenRef = doc(db, 'users', currentUser.uid, 'pushTokens', token);
    await deleteDoc(tokenRef);
  } catch (err) {
    console.warn('Failed to unregister push token:', err);
  }
};
