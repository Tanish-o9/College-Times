import {
  collection,
  doc,
  getDocs,
  query,
  limit,
  where,
  orderBy,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  type QueryDocumentSnapshot,
  startAfter,
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

  // Check for duplicate if deterministicId is provided — idempotent writes
  const notifId = deterministicId || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const subNotifRef = doc(db, 'users', recipientId, 'notifications', notifId);

  // Quiet Hours & Tri-state Category check
  let isSuppressed = false;
  try {
    const prefs = await getUserNotificationPreferences(recipientId);
    
    // Tri-state preference category resolution
    let prefVal: 'all' | 'important' | 'off' = 'all';
    if (type === 'friend_request') {
      prefVal = prefs.friendRequestsPreference || 'all';
    } else if (type === 'friend_accept') {
      prefVal = prefs.friendAcceptancePreference || 'all';
    } else if (type === 'post_like' || type === 'comment_like') {
      prefVal = prefs.likesReactionsPreference || 'all';
    } else if (type === 'post_comment') {
      prefVal = prefs.commentsPreference || 'all';
    } else if (type === 'comment_reply') {
      prefVal = prefs.repliesPreference || 'all';
    } else if (type === 'mention' || type === 'chat_mention') {
      prefVal = prefs.mentionsPreference || 'all';
    } else if (category === 'messages' || type === 'direct_message') {
      prefVal = prefs.messagesPreference || 'all';
    } else if (category === 'groups' || type === 'group_activity') {
      prefVal = prefs.groupActivityPreference || 'all';
    } else if (category === 'events' || type === 'event_rsvp' || type === 'event_invite') {
      prefVal = prefs.eventsPreference || 'all';
    } else if (category === 'marketplace') {
      prefVal = prefs.marketplacePreference || 'all';
    } else if (category === 'opportunities') {
      prefVal = prefs.opportunitiesPreference || 'all';
    }

    if (prefVal === 'off') {
      return; // Skip notification creation entirely
    }
    if (prefVal === 'important' && priority !== 'critical' && priority !== 'high') {
      return; // Skip non-important notification creation
    }

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
  } catch (_prefsErr) {
    // Non-fatal — proceed without preference check
  }

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

  // Write to both subcollection (primary, real-time) and root collection (backward compat)
  const batch = writeBatch(db);
  batch.set(subNotifRef, payloadData, { merge: true });
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

  // Retention cleanup task (bounded size max 100)
  try {
    const notifColRef = collection(db, 'users', recipientId, 'notifications');
    const qSnap = await getDocs(query(notifColRef, orderBy('createdAt', 'desc'), limit(150)));
    if (qSnap.size > 100) {
      const pruneBatch = writeBatch(db);
      qSnap.docs.slice(100).forEach((d) => {
        pruneBatch.delete(d.ref);
        pruneBatch.delete(doc(db, 'notifications', d.id));
      });
      await pruneBatch.commit();
    }
  } catch (err) {
    console.warn('Pruning notifications failed:', err);
  }

  logAnalyticsEvent('notification_received', { category, priority, suppressed: isSuppressed });
};

/**
 * Maps a Firestore document to a NotificationItem.
 */
const toNotificationItem = (d: QueryDocumentSnapshot): NotificationItem => {
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
};

/**
 * Fetches paginated notifications from the user's subcollection (canonical path).
 * Ordered by createdAt DESC.
 */
export const getUserNotificationsPage = async (
  uid: string,
  categoryFilter?: NotificationCategory,
  limitCount: number = 20,
  lastVisibleDoc?: QueryDocumentSnapshot | null
): Promise<{ notifications: NotificationItem[]; lastDoc: QueryDocumentSnapshot | null }> => {
  if (!uid) return { notifications: [], lastDoc: null };
  const boundedLimit = Math.min(50, Math.max(1, limitCount));

  // Canonical path: users/{uid}/notifications
  const notifColRef = collection(db, 'users', uid, 'notifications');
  const q = lastVisibleDoc
    ? query(notifColRef, orderBy('createdAt', 'desc'), startAfter(lastVisibleDoc), limit(boundedLimit))
    : query(notifColRef, orderBy('createdAt', 'desc'), limit(boundedLimit));

  const snap = await getDocs(q);
  const rawList: NotificationItem[] = snap.docs.map(toNotificationItem);
  const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  const filtered = rawList.filter((n) => {
    if (categoryFilter && categoryFilter !== 'all' && n.category !== categoryFilter) return false;
    if (n.expiresAt) {
      const expDate = n.expiresAt.toDate ? n.expiresAt.toDate() : new Date(n.expiresAt);
      if (expDate < new Date()) return false;
    }
    return true;
  });

  return { notifications: filtered, lastDoc: newLastDoc };
};

