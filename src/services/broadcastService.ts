import {
  collection,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import type { CampusBroadcastDoc, BroadcastSeverity } from '../types/broadcast';

/**
 * Admin Action: Initiates a campus-wide incident push broadcast with strict idempotency.
 */
export const initiateCampusBroadcast = async (
  incidentId: string,
  title: string,
  body: string,
  severity: BroadcastSeverity,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<string> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required to broadcast campus alert.');
  }

  if (!incidentId) throw new Error('Incident ID is required.');
  if (!title || title.trim().length > 100) {
    throw new Error('Title is required and must be 100 characters or fewer.');
  }
  if (!body || body.trim().length > 300) {
    throw new Error('Body is required and must be 300 characters or fewer.');
  }

  const broadcastRef = doc(db, 'campusBroadcasts', incidentId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(broadcastRef);
    if (snap.exists()) {
      const existing = snap.data() as CampusBroadcastDoc;
      if (existing.status === 'sent') {
        throw new Error('Broadcast has already been sent for this incident.');
      }
      if (existing.status === 'sending') {
        throw new Error('Broadcast is currently being sent. Duplicate request blocked.');
      }
    }

    const broadcastDoc: CampusBroadcastDoc = {
      incidentId,
      type: 'campus_incident',
      title: title.trim(),
      body: body.trim(),
      severity,
      status: 'pending',
      topic: 'campus_all',
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h default expiration
      attemptCount: 0,
      createdByName: (userProfile as any)?.name || userProfile?.displayName || 'Admin',
    };

    transaction.set(broadcastRef, broadcastDoc, { merge: true });
  });

  // Log Audit Event
  const auditRef = doc(collection(db, 'adminAuditLogs'));
  await setDoc(auditRef, {
    actorId: currentUser.uid,
    actorName: (userProfile as any)?.name || userProfile?.displayName || 'Admin',
    action: 'ALERT_ACTIVATED',
    resourceType: 'alert',
    targetId: incidentId,
    timestamp: serverTimestamp(),
    metadata: { title, severity, topic: 'campus_all' },
  });

  logAnalyticsEvent('campus_alert_broadcast_requested', {
    incidentId,
    severity,
  });

  return incidentId;
};

/**
 * Admin Action: Retries a failed broadcast (max 3 attempts).
 */
export const retryCampusBroadcast = async (
  incidentId: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required to retry broadcast.');
  }

  const broadcastRef = doc(db, 'campusBroadcasts', incidentId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(broadcastRef);
    if (!snap.exists()) throw new Error('Broadcast record not found.');

    const data = snap.data() as CampusBroadcastDoc;
    if (data.status !== 'failed') {
      throw new Error(`Cannot retry broadcast with status '${data.status}'.`);
    }

    if ((data.attemptCount || 0) >= 3) {
      throw new Error('Maximum retry attempt ceiling (3 attempts) reached for this broadcast.');
    }

    transaction.update(broadcastRef, {
      status: 'pending',
      attemptCount: (data.attemptCount || 0) + 1,
      lastAttemptAt: serverTimestamp(),
    });
  });

  logAnalyticsEvent('campus_alert_broadcast_retry', { incidentId });
};

/**
 * Real-time bounded subscription for active campus broadcasts.
 */
export const subscribeToActiveCampusBroadcasts = (
  onBroadcastsChange: (broadcasts: CampusBroadcastDoc[]) => void
): Unsubscribe => {
  const colRef = collection(db, 'campusBroadcasts');
  const q = query(
    colRef,
    where('status', '==', 'sent'),
    orderBy('createdAt', 'desc'),
    limit(5)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const nowMs = Date.now();
      const raw = snapshot.docs.map((d) => ({
        ...(d.data() as CampusBroadcastDoc),
        id: d.id,
      }));

      // Expiration check
      const activeOnly = raw.filter((b) => {
        if (b.expiresAt) {
          const expMs = b.expiresAt.toMillis ? b.expiresAt.toMillis() : b.expiresAt;
          if (expMs > 0 && expMs < nowMs) return false;
        }
        return true;
      });

      onBroadcastsChange(activeOnly);
    },
    (err) => {
      console.error('Error subscribing to active campus broadcasts:', err);
      onBroadcastsChange([]);
    }
  );
};
