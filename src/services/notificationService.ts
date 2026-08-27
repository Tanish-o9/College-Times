import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type NotificationCategory =
  | 'social'
  | 'mentions'
  | 'groups'
  | 'events'
  | 'messages'
  | 'system';

export interface NotificationItem {
  id: string;
  recipientId: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  type: string;
  category: NotificationCategory;
  message: string;
  deepLink?: string;
  read: boolean;
  groupKey?: string;
  groupCount?: number;
  createdAt: Timestamp | any;
}

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
  message: string;
  title?: string;
  postId?: string;
  relatedPostId?: string;
  deepLink?: string;
  deterministicId?: string;
  groupKey?: string;
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
    message,
    deepLink,
    deterministicId,
    groupKey,
  } = params;

  if (!recipientId) return;
  const actualSender = senderId || actorId;
  const actualSenderName = senderName || actorName;
  const actualSenderAvatar = senderAvatar || actorAvatar;

  if (actualSender && actualSender === recipientId) return; // Prevent self-notifications

  const notifId = deterministicId || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const notifRef = doc(db, 'users', recipientId, 'notifications', notifId);

  await setDoc(
    notifRef,
    {
      id: notifId,
      recipientId,
      senderId: actualSender || 'system',
      senderName: actualSenderName || 'Campus Update',
      senderAvatar: actualSenderAvatar || '',
      type,
      category,
      message,
      deepLink: deepLink || '/',
      read: false,
      groupKey: groupKey || '',
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const getUserNotificationsPage = async (
  uid: string,
  categoryFilter?: NotificationCategory,
  limitCount: number = 20
): Promise<NotificationItem[]> => {
  if (!uid) return [];
  const boundedLimit = Math.min(50, Math.max(1, limitCount));

  const notifColRef = collection(db, 'users', uid, 'notifications');
  const snap = await getDocs(query(notifColRef, limit(boundedLimit)));

  const rawList: NotificationItem[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      recipientId: data.recipientId,
      senderId: data.senderId,
      senderName: data.senderName,
      senderAvatar: data.senderAvatar,
      type: data.type || 'general',
      category: data.category || 'social',
      message: data.message || '',
      deepLink: data.deepLink,
      read: !!data.read,
      groupKey: data.groupKey,
      createdAt: data.createdAt,
    };
  });

  const filtered = categoryFilter
    ? rawList.filter((n) => n.category === categoryFilter)
    : rawList;

  return filtered;
};

export const markNotificationRead = async (uid: string, notifId: string): Promise<void> => {
  if (!uid || !notifId) return;
  const ref = doc(db, 'users', uid, 'notifications', notifId);
  await setDoc(ref, { read: true }, { merge: true });
};

export const markAllNotificationsRead = async (uid: string): Promise<void> => {
  if (!uid) return;
  const notifColRef = collection(db, 'users', uid, 'notifications');
  const snap = await getDocs(query(notifColRef, limit(50)));

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    if (!d.data().read) {
      batch.update(d.ref, { read: true });
    }
  });

  await batch.commit();
};

export const subscribeToNotifications = (_uid: string, callback: (countOrItems: any) => void) => {
  callback(0);
  return () => {};
};

export const markNotificationAsRead = markNotificationRead;
export const markAllNotificationsAsRead = markAllNotificationsRead;
export const markAllAsRead = markAllNotificationsRead;
export const getNotificationsPaginated = async (uid: string, optionsOrCat?: any) => {
  const cat = typeof optionsOrCat === 'string' ? (optionsOrCat as NotificationCategory) : undefined;
  const list = await getUserNotificationsPage(uid, cat, 20);
  return { notifications: list, lastDoc: null };
};