/**
 * Real-time subscription to the user's notification subcollection.
 * Returns unsubscribe function.
 */
export const subscribeToNotifications = (
  uid: string,
  callback: (notifications: NotificationItem[]) => void
): Unsubscribe => {
  if (!uid) {
    callback([]);
    return () => {};
  }

  const notifColRef = collection(db, 'users', uid, 'notifications');
  const q = query(notifColRef, orderBy('createdAt', 'desc'), limit(30));

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map(toNotificationItem)
        .filter((n) => {
          if (n.expiresAt) {
            const expDate = n.expiresAt.toDate ? n.expiresAt.toDate() : new Date(n.expiresAt);
            if (expDate < new Date()) return false;
          }
          return true;
        });
      callback(items);
    },
    (err) => {
      console.error('Notification listener error:', err);
    }
  );

  return unsubscribe;
};

/**
 * Real-time subscription returning just the unread count badge number.
 */
export const subscribeToUnreadNotificationCount = (
  uid: string,
  callback: (count: number) => void
): Unsubscribe => {
  if (!uid) {
    callback(0);
    return () => {};
  }

  const notifColRef = collection(db, 'users', uid, 'notifications');
  const q = query(notifColRef, where('isRead', '==', false), limit(50));

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      callback(snap.size);
    },
    () => {
      callback(0);
    }
  );

  return unsubscribe;
};

export const markNotificationRead = async (uid: string, notifId: string): Promise<void> => {
  if (!uid || !notifId) return;

  const batch = writeBatch(db);
  // Canonical user subcollection
  const subRef = doc(db, 'users', uid, 'notifications', notifId);
  batch.set(subRef, { read: true, isRead: true, readAt: serverTimestamp() }, { merge: true });
  // Root collection backward compat
  const rootRef = doc(db, 'notifications', notifId);
  batch.set(rootRef, { read: true, isRead: true, readAt: serverTimestamp() }, { merge: true });
  await batch.commit();

  logAnalyticsEvent('notification_marked_read', { notifId });
};

export const markAllNotificationsRead = async (uid: string): Promise<void> => {
  if (!uid) return;

  // Read from canonical subcollection
  const notifColRef = collection(db, 'users', uid, 'notifications');
  const q = query(notifColRef, where('isRead', '==', false), limit(50));
  const snap = await getDocs(q);

  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { read: true, isRead: true, readAt: serverTimestamp() });
    // Also update root collection for backward compat
    const rootRef = doc(db, 'notifications', d.id);
    batch.set(rootRef, { read: true, isRead: true, readAt: serverTimestamp() }, { merge: true });
  });

  await batch.commit();
};

export const deleteNotification = async (uid: string, notifId: string): Promise<void> => {
  if (!uid || !notifId) return;

  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', uid, 'notifications', notifId));
  batch.delete(doc(db, 'notifications', notifId));
  await batch.commit();

  logAnalyticsEvent('notification_deleted', { notifId });
};

// Backward-compatible aliases
export const markNotificationAsRead = async (notifId: string, uid: string): Promise<void> => {
  return markNotificationRead(uid, notifId);
};

export const markAllNotificationsAsRead = markAllNotificationsRead;
export const markAllAsRead = markAllNotificationsRead;

export const getNotificationsPaginated = async (uid: string, optionsOrCat?: any) => {
  const cat = typeof optionsOrCat === 'string' ? (optionsOrCat as NotificationCategory) : undefined;
  const limitCount = optionsOrCat?.limitCount || 20;
  const lastDoc = optionsOrCat?.lastDoc || null;
  const result = await getUserNotificationsPage(uid, cat, limitCount, lastDoc);
  return result;
};
