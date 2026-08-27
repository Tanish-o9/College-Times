import {
  doc,
  collection,
  query,
  limit,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { SellerReview } from '../types/marketplace';

export const createSellerReview = async (
  sellerUid: string,
  reviewerUid: string,
  reviewerName: string,
  reviewerAvatar: string,
  listingId: string,
  rating: number,
  reviewText: string
): Promise<string> => {
  if (!sellerUid || !reviewerUid || rating < 1 || rating > 5) {
    throw new Error('Invalid review parameters.');
  }
  if (sellerUid === reviewerUid) {
    throw new Error('You cannot review yourself.');
  }

  const reviewId = `review_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const reviewRef = doc(db, 'users', sellerUid, 'sellerReviews', reviewId);
  const sellerUserRef = doc(db, 'users', sellerUid);

  const cleanText = reviewText.trim().slice(0, 500);

  await runTransaction(db, async (tx) => {
    tx.set(reviewRef, {
      id: reviewId,
      sellerUid,
      reviewerUid,
      reviewerName,
      reviewerAvatar,
      listingId,
      rating,
      reviewText: cleanText,
      createdAt: serverTimestamp(),
    });

    const sellerSnap = await tx.get(sellerUserRef);
    if (sellerSnap.exists()) {
      const data = sellerSnap.data();
      const currentCount = data.reviewCount || 0;
      const currentRatingSum = (data.averageRating || 0) * currentCount;
      const newCount = currentCount + 1;
      const newAverage = Number(((currentRatingSum + rating) / newCount).toFixed(1));

      tx.set(
        sellerUserRef,
        {
          reviewCount: newCount,
          averageRating: newAverage,
        },
        { merge: true }
      );
    }
  });

  logAnalyticsEvent('seller_review_created', { sellerUid, rating });
  return reviewId;
};

export const getSellerReviews = async (
  sellerUid: string,
  limitCount: number = 20
): Promise<SellerReview[]> => {
  if (!sellerUid) return [];
  const boundedLimit = Math.min(50, limitCount);

  const colRef = collection(db, 'users', sellerUid, 'sellerReviews');
  const snap = await getDocs(query(colRef, limit(boundedLimit)));

  return snap.docs.map((d) => d.data() as SellerReview);
};
