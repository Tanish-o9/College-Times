import {
  collection,
  doc,
  getDocs,
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
import { db } from '../lib/firebase';
import type { User } from '../types/models';
import type { ActiveAlertDoc } from '../types/alert';

/**
 * Checks if current user is authorized recipient for a given active alert audience.
 */
export const isUserEligibleForAlertAudience = (
  alert: ActiveAlertDoc,
  userProfile?: User | null,
  joinedGroupIds: string[] = []
): boolean => {
  if (!alert) return false;
  if (alert.audienceType === 'campus') return true;

  if (alert.audienceType === 'department') {
    if (!userProfile?.departmentId || !alert.audienceId) return false;
    return userProfile.departmentId.toLowerCase() === alert.audienceId.toLowerCase();
  }

  if (alert.audienceType === 'batch') {
    if (!userProfile?.batchYear || !alert.audienceId) return false;
    const targetBatchStr = String(alert.audienceId).replace('batch-', '');
    return String(userProfile.batchYear) === targetBatchStr;
  }

  if (alert.audienceType === 'community' || alert.audienceType === 'channel') {
    if (!alert.audienceId) return false;
    return joinedGroupIds.includes(alert.audienceId);
  }

  return true;
};

/**
 * Real-time bounded snapshot listener for active breaking campus alerts.
 * Enforces audience filtering, expiration filtering, and user dismissal set filtering.
 */
export const subscribeToActiveAlerts = (
  currentUser: FirebaseUser | null,
  userProfile: User | null | undefined,
  joinedGroupIds: string[] = [],
  onAlertsChange: (alerts: ActiveAlertDoc[]) => void
): Unsubscribe => {
  if (!currentUser) {
    onAlertsChange([]);
    return () => {};
  }

  const colRef = collection(db, 'activeAlerts');
  const q = query(colRef, where('active', '==', true), orderBy('createdAt', 'desc'), limit(10));

  // Fetch dismissed alert IDs for user
  const dismissedSet = new Set<string>();
  const fetchDismissed = async () => {
    try {
      const disSnap = await getDocs(collection(db, 'users', currentUser.uid, 'dismissedAlerts'));
      disSnap.docs.forEach((d) => dismissedSet.add(d.id));
    } catch (err) {}
  };

  fetchDismissed();

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const nowMs = Date.now();
      const rawAlerts = snapshot.docs.map((d) => ({
        ...(d.data() as ActiveAlertDoc),
        postId: d.id,
      }));

      const filtered = rawAlerts.filter((alert) => {
        // Expiration check
        if (alert.expiresAt) {
          const expMs = alert.expiresAt.toMillis ? alert.expiresAt.toMillis() : alert.expiresAt;
          if (expMs > 0 && expMs < nowMs) return false;
        }

        // Dismissal check
        if (dismissedSet.has(alert.postId)) return false;

        // Audience eligibility check
        return isUserEligibleForAlertAudience(alert, userProfile, joinedGroupIds);
      });

      onAlertsChange(filtered);
    },
    (err) => {
      console.error('Active alerts listener error:', err);
      onAlertsChange([]);
    }
  );

  return unsub;
};

/**
 * User Action: Explicitly dismisses an alert banner for current session/user.
 */
export const dismissAlertForUser = async (uid: string, postId: string): Promise<void> => {
  if (!uid || !postId) return;
  try {
    const docRef = doc(db, 'users', uid, 'dismissedAlerts', postId);
    await setDoc(docRef, { postId, dismissedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error(`Error dismissing alert ${postId}:`, err);
  }
};

/**
 * User Action: Records persistent read timestamp when user opens an alert.
 */
export const recordAlertReadForUser = async (uid: string, postId: string): Promise<void> => {
  if (!uid || !postId) return;
  try {
    const docRef = doc(db, 'users', uid, 'alertReadState', postId);
    await setDoc(docRef, { postId, readAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error(`Error recording alert read for ${postId}:`, err);
  }
};

/**
 * Admin Action: Pins an active alert to top of feed (Max 3 pinned alerts).
 */
export const pinActiveAlert = async (
  postId: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required to pin alert.');
  }

  const alertRef = doc(db, 'activeAlerts', postId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(alertRef);
    if (!snap.exists()) {
      throw new Error('Active alert document not found.');
    }

    // Check count of pinned alerts
    const pinnedSnap = await getDocs(
      query(collection(db, 'activeAlerts'), where('pinned', '==', true), limit(5))
    );
    if (pinnedSnap.docs.length >= 3 && !snap.data()?.pinned) {
      throw new Error('Maximum limit of 3 pinned alerts reached.');
    }

    transaction.update(alertRef, { pinned: true, updatedAt: serverTimestamp() });
  });
};

/**
 * Admin Action: Unpins a pinned active alert.
 */
export const unpinActiveAlert = async (
  postId: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required to unpin alert.');
  }

  const alertRef = doc(db, 'activeAlerts', postId);
  await setDoc(alertRef, { pinned: false, updatedAt: serverTimestamp() }, { merge: true });
};

/**
 * Admin Action: Escalates priority of an active alert (e.g. important -> emergency).
 */
export const escalateAlertPriority = async (
  postId: string,
  newPriority: 'important' | 'emergency',
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required to escalate alert priority.');
  }

  const alertRef = doc(db, 'activeAlerts', postId);
  const postRef = doc(db, 'posts', postId);

  await runTransaction(db, async (transaction) => {
    transaction.update(alertRef, { priority: newPriority, updatedAt: serverTimestamp() });
    transaction.update(postRef, { priority: newPriority });
  });
};
