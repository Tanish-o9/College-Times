import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { NotificationItem, NotificationType } from '../types/notification';

export interface CreateNotificationParams {
  recipientId: string;
  senderId?: string;
  type?: NotificationType;
  title?: string;
  message: string;
  postId?: string;
  relatedPostId?: string;
  channelId?: string;
  messageId?: string;
  eventId?: string;
  incidentId?: string;
  actorId?: string;
  actorName?: string;
  severity?: 'low' | 'moderate' | 'high' | 'critical';
  deepLink?: string;
}

/**
 * Creates a targeted personal notification for a recipient user.
 * Skips self-notifications (senderId === recipientId).
 */
export const createNotification = async (params: CreateNotificationParams): Promise<void> => {
  try {
    if (!params.recipientId || (params.senderId && params.senderId === params.recipientId)) {
      return;
    }

    const targetPostId = params.postId || params.relatedPostId;

    const notificationsRef = collection(db, 'notifications');
    await addDoc(notificationsRef, {
      recipientId: params.recipientId,
      type: params.type || 'system',
      ...(params.title ? { title: params.title } : {}),
      message: params.message,
      read: false,
      timestamp: serverTimestamp(),
      ...(targetPostId ? { postId: targetPostId, relatedPostId: targetPostId } : {}),
      ...(params.channelId ? { channelId: params.channelId } : {}),
      ...(params.messageId ? { messageId: params.messageId } : {}),
      ...(params.eventId ? { eventId: params.eventId } : {}),
      ...(params.incidentId ? { incidentId: params.incidentId } : {}),
      ...(params.actorId ? { actorId: params.actorId } : {}),
      ...(params.actorName ? { actorName: params.actorName } : {}),
      ...(params.severity ? { severity: params.severity } : {}),
      ...(params.deepLink ? { deepLink: params.deepLink } : {}),
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

/**
 * Fetches cursor-paginated personal notifications with bounded limits (default: 20, max: 50).
 */
export const getNotificationsPaginated = async (
  userId: string,
  options: {
    limitCount?: number;
    startAfterDoc?: DocumentSnapshot | null;
  } = {}
): Promise<{
  notifications: NotificationItem[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}> => {
  if (!userId) return { notifications: [], lastDoc: null, hasMore: false };

  const fetchLimit = Math.min(options.limitCount || 20, 50);
  const notificationsRef = collection(db, 'notifications');

  let q = query(
    notificationsRef,
    where('recipientId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(fetchLimit + 1)
  );

  if (options.startAfterDoc) {
    q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      orderBy('timestamp', 'desc'),
      startAfter(options.startAfterDoc),
      limit(fetchLimit + 1)
    );
  }

  const snap = await getDocs(q);
  const docs = snap.docs;
  const hasMore = docs.length > fetchLimit;
  const pageDocs = hasMore ? docs.slice(0, fetchLimit) : docs;

  const notifications: NotificationItem[] = pageDocs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
    createdAt: d.data().timestamp,
  }));

  const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;

  return { notifications, lastDoc, hasMore };
};

/**
 * Real-time bounded unread count listener (max limit: 10).
 */
export const subscribeToUnreadCount = (
  userId: string,
  callback: (unreadCount: number) => void
): Unsubscribe => {
  if (!userId) {
    callback(0);
    return () => {};
  }

  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    where('recipientId', '==', userId),
    where('read', '==', false),
    limit(10)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.length);
    },
    (err) => {
      console.error('Error in unread count subscription:', err);
      callback(0);
    }
  );
};

/**
 * Marks a single notification document as read.
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  if (!notificationId) return;
  try {
    const notifRef = doc(db, 'notifications', notificationId);
    await updateDoc(notifRef, { read: true });
    logAnalyticsEvent('notification_marked_read', { notificationId });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

/**
 * Batched update setting read: true for specified notification IDs.
 */
export const markVisibleNotificationsAsRead = async (
  userId: string,
  notificationIds: string[]
): Promise<void> => {
  if (!userId || !notificationIds || notificationIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    notificationIds.forEach((id) => {
      const notifRef = doc(db, 'notifications', id);
      batch.update(notifRef, { read: true });
    });
    await batch.commit();
  } catch (error) {
    console.error('Error marking visible notifications as read:', error);
  }
};

/**
 * Batched update setting read: true for all unread notifications.
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  if (!userId) return;
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      where('read', '==', false),
      limit(100)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { read: true });
    });

    await batch.commit();
    logAnalyticsEvent('notifications_marked_all_read', {});
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
};

/**
 * Backwards compatibility aliases for NotificationTray and Navbar.
 */
export const markAllAsRead = markAllNotificationsAsRead;

export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: NotificationItem[]) => void
): Unsubscribe => {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    where('recipientId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(30)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: NotificationItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as any),
        createdAt: docSnap.data().timestamp,
      }));
      callback(items);
    },
    (error) => {
      console.error('Error in notification subscription:', error);
      callback([]);
    }
  );
};
