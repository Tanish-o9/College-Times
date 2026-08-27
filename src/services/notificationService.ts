import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDocs,
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Notification } from '../types';

export interface CreateNotificationParams {
  recipientId: string;
  senderId?: string;
  message: string;
  relatedPostId: string;
}

/**
 * Creates a notification for a target recipient user.
 * Skips creating a notification if senderId === recipientId (user liking/commenting on their own post).
 */
export const createNotification = async ({
  recipientId,
  senderId,
  message,
  relatedPostId,
}: CreateNotificationParams): Promise<void> => {
  try {
    if (!recipientId || (senderId && senderId === recipientId)) {
      return; // Skip self-notifications
    }

    const notificationsRef = collection(db, 'notifications');
    await addDoc(notificationsRef, {
      recipientId,
      message,
      relatedPostId,
      read: false,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    // Silent fail for notifications to avoid blocking primary actions
  }
};

/**
 * Subscribes to real-time notification stream for a specific user.
 */
export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
) => {
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
      const items: Notification[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Notification[];
      callback(items);
    },
    (error) => {
      console.error('Error in notification subscription:', error);
    }
  );
};

/**
 * Marks a notification as read.
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notifRef = doc(db, 'notifications', notificationId);
    await updateDoc(notifRef, { read: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

/**
 * Batched update setting read: true for every currently-unread notification for a user.
 */
export const markAllAsRead = async (userId: string): Promise<void> => {
  if (!userId) return;
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { read: true });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
};

