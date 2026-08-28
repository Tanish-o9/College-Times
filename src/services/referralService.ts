import {
  doc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import { createNotification } from './notificationService';
import type { ReferralRequest } from '../types/opportunity';

export const requestReferral = async (
  opportunityId: string,
  opportunityTitle: string,
  requesterId: string,
  requesterName: string,
  requesterAvatar: string,
  referrerId: string,
  note?: string
): Promise<string> => {
  if (!opportunityId || !requesterId || !referrerId) {
    throw new Error('Invalid referral request parameters.');
  }
  if (requesterId === referrerId) {
    throw new Error('You cannot request a referral from yourself.');
  }

  const requestId = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const refDoc = doc(db, 'referralRequests', requestId);

  await setDoc(refDoc, {
    id: requestId,
    opportunityId,
    opportunityTitle,
    requesterId,
    requesterName,
    requesterAvatar,
    referrerId,
    status: 'pending',
    note: note?.trim() || '',
    createdAt: serverTimestamp(),
  });

  // Targeted Notification to Referrer
  createNotification({
    recipientId: referrerId,
    senderId: requesterId,
    senderName: requesterName,
    senderAvatar: requesterAvatar,
    message: `requested a referral for "${opportunityTitle}"`,
    deepLink: `/opportunities/${opportunityId}`,
    deterministicId: `notif_ref_${requestId}`,
  });

  logAnalyticsEvent('referral_requested', { opportunityId });
  return requestId;
};

export const updateReferralStatus = async (
  requestId: string,
  referrerId: string,
  newStatus: 'accepted' | 'rejected' | 'completed'
): Promise<void> => {
  if (!requestId || !referrerId) return;

  const refDoc = doc(db, 'referralRequests', requestId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(refDoc);
    if (!snap.exists()) throw new Error('Referral request not found.');
    const data = snap.data() as ReferralRequest;

    if (data.referrerId !== referrerId) {
      throw new Error('Unauthorized: Only the referrer can update referral status.');
    }

    tx.update(refDoc, { status: newStatus, updatedAt: serverTimestamp() });

    // Targeted Notification to Requester
    createNotification({
      recipientId: data.requesterId,
      senderId: referrerId,
      message: `updated your referral request for "${data.opportunityTitle}" to ${newStatus.toUpperCase()}`,
      deepLink: `/opportunities/${data.opportunityId}`,
    });
  });

  logAnalyticsEvent('referral_status_updated', { requestId, newStatus });
};
