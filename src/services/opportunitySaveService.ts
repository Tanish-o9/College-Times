import { doc, getDoc, getDocs, collection, runTransaction, serverTimestamp, increment } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { Opportunity } from '../types/opportunity';
import { getOpportunityById } from './opportunityService';

/**
 * Atomically toggles saving an opportunity.
 * Path: users/{uid}/savedOpportunities/{opportunityId}
 */
export const toggleSaveOpportunity = async (
  opportunityId: string,
  currentUser: FirebaseUser
): Promise<boolean> => {
  if (!currentUser || !opportunityId) throw new Error('Authentication required.');
  const uid = currentUser.uid;

  const opportunityRef = doc(db, 'opportunities', opportunityId);
  const saveRef = doc(db, 'users', uid, 'savedOpportunities', opportunityId);
  let isNowSaved = false;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(saveRef);
    if (snap.exists()) {
      transaction.delete(saveRef);
      transaction.update(opportunityRef, { saveCount: increment(-1) });
      isNowSaved = false;
    } else {
      transaction.set(saveRef, {
        opportunityId,
        savedAt: serverTimestamp(),
      });
      transaction.update(opportunityRef, { saveCount: increment(1) });
      isNowSaved = true;
    }
  });

  logAnalyticsEvent(isNowSaved ? 'opportunity_saved' : 'opportunity_unsaved', { opportunityId });
  return isNowSaved;
};

/**
 * Checks if user has saved an opportunity.
 */
export const hasUserSavedOpportunity = async (opportunityId: string, uid: string): Promise<boolean> => {
  if (!opportunityId || !uid) return false;
  try {
    const saveRef = doc(db, 'users', uid, 'savedOpportunities', opportunityId);
    const snap = await getDoc(saveRef);
    return snap.exists();
  } catch (err) {
    return false;
  }
};

/**
 * Fetches opportunities saved by the current user.
 */
export const getSavedOpportunities = async (currentUser: FirebaseUser): Promise<Opportunity[]> => {
  if (!currentUser) return [];
  try {
    const savesRef = collection(db, 'users', currentUser.uid, 'savedOpportunities');
    const snap = await getDocs(savesRef);
    const ids = snap.docs.map((d) => d.id);

    const results = await Promise.all(ids.map((id) => getOpportunityById(id)));
    return results.filter((o: Opportunity | null): o is Opportunity => o !== null);
  } catch (err) {
    console.error('Error fetching saved opportunities:', err);
    return [];
  }
};
