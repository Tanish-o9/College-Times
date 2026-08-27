import { doc, getDoc, getDocs, collection, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { LostFoundClaim, PrivateVerificationDetails, ClaimStatus } from '../types/lostFound';
import { createNotification } from './notificationService';

/**
 * Submits an ownership claim for a lost or found item.
 * Path: posts/{itemId}/claims/{uid} (Deterministic document ID per user).
 */
export const submitClaim = async (
  itemId: string,
  itemReporterId: string,
  explanation: string,
  verificationAnswer: string | undefined,
  currentUser: FirebaseUser
): Promise<LostFoundClaim> => {
  if (!currentUser || !itemId || !itemReporterId) {
    throw new Error('Authentication and valid item ID required.');
  }

  const uid = currentUser.uid;
  if (uid === itemReporterId) {
    throw new Error('You cannot claim your own reported item.');
  }

  if (!explanation || explanation.trim().length === 0) {
    throw new Error('Please provide an explanation of ownership.');
  }

  const claimRef = doc(db, 'posts', itemId, 'claims', uid);
  const claimantName = currentUser.displayName || 'Student';

  const claimData = {
    id: uid,
    itemId,
    itemReporterId,
    claimantId: uid,
    claimantName,
    explanation: explanation.trim().slice(0, 500),
    ...(verificationAnswer?.trim() ? { verificationAnswer: verificationAnswer.trim().slice(0, 300) } : {}),
    status: 'pending' as ClaimStatus,
    createdAt: serverTimestamp(),
  };

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(claimRef);
    if (snap.exists() && snap.data().status === 'approved') {
      throw new Error('Your claim has already been approved.');
    }
    transaction.set(claimRef, claimData);
  });

  // Targeted notification for item reporter
  createNotification({
    recipientId: itemReporterId,
    senderId: uid,
    type: 'lost_found',
    title: 'New Item Claim Submitted',
    message: `${claimantName} submitted an ownership claim for your reported item.`,
    deepLink: `/lost-found/${itemId}`,
  }).catch(() => {});

  logAnalyticsEvent('lost_found_claim_submitted', { itemId });
  return { ...claimData, createdAt: new Date() } as LostFoundClaim;
};

/**
 * Checks if user has an existing claim on an item.
 */
export const getUserClaim = async (itemId: string, uid: string): Promise<LostFoundClaim | null> => {
  if (!itemId || !uid) return null;
  try {
    const claimRef = doc(db, 'posts', itemId, 'claims', uid);
    const snap = await getDoc(claimRef);
    if (!snap.exists()) return null;
    return { ...(snap.data() as LostFoundClaim), id: snap.id };
  } catch (err) {
    return null;
  }
};

/**
 * Reads claims submitted for an item (Reporter or Admin only).
 */
export const getItemClaims = async (
  itemId: string,
  itemReporterId: string,
  currentUser: FirebaseUser
): Promise<LostFoundClaim[]> => {
  if (!currentUser || !itemId) return [];
  if (currentUser.uid !== itemReporterId) {
    // Basic caller check (Security rules enforce on server)
    console.warn('Caller is not item reporter.');
  }

  try {
    const claimsRef = collection(db, 'posts', itemId, 'claims');
    const snap = await getDocs(claimsRef);
    return snap.docs.map((d) => ({ ...(d.data() as LostFoundClaim), id: d.id }));
  } catch (err) {
    console.error(`Error reading claims for item ${itemId}:`, err);
    return [];
  }
};

/**
 * Approves or rejects an item claim (Reporter or Admin only).
 */
export const reviewClaim = async (
  itemId: string,
  claimId: string,
  status: 'approved' | 'rejected',
  currentUser: FirebaseUser,
  claimantId: string
): Promise<void> => {
  if (!currentUser || !itemId || !claimId) throw new Error('Invalid review parameters.');

  const postRef = doc(db, 'posts', itemId);
  const claimRef = doc(db, 'posts', itemId, 'claims', claimId);

  await runTransaction(db, async (transaction) => {
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists()) throw new Error('Item not found.');

    const claimSnap = await transaction.get(claimRef);
    if (!claimSnap.exists()) throw new Error('Claim not found.');

    transaction.update(claimRef, {
      status,
      updatedAt: serverTimestamp(),
    });

    if (status === 'approved') {
      transaction.update(postRef, {
        claimStatus: 'claimed',
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: claimantId,
      });
    }
  });

  // Targeted notification for claimant
  createNotification({
    recipientId: claimantId,
    senderId: currentUser.uid,
    type: 'lost_found',
    title: status === 'approved' ? 'Claim Approved! 🎉' : 'Claim Status Updated',
    message: status === 'approved'
      ? 'Your ownership claim was approved by the item reporter!'
      : 'Your claim status for the lost/found item was updated.',
    deepLink: `/lost-found/${itemId}`,
  }).catch(() => {});

  logAnalyticsEvent(status === 'approved' ? 'lost_found_claim_approved' : 'lost_found_claim_rejected', { itemId });
};

/**
 * Sets private verification details for an item (Reporter or Admin only).
 * Path: posts/{itemId}/privateVerification/details
 */
export const setPrivateVerificationDetails = async (
  itemId: string,
  details: Partial<PrivateVerificationDetails>,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !itemId) return;

  const verifRef = doc(db, 'posts', itemId, 'privateVerification', 'details');
  await setDoc(verifRef, {
    ...details,
    reporterId: currentUser.uid,
    createdAt: serverTimestamp(),
  }, { merge: true });
};
