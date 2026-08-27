import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
  runTransaction,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type {
  AlertMetricsDoc,
  TimeRangeFilter,
  NotificationDeliveryDoc,
  ActiveAlertDoc,
} from '../types/alert';

export interface AlertAnalyticsSummary {
  alertsCreated: number;
  alertsSent: number;
  alertsFailed: number;
  urgentAlerts: number;
  importantAlerts: number;
  expiredAlerts: number;
  deactivatedAlerts: number;
  averageOpenRate: number; // percentage e.g. 42.7
  categoryBreakdown: Record<string, number>;
}

/**
 * Bounded unique-open tracking for alerts.
 * Increments uniqueOpenedCount ONLY on user's first open interaction.
 */
export const recordAlertOpened = async (postId: string, uid: string): Promise<void> => {
  if (!postId || !uid) return;

  try {
    const interactionRef = doc(db, 'users', uid, 'alertInteractions', postId);
    const metricsRef = doc(db, 'alertMetrics', postId);

    await runTransaction(db, async (transaction) => {
      const interSnap = await transaction.get(interactionRef);
      const isFirstOpen = !interSnap.exists() || !interSnap.data()?.openedAt;

      // Record interaction doc
      transaction.set(
        interactionRef,
        {
          alertId: postId,
          openedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Update aggregate metrics
      transaction.set(
        metricsRef,
        {
          alertId: postId,
          openedCount: increment(1),
          ...(isFirstOpen ? { uniqueOpenedCount: increment(1) } : {}),
          lastUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    logAnalyticsEvent('campus_alert_opened', {
      source: 'in_app',
    });
  } catch (err) {
    console.error(`Error recording alert open for ${postId}:`, err);
  }
};

/**
 * Records alert dismissal interaction and increments dismissedCount atomically.
 */
export const recordAlertDismissed = async (postId: string, uid: string): Promise<void> => {
  if (!postId || !uid) return;

  try {
    const interactionRef = doc(db, 'users', uid, 'alertInteractions', postId);
    const metricsRef = doc(db, 'alertMetrics', postId);

    await runTransaction(db, async (transaction) => {
      transaction.set(
        interactionRef,
        {
          alertId: postId,
          dismissedAt: serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(
        metricsRef,
        {
          alertId: postId,
          dismissedCount: increment(1),
          lastUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    logAnalyticsEvent('campus_alert_dismissed', {
      source: 'in_app',
    });
  } catch (err) {
    console.error(`Error recording alert dismissal for ${postId}:`, err);
  }
};

/**
 * Fetches aggregate metrics document for a single alert.
 */
export const getAlertMetrics = async (postId: string): Promise<AlertMetricsDoc> => {
  if (!postId) {
    return {
      alertId: '',
      sentCount: 0,
      deliveredCount: 0,
      openedCount: 0,
      uniqueOpenedCount: 0,
      dismissedCount: 0,
      failedCount: 0,
      activeUsersReached: 0,
      lastUpdatedAt: new Date(),
    };
  }

  try {
    const metricsRef = doc(db, 'alertMetrics', postId);
    const snap = await getDoc(metricsRef);

    if (snap.exists()) {
      return {
        ...(snap.data() as AlertMetricsDoc),
        alertId: snap.id,
      };
    }
  } catch (err) {
    console.error(`Error fetching alert metrics for ${postId}:`, err);
  }

  return {
    alertId: postId,
    sentCount: 0,
    deliveredCount: 0,
    openedCount: 0,
    uniqueOpenedCount: 0,
    dismissedCount: 0,
    failedCount: 0,
    activeUsersReached: 0,
    lastUpdatedAt: new Date(),
  };
};

/**
 * Calculates aggregate analytics metrics across a selected time range.
 */
export const getAlertAnalyticsSummary = async (
  timeRange: TimeRangeFilter = '7d'
): Promise<AlertAnalyticsSummary> => {
  try {
    const deliveryRef = collection(db, 'notificationsDelivery');
    const activeRef = collection(db, 'activeAlerts');

    let startDateMs = 0;
    const nowMs = Date.now();

    if (timeRange === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDateMs = today.getTime();
    } else if (timeRange === '7d') {
      startDateMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    } else if (timeRange === '30d') {
      startDateMs = nowMs - 30 * 24 * 60 * 60 * 1000;
    } else if (timeRange === '90d') {
      startDateMs = nowMs - 90 * 24 * 60 * 60 * 1000;
    }

    const qDelivery = startDateMs > 0
      ? query(deliveryRef, where('createdAt', '>=', new Date(startDateMs)), limit(100))
      : query(deliveryRef, orderBy('createdAt', 'desc'), limit(100));

    const qActive = startDateMs > 0
      ? query(activeRef, where('createdAt', '>=', new Date(startDateMs)), limit(100))
      : query(activeRef, orderBy('createdAt', 'desc'), limit(100));

    const [deliverySnap, activeSnap] = await Promise.all([getDocs(qDelivery), getDocs(qActive)]);

    let alertsCreated = deliverySnap.docs.length;
    let alertsSent = 0;
    let alertsFailed = 0;
    let urgentAlerts = 0;
    let importantAlerts = 0;
    let expiredAlerts = 0;
    let deactivatedAlerts = 0;
    let totalDelivered = 0;
    let totalUniqueOpens = 0;
    const categoryBreakdown: Record<string, number> = {};

    deliverySnap.docs.forEach((docSnap) => {
      const data = docSnap.data() as NotificationDeliveryDoc;
      if (data.status === 'sent') alertsSent++;
      if (data.status === 'failed') alertsFailed++;
      if (data.priority === 'emergency') urgentAlerts++;
      if (data.priority === 'important') importantAlerts++;

      const delivered = data.successCount || (data.status === 'sent' ? 1 : 0);
      totalDelivered += delivered;
    });

    activeSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() as ActiveAlertDoc;
      if (!data.active) deactivatedAlerts++;

      const cat = data.incidentCategory || 'general';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    // Safe Open Rate calculation (uniqueOpenedCount / deliveredCount)
    const averageOpenRate =
      totalDelivered > 0 ? Math.min(100, Math.round((totalUniqueOpens / totalDelivered) * 1000) / 10) : 0;

    return {
      alertsCreated,
      alertsSent,
      alertsFailed,
      urgentAlerts,
      importantAlerts,
      expiredAlerts,
      deactivatedAlerts,
      averageOpenRate,
      categoryBreakdown,
    };
  } catch (err) {
    console.error('Error loading alert analytics summary:', err);
    return {
      alertsCreated: 0,
      alertsSent: 0,
      alertsFailed: 0,
      urgentAlerts: 0,
      importantAlerts: 0,
      expiredAlerts: 0,
      deactivatedAlerts: 0,
      averageOpenRate: 0,
      categoryBreakdown: {},
    };
  }
};
