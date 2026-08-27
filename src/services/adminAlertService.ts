import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  serverTimestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../lib/firebase';
import type { User } from '../types/models';
import type {
  NotificationDeliveryDoc,
  AlertDailySummary,
  AdminAuditLogDoc,
} from '../types/alert';

export interface PaginatedAlertHistoryResult {
  alerts: NotificationDeliveryDoc[];
  lastDoc: QueryDocumentSnapshot | null;
}

/**
 * Fetches paginated alert delivery records from notificationsDelivery collection.
 */
export const getAlertHistoryPage = async (
  pageSize: number = 20,
  lastVisibleDoc?: QueryDocumentSnapshot | null
): Promise<PaginatedAlertHistoryResult> => {
  const boundedSize = Math.min(Math.max(1, pageSize), 50);
  try {
    const colRef = collection(db, 'notificationsDelivery');
    let q = query(colRef, orderBy('createdAt', 'desc'), limit(boundedSize));

    if (lastVisibleDoc) {
      q = query(colRef, orderBy('createdAt', 'desc'), startAfter(lastVisibleDoc), limit(boundedSize));
    }

    const snap = await getDocs(q);
    const alerts = snap.docs.map((d) => ({
      ...(d.data() as NotificationDeliveryDoc),
      postId: d.id,
    }));

    const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    return { alerts, lastDoc: newLastDoc };
  } catch (err) {
    console.error('Error fetching alert history:', err);
    return { alerts: [], lastDoc: null };
  }
};

/**
 * Fetches a single alert delivery document by postId.
 */
export const getAlertDetail = async (postId: string): Promise<NotificationDeliveryDoc | null> => {
  if (!postId) return null;
  try {
    const docRef = doc(db, 'notificationsDelivery', postId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    return {
      ...(snap.data() as NotificationDeliveryDoc),
      postId: snap.id,
    };
  } catch (err) {
    console.error(`Error fetching alert detail for ${postId}:`, err);
    return null;
  }
};

/**
 * Admin Action: Retries a failed campus alert delivery safely.
 * Only allowed if status is 'failed' or 'pending' and attemptCount < 3.
 */
export const retryAlertDelivery = async (
  postId: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin privilege required to retry alert delivery.');
  }

  const deliveryRef = doc(db, 'notificationsDelivery', postId);
  const auditRef = doc(collection(db, 'adminAuditLogs'));

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(deliveryRef);
    if (!snap.exists()) {
      throw new Error(`Alert record ${postId} does not exist.`);
    }

    const data = snap.data() as NotificationDeliveryDoc;

    if (data.status === 'sent') {
      throw new Error('Alert delivery has already completed successfully. Resend blocked.');
    }

    if (data.attemptCount >= 3) {
      throw new Error('Maximum delivery retry limit (3 attempts) reached.');
    }

    transaction.update(deliveryRef, {
      status: 'pending',
      attemptCount: (data.attemptCount || 0) + 1,
      lastAttemptAt: serverTimestamp(),
      errorCode: null,
    });

    const auditDoc: AdminAuditLogDoc = {
      actorId: currentUser.uid,
      actorName: userProfile?.displayName || currentUser.displayName || 'Admin',
      action: 'retry_alert',
      targetId: postId,
      timestamp: serverTimestamp(),
      metadata: { previousAttemptCount: data.attemptCount, previousStatus: data.status },
    };

    transaction.set(auditRef, auditDoc);
  });
};

/**
 * Admin Action: Cancels a pending campus alert delivery before execution starts.
 */
export const cancelAlertDelivery = async (
  postId: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin privilege required to cancel alert delivery.');
  }

  const deliveryRef = doc(db, 'notificationsDelivery', postId);
  const auditRef = doc(collection(db, 'adminAuditLogs'));

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(deliveryRef);
    if (!snap.exists()) {
      throw new Error(`Alert record ${postId} does not exist.`);
    }

    const data = snap.data() as NotificationDeliveryDoc;

    if (data.status === 'sent') {
      throw new Error('Alert has already been sent to subscribers. Cancellation blocked.');
    }

    if (data.status === 'cancelled') {
      return; // Already cancelled
    }

    transaction.update(deliveryRef, {
      status: 'cancelled',
      failedAt: serverTimestamp(),
    });

    const auditDoc: AdminAuditLogDoc = {
      actorId: currentUser.uid,
      actorName: userProfile?.displayName || currentUser.displayName || 'Admin',
      action: 'cancel_alert',
      targetId: postId,
      timestamp: serverTimestamp(),
    };

    transaction.set(auditRef, auditDoc);
  });
};

/**
 * Fetches aggregate daily alert metrics for admin health overview.
 */
export const getAlertDailyMetrics = async (dateStr?: string): Promise<AlertDailySummary> => {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  try {
    const docRef = doc(db, 'analytics', 'alertDaily', targetDate);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...(snap.data() as AlertDailySummary), date: targetDate };
    }
  } catch (err) {
    console.error('Error fetching alert daily metrics:', err);
  }

  return {
    date: targetDate,
    alertsCreated: 0,
    alertsSent: 0,
    alertsFailed: 0,
    urgentAlerts: 0,
    updatedAt: new Date(),
  };
};
