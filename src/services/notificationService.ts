import {
  collection,
  doc,
  setDoc,
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
import type { NotificationItem, NotificationType, NotificationCategory, NotificationPriority } from '../types/notification';
import { isGroupNotificationMuted, getGroupNotificationPreferences } from './groupNotificationPreferenceService';

export interface CreateNotificationParams {
  recipientId: string;
  senderId?: string;
  type?: NotificationType;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  groupId?: string;
  groupName?: string;
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
  dedupId?: string;
}

/**
 * Creates a targeted personal notification for a recipient user.
 * Skips self-notifications (senderId === recipientId).
 * Verifies group notification preferences & mute status for group notifications.
 */
export const createNotification = async (params: CreateNotificationParams): Promise<void> => {
  try {
    if (!params.recipientId || (params.senderId && params.senderId === params.recipientId)) {
      return;
    }

    // Check group mute & preferences if notification belongs to a group
    if (params.groupId && params.priority !== 'critical') {
      const isMuted = await isGroupNotificationMuted(params.recipientId, params.groupId);
      if (isMuted) return;

      const groupPrefs = await getGroupNotificationPreferences(params.recipientId, params.groupId);
      if (!groupPrefs.allNotifications) return;

      // Filter by sub-category
      if (params.type === 'group_mention' && !groupPrefs.mentions) return;
      if (params.type === 'group_reply' && !groupPrefs.replies) return;
      if (params.type === 'group_chat_message' && !groupPrefs.chatMessages) return;
      if (params.type === 'moment_created' && !groupPrefs.newMoments) return;
      if (params.type === 'moment_comment' && !groupPrefs.momentComments) return;
      if (params.type === 'poll_created' && !groupPrefs.polls) return;
      if (params.type === 'poll_result' && !groupPrefs.pollResults) return;
      if (params.type === 'event_created' && !groupPrefs.events) return;
      if (params.type === 'group_announcement' && !groupPrefs.announcements) return;
    }

    const targetPostId = params.postId || params.relatedPostId;

    const notifData = {
      recipientId: params.recipientId,
      type: params.type || 'system',
      ...(params.category ? { category: params.category } : {}),
      priority: params.priority || (params.severity === 'critical' ? 'critical' : 'normal'),
      ...(params.groupId ? { groupId: params.groupId } : {}),
      ...(params.groupName ? { groupName: params.groupName } : {}),
      ...(params.title ? { title: params.title } : {}),
      message: params.message,
      read: false,
      createdAt: serverTimestamp(),
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
    };

    // Deduplication check if dedupId provided
    if (params.dedupId) {
      const dedupRef = doc(db, 'notifications', params.dedupId);
      await setDoc(dedupRef, notifData, { merge: true });
    } else {
      const notificationsRef = collection(db, 'notifications');
      await addDoc(notificationsRef, notifData);
    }

    logAnalyticsEvent('group_notification_created', {
      recipientId: params.recipientId,
      type: params.type || 'system',
      groupId: params.groupId || 'none',
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
    lastDoc?: DocumentSnapshot | null;
  } = {}
): Promise<{
  notifications: NotificationItem[];
  lastDoc: DocumentSnapshot | null;
}> => {
  if (!userId) return { notifications: [], lastDoc: null };

  const boundedLimit = Math.min(Math.max(options.limitCount || 20, 1), 50);
  const notifRef = collection(db, 'notifications');

  let q = query(
    notifRef,
    where('recipientId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(boundedLimit)
  );

  if (options.lastDoc) {
    q = query(
      notifRef,
      where('recipientId', '==', userId),
      orderBy('timestamp', 'desc'),
      startAfter(options.lastDoc),
      limit(boundedLimit)
    );
  }

  const snap = await getDocs(q);
  const notifications: NotificationItem[] = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<NotificationItem, 'id'>),
  }));

  const nextLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return { notifications, lastDoc: nextLastDoc };
};

/**
 * Listens to realtime unread notification count for a user.
 */
export const subscribeToUnreadNotificationCount = (
  userId: string,
  onCountUpdate: (count: number) => void
): Unsubscribe => {
  if (!userId) {
    onCountUpdate(0);
    return () => {};
  }

  const notifRef = collection(db, 'notifications');
  const q = query(
    notifRef,
    where('recipientId', '==', userId),
    where('read', '==', false),
    limit(50)
  );

  return onSnapshot(
    q,
    (snap) => {
      onCountUpdate(snap.size);
    },
    (err) => {
      console.error('Failed to listen to unread notification count:', err);
      onCountUpdate(0);
    }
  );
};

/**
 * Marks a notification as read.
 */
export const markNotificationAsRead = async (
  notificationId: string,
  userId: string
): Promise<void> => {
  if (!notificationId || !userId) return;

  const notifDocRef = doc(db, 'notifications', notificationId);
  await updateDoc(notifDocRef, { read: true });
  logAnalyticsEvent('group_notification_marked_read', { notificationId });
};

/**
 * Marks all notifications as read for a user (bounded batch max 50).
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  if (!userId) return;

  const notifRef = collection(db, 'notifications');
  const q = query(
    notifRef,
    where('recipientId', '==', userId),
    where('read', '==', false),
    limit(50)
  );

  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, { read: true });
  });

  await batch.commit();
  logAnalyticsEvent('group_notifications_marked_all_read', { userId });
};

export const subscribeToNotifications = subscribeToUnreadNotificationCount;
export const markAllAsRead = markAllNotificationsAsRead;
