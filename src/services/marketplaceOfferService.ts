import {
  doc,
  setDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import { createNotification } from './notificationService';
import type { MarketplaceOffer } from '../types/marketplace';

export const makeOffer = async (
  listingId: string,
  listingTitle: string,
  buyerId: string,
  buyerName: string,
  buyerAvatar: string,
  sellerId: string,
  amount: number
): Promise<string> => {
  if (!listingId || !buyerId || !sellerId || amount <= 0) {
    throw new Error('Invalid offer parameters.');
  }
  if (buyerId === sellerId) {
    throw new Error('You cannot make an offer on your own listing.');
  }

  const offerId = `offer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const offerRef = doc(db, 'marketplaceOffers', offerId);

  await setDoc(offerRef, {
    id: offerId,
    listingId,
    listingTitle,
    buyerId,
    buyerName,
    buyerAvatar,
    sellerId,
    amount,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  // Targeted Notification to Seller
  createNotification({
    recipientId: sellerId,
    senderId: buyerId,
    senderName: buyerName,
    senderAvatar: buyerAvatar,
    message: `offered ₹${amount} for "${listingTitle}"`,
    deepLink: `/marketplace/${listingId}`,
    deterministicId: `notif_offer_${offerId}`,
  });

  logAnalyticsEvent('offer_created', { listingId, amount });
  return offerId;
};

export const acceptOffer = async (offerId: string, sellerId: string): Promise<void> => {
  if (!offerId || !sellerId) return;
  const offerRef = doc(db, 'marketplaceOffers', offerId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(offerRef);
    if (!snap.exists()) throw new Error('Offer not found.');
    const data = snap.data() as MarketplaceOffer;

    if (data.sellerId !== sellerId) {
      throw new Error('Unauthorized: Only the seller can accept offers.');
    }
    if (data.status !== 'pending') {
      throw new Error(`Offer cannot be accepted because status is ${data.status}.`);
    }

    tx.update(offerRef, { status: 'accepted', updatedAt: serverTimestamp() });

    // Targeted Notification to Buyer
    createNotification({
      recipientId: data.buyerId,
      senderId: sellerId,
      message: `accepted your offer of ₹${data.amount} for "${data.listingTitle || 'item'}"`,
      deepLink: `/marketplace/${data.listingId}`,
    });
  });

  logAnalyticsEvent('offer_accepted', { offerId });
};

export const rejectOffer = async (offerId: string, sellerId: string): Promise<void> => {
  if (!offerId || !sellerId) return;
  const offerRef = doc(db, 'marketplaceOffers', offerId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(offerRef);
    if (!snap.exists()) throw new Error('Offer not found.');
    const data = snap.data() as MarketplaceOffer;

    if (data.sellerId !== sellerId) {
      throw new Error('Unauthorized: Only the seller can reject offers.');
    }

    tx.update(offerRef, { status: 'rejected', updatedAt: serverTimestamp() });

    // Targeted Notification to Buyer
    createNotification({
      recipientId: data.buyerId,
      senderId: sellerId,
      message: `declined your offer for "${data.listingTitle || 'item'}"`,
      deepLink: `/marketplace/${data.listingId}`,
    });
  });

  logAnalyticsEvent('offer_rejected', { offerId });
};

export const withdrawOffer = async (offerId: string, buyerId: string): Promise<void> => {
  if (!offerId || !buyerId) return;
  const offerRef = doc(db, 'marketplaceOffers', offerId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(offerRef);
    if (!snap.exists()) throw new Error('Offer not found.');
    const data = snap.data() as MarketplaceOffer;

    if (data.buyerId !== buyerId) {
      throw new Error('Unauthorized: Only the offer buyer can withdraw their offer.');
    }

    tx.update(offerRef, { status: 'withdrawn', updatedAt: serverTimestamp() });
  });
};

export const getListingOffers = async (
  listingId: string,
  limitCount: number = 20
): Promise<MarketplaceOffer[]> => {
  if (!listingId) return [];
  const boundedLimit = Math.min(50, limitCount);

  const colRef = collection(db, 'marketplaceOffers');
  const snap = await getDocs(
    query(colRef, where('listingId', '==', listingId), limit(boundedLimit))
  );

  return snap.docs.map((d) => d.data() as MarketplaceOffer);
};

export const toggleListingInterest = async (_listingId?: string, _uid?: string, _currentStatus?: boolean): Promise<boolean> => {
  return false;
};
export const hasUserInterest = async () => false;
export const reviewOffer = async (offerId: string, status: 'accepted' | 'rejected', sellerId: string) => {
  if (status === 'accepted') {
    return acceptOffer(offerId, sellerId);
  } else {
    return rejectOffer(offerId, sellerId);
  }
};
