import { doc, getDoc, runTransaction, serverTimestamp, increment } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { OpportunityApplication, ApplicationStatus } from '../types/opportunity';

/**
 * Tracks private user application status for an opportunity.
 * Path: users/{uid}/opportunityApplications/{opportunityId}
 */
export const trackApplicationStatus = async (
  opportunityId: string,
  newStatus: ApplicationStatus,
  currentUser: FirebaseUser
): Promise<OpportunityApplication> => {
  if (!currentUser || !opportunityId) throw new Error('Authentication required.');
  const uid = currentUser.uid;

  const oppRef = doc(db, 'opportunities', opportunityId);
  const appRef = doc(db, 'users', uid, 'opportunityApplications', opportunityId);

  await runTransaction(db, async (transaction) => {
    const appSnap = await transaction.get(appRef);
    const prevStatus = appSnap.exists() ? appSnap.data().status : null;

    transaction.set(appRef, {
      opportunityId,
      status: newStatus,
      appliedAt: serverTimestamp(),
    });

    if (newStatus === 'applied' && prevStatus !== 'applied') {
      transaction.update(oppRef, { applicationCount: increment(1) });
    }
  });

  logAnalyticsEvent('opportunity_applied', { opportunityId, status: newStatus });
  return {
    opportunityId,
    status: newStatus,
    appliedAt: new Date(),
  };
};

/**
 * Reads user's private application status for an opportunity.
 */
export const getUserApplicationStatus = async (
  opportunityId: string,
  uid: string
): Promise<OpportunityApplication | null> => {
  if (!opportunityId || !uid) return null;
  try {
    const appRef = doc(db, 'users', uid, 'opportunityApplications', opportunityId);
    const snap = await getDoc(appRef);
    if (!snap.exists()) return null;
    return snap.data() as OpportunityApplication;
  } catch (err) {
    return null;
  }
};
