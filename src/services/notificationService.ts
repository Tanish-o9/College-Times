import {
  collection,
  doc,
  getDocs,
  query,
  limit,
  where,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { NotificationCategory, NotificationItem, NotificationPriority, ActionablePayload } from '../types/notification';
export type { NotificationCategory, NotificationItem, NotificationPriority, ActionablePayload };
import { getUserNotificationPreferences } from './notificationPreferenceService';

export interface CreateNotificationParams {
  recipientId: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  actorId?: string;
  actorName?: string;
  actorAvatar?: string;
  type?: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  message: string;
  title?: string;
  postId?: string;
  relatedPostId?: string;
  deepLink?: string;
  deterministicId?: string;
  groupKey?: string;
  actionable?: ActionablePayload;
  expiresAt?: any;
}

export const createNotification = async (params: CreateNotificationParams): Promise<void> => {
  const {
    recipientId,
    senderId,
    senderName,
    senderAvatar,
    actorId,
    actorName,
    actorAvatar,
    type = 'general',
    category = 'social',
    priority = 'normal',
    message,
    title,
    deepLink,
    deterministicId,
    groupKey,
    actionable,
    expiresAt,
  } = params;

  if (!recipientId) return;
  const actualSender = senderId || actorId;
  const actualSenderName = senderName || actorName;
  const actualSenderAvatar = senderAvatar || actorAvatar;

  if (actualSender && actualSender === recipientId) return; // Prevent self-notifications

  // Quiet Hours check
  const prefs = await getUserNotificationPreferences(recipientId);
  let isSuppressed = false;
  if (prefs.quietHours?.enabled && priority !== 'critical' && priority !== 'high') {
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = prefs.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = prefs.quietHours.end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes > endMinutes) {
      if (currentMin >= startMinutes || currentMin <= endMinutes) {
        isSuppressed = true;
      }
    } else {
      if (currentMin >= startMinutes && currentMin <= endMinutes) {
        isSuppressed = true;
      }
    }
  }

  // Digest mode check
  if (prefs.digestMode && prefs.digestMode !== 'immediate' && priority !== 'critical' && priority !== 'high') {
    isSuppressed = true;
  }

  const notifId = deterministicId || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const notifRef = doc(db, 'users', recipientId, 'notifications', notifId);
  const rootNotifRef = doc(db, 'notifications', notifId);

  const payloadData = {
    id: notifId,
    recipientId,
    senderId: actualSender || 'system',
    senderName: actualSenderName || 'Campus Update',
    senderAvatar: actualSenderAvatar || '',
    actorId: actualSender || 'system',
    actorName: actualSenderName || 'Campus Update',
    actorAvatar: actualSenderAvatar || '',
    type,
    category,
    priority,
    message,
    body: message, // unified model field
    title: title || '',
    deepLink: deepLink || '/',
    read: false,
    isRead: false, // unified model field
    groupKey: groupKey || '',
    actionable: actionable || null,
    expiresAt: expiresAt || null,
    suppressed: isSuppressed,
    createdAt: serverTimestamp(),
  };

  // Write to both subcollection and root collection
  const batch = writeBatch(db);
  batch.set(notifRef, payloadData, { merge: true });
  batch.set(rootNotifRef, payloadData, { merge: true });
  await batch.commit();

  if (!isSuppressed) {
    try {
      const { incrementScopeUnread } = await import('./activityStateService');
      await incrementScopeUnread(recipientId, 'notifications');
    } catch (err) {
      console.error('Failed to increment notifications unread state:', err);
    }
  }

  logAnalyticsEvent('notification_received', { category, priority, suppressed: isSuppressed });
};

export const getUserNotificationsPage = async (
  uid: string,
  categoryFilter?: NotificationCategory,
  limitCount: number = 20
): Promise<NotificationItem[]> => {
  if (!uid) return [];
  const boundedLimit = Math.min(50, Math.max(1, limitCount));

  // Fetch from unified root notifications collection
  const notifColRef = collection(db, 'notifications');
  const q = query(notifColRef, where('recipientId', '==', uid), limit(boundedLimit));
  const snap = await getDocs(q);

  const rawList: NotificationItem[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      recipientId: data.recipientId,
      senderId: data.actorId || data.senderId || 'system',
      senderName: data.actorName || data.senderName || 'Campus Update',
      senderAvatar: data.actorAvatar || data.senderAvatar || '',
      actorId: data.actorId,
      actorName: data.actorName,
      actorAvatar: data.actorAvatar,
      type: data.type || 'general',
      category: data.category || 'social',
      priority: data.priority || 'normal',
      message: data.body || data.message || '',
      title: data.title || '',
      deepLink: data.deepLink,
      read: !!data.isRead || !!data.read,
      groupKey: data.groupKey,
      actionable: data.actionable || undefined,
      expiresAt: data.expiresAt,
      createdAt: data.createdAt,
    };
  });

  const filtered = categoryFilter && categoryFilter !== 'all'
    ? rawList.filter((n) => n.category === categoryFilter)
    : rawList;

  return filtered;
};

export const markNotificationRead = async (uid: string, notifId: string): Promise<void> => {
  if (!uid || !notifId) return;
  const ref = doc(db, 'users', uid, 'notifications', notifId);
  const rootRef = doc(db, 'notifications', notifId);

  const batch = writeBatch(db);
  batch.set(ref, { read: true, isRead: true, readAt: serverTimestamp() }, { merge: true });
  batch.set(rootRef, { read: true, isRead: true, readAt: serverTimestamp() }, { merge: true });
  await batch.commit();

  logAnalyticsEvent('notification_marked_read', { notifId });
};

export const markAllNotificationsRead = async (uid: string): Promise<void> => {
  if (!uid) return;
  const notifColRef = collection(db, 'notifications');
  const q = query(notifColRef, where('recipientId', '==', uid), limit(50));
  const snap = await getDocs(q);

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const data = d.data();
    if (!data.read && !data.isRead) {
      const subRef = doc(db, 'users', uid, 'notifications', d.id);
      batch.update(d.ref, { read: true, isRead: true, readAt: serverTimestamp() });
      batch.update(subRef, { read: true, isRead: true, readAt: serverTimestamp() });
    }
  });

  await batch.commit();
};

export const deleteNotification = async (uid: string, notifId: string): Promise<void> => {
  if (!uid || !notifId) return;
  const ref = doc(db, 'users', uid, 'notifications', notifId);
  const rootRef = doc(db, 'notifications', notifId);

  const batch = writeBatch(db);
  batch.delete(ref);
  batch.delete(rootRef);
  await batch.commit();

  logAnalyticsEvent('notification_deleted', { notifId });
};

export const subscribeToNotifications = (_uid: string, callback: (countOrItems: any) => void) => {
  callback(0);
  return () => {};
};

export const markNotificationAsRead = async (notifId: string, uid: string): Promise<void> => {
  return markNotificationRead(uid, notifId);
};

export const markAllNotificationsAsRead = markAllNotificationsRead;
export const markAllAsRead = markAllNotificationsRead;

export const getNotificationsPaginated = async (uid: string, optionsOrCat?: any) => {
  const cat = typeof optionsOrCat === 'string' ? (optionsOrCat as NotificationCategory) : undefined;
  const list = await getUserNotificationsPage(uid, cat, 20);
  return { notifications: list, lastDoc: null };
};
