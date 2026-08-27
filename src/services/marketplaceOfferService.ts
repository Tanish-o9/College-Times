import { doc, getDoc, getDocs, collection, runTransaction, serverTimestamp, increment } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { MarketplaceOffer, OfferStatus } from '../types/marketplace';
import { createNotification } from './notificationService';

/**
 * Atomically toggles user interest in a listing.
 * Path: marketplaceListings/{listingId}/interests/{uid}
 */
export const toggleListingInterest = async (
  listingId: string,
  sellerId: string,
  currentUser: FirebaseUser
): Promise<boolean> => {
  if (!currentUser || !listingId) throw new Error('Authentication required.');
  const uid = currentUser.uid;

  const listingRef = doc(db, 'marketplaceListings', listingId);
  const interestRef = doc(db, 'marketplaceListings', listingId, 'interests', uid);
  let isNowInterested = false;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(interestRef);
    if (snap.exists()) {
      transaction.delete(interestRef);
      transaction.update(listingRef, { interestCount: increment(-1) });
      isNowInterested = false;
    } else {
      transaction.set(interestRef, {
        userId: uid,
        userName: currentUser.displayName || 'Student',
        createdAt: serverTimestamp(),
      });
      transaction.update(listingRef, { interestCount: increment(1) });
      isNowInterested = true;
    }
  });

  if (isNowInterested && sellerId !== uid) {
    createNotification({
      recipientId: sellerId,
      senderId: uid,
      type: 'marketplace_interest',
      title: 'New Listing Interest',
      message: `${currentUser.displayName || 'A student'} expressed interest in your marketplace item.`,
      deepLink: `/marketplace/${listingId}`,
    }).catch(() => {});
  }

  logAnalyticsEvent('marketplace_interest_created', { listingId, isInterested: isNowInterested });
  return isNowInterested;
};

/**
 * Checks if user has expressed interest in a listing.
 */
export const hasUserInterest = async (listingId: string, uid: string): Promise<boolean> => {
  if (!listingId || !uid) return false;
  try {
    const interestRef = doc(db, 'marketplaceListings', listingId, 'interests', uid);
    const snap = await getDoc(interestRef);
    return snap.exists();
  } catch (err) {
    return false;
  }
};

/**
 * Submits an offer on a marketplace listing.
 * Path: marketplaceListings/{listingId}/offers/{uid} (Deterministic document ID per user).
 */
export const makeOffer = async (
  listingId: string,
  sellerId: string,
  amount: number,
  message: string | undefined,
  currentUser: FirebaseUser
): Promise<MarketplaceOffer> => {
  if (!currentUser || !listingId || !sellerId) throw new Error('Authentication required.');
  const uid = currentUser.uid;

  if (uid === sellerId) {
    throw new Error('You cannot make an offer on your own listing.');
  }

  if (isNaN(amount) || amount <= 0) {
    throw new Error('Offer amount must be greater than zero.');
  }

  const offerRef = doc(db, 'marketplaceListings', listingId, 'offers', uid);
  const buyerName = currentUser.displayName || 'Student';

  const offerData = {
    id: uid,
    listingId,
    sellerId,
    buyerId: uid,
    buyerName,
    amount,
    message: message?.trim().slice(0, 300) || '',
    status: 'pending' as OfferStatus,
    createdAt: serverTimestamp(),
  };

  await runTransaction(db, async (transaction) => {
    transaction.set(offerRef, offerData);
  });

  // Targeted notification for seller
  createNotification({
    recipientId: sellerId,
    senderId: uid,
    type: 'marketplace_offer_received',
    title: 'New Price Offer Received 💰',
    message: `${buyerName} submitted an offer of ₹${amount} for your item.`,
    deepLink: `/marketplace/${listingId}`,
  }).catch(() => {});

  logAnalyticsEvent('marketplace_offer_created', { listingId, amount });
  return { ...offerData, createdAt: new Date() } as MarketplaceOffer;
};

/**
 * Reads user's offer on a listing.
 */
export const getUserOffer = async (listingId: string, uid: string): Promise<MarketplaceOffer | null> => {
  if (!listingId || !uid) return null;
  try {
    const offerRef = doc(db, 'marketplaceListings', listingId, 'offers', uid);
    const snap = await getDoc(offerRef);
    if (!snap.exists()) return null;
    return { ...(snap.data() as MarketplaceOffer), id: snap.id };
  } catch (err) {
    return null;
  }
};

/**
 * Reads all offers for a listing (Seller or Admin only).
 */
export const getListingOffers = async (
  listingId: string,
  _sellerId: string,
  currentUser: FirebaseUser
): Promise<MarketplaceOffer[]> => {
  if (!currentUser || !listingId) return [];
  try {
    const offersRef = collection(db, 'marketplaceListings', listingId, 'offers');
    const snap = await getDocs(offersRef);
    return snap.docs.map((d) => ({ ...(d.data() as MarketplaceOffer), id: d.id }));
  } catch (err) {
    console.error(`Error reading offers for listing ${listingId}:`, err);
    return [];
  }
};

/**
 * Approves or rejects an offer (Seller only).
 * Concurrency-safe: Accepting an offer atomically sets listing status to 'reserved'.
 */
export const reviewOffer = async (
  listingId: string,
  offerId: string,
  status: 'accepted' | 'rejected',
  currentUser: FirebaseUser,
  buyerId: string
): Promise<void> => {
  if (!currentUser || !listingId || !offerId) throw new Error('Invalid offer parameters.');

  const listingRef = doc(db, 'marketplaceListings', listingId);
  const offerRef = doc(db, 'marketplaceListings', listingId, 'offers', offerId);

  await runTransaction(db, async (transaction) => {
    const listingSnap = await transaction.get(listingRef);
    if (!listingSnap.exists()) throw new Error('Listing not found.');

    const offerSnap = await transaction.get(offerRef);
    if (!offerSnap.exists()) throw new Error('Offer not found.');

    if (status === 'accepted' && listingSnap.data().status === 'reserved') {
      throw new Error('This listing is already reserved for another accepted offer.');
    }

    transaction.update(offerRef, {
      status,
      updatedAt: serverTimestamp(),
    });

    if (status === 'accepted') {
      transaction.update(listingRef, {
        status: 'reserved',
        updatedAt: serverTimestamp(),
      });
    }
  });

  // Targeted notification for buyer
  createNotification({
    recipientId: buyerId,
    senderId: currentUser.uid,
    type: status === 'accepted' ? 'marketplace_offer_accepted' : 'marketplace_offer_rejected',
    title: status === 'accepted' ? 'Offer Accepted! 🎉' : 'Offer Status Updated',
    message: status === 'accepted'
      ? 'Your price offer was accepted by the seller! Item reserved.'
      : 'Your price offer was rejected by the seller.',
    deepLink: `/marketplace/${listingId}`,
  }).catch(() => {});

  logAnalyticsEvent(status === 'accepted' ? 'marketplace_offer_accepted' : 'marketplace_offer_rejected', { listingId });
};
