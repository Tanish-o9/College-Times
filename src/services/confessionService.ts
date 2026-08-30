import {
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type {
  Confession,
  ConfessionComment,
  PrivateConfessionMetadata,
} from '../types/confession';
import toast from 'react-hot-toast';

const CONFESSIONS_COL = 'confessions';
const PRIVATE_META_COL = 'confessionPrivateMetadata';

/**
 * Submits an anonymous confession.
 * CRITICAL ANONYMITY REQUIREMENT: Public document in `confessions/{id}`
 * MUST NOT contain authorId, uid, email, displayName, or any identifying fields.
 * Author identity is saved ONLY in privileged `confessionPrivateMetadata/{id}`.
 */
export const createConfession = async (
  text: string,
  currentUser: FirebaseUser
): Promise<Confession> => {
  if (!currentUser) {
    throw new Error('Authentication is required to post a confession.');
  }

  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Please write something before posting.');
  }
  if (cleanText.length > 1000) {
    throw new Error('Confession is too long (max 1000 characters).');
  }

  const confessionRef = doc(collection(db, CONFESSIONS_COL));
  const confessionId = confessionRef.id;
  const privateMetaRef = doc(db, PRIVATE_META_COL, confessionId);

  // Public Document Data - STRICT ZERO IDENTITY FIELDS
  const publicData = {
    id: confessionId,
    text: cleanText,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    likesCount: 0,
    commentsCount: 0,
    reportsCount: 0,
    status: 'PUBLISHED',
    moderationStatus: 'APPROVED',
    isActive: true,
  };

  // Privileged Private Metadata - Admin / Moderator only read
  const privateData: PrivateConfessionMetadata = {
    confessionId,
    authorId: currentUser.uid,
    createdAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(confessionRef, publicData);
  batch.set(privateMetaRef, privateData);
  await batch.commit();

  logAnalyticsEvent('confession_created', { confessionId });

  return {
    id: confessionId,
    text: cleanText,
    createdAt: new Date(),
    updatedAt: new Date(),
    likesCount: 0,
    commentsCount: 0,
    reportsCount: 0,
    status: 'PUBLISHED',
    moderationStatus: 'APPROVED',
    isActive: true,
  };
};

/**
 * Subscribes to real-time live feed of active published confessions (newest first).
 */
export const subscribeConfessions = (
  callback: (confessions: Confession[]) => void
): Unsubscribe => {
  const colRef = collection(db, CONFESSIONS_COL);

  let q = query(
    colRef,
    where('isActive', '==', true),
    where('status', '==', 'PUBLISHED'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      const list: Confession[] = snap.docs.map((d) => ({
        ...(d.data() as Confession),
        id: d.id,
      }));
      callback(list);
    },
    (err) => {
      console.warn('Index requirement fallback for confessions feed:', err);
      // Fallback query if ordering index is pending
      const fallbackQuery = query(
        colRef,
        where('status', '==', 'PUBLISHED'),
        limit(50)
      );
      onSnapshot(fallbackQuery, (snap) => {
        const list: Confession[] = snap.docs
          .map((d) => ({
            ...(d.data() as Confession),
            id: d.id,
          }))
          .filter((c) => c.isActive !== false);

        // Sort in memory by createdAt
        list.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });

        callback(list);
      });
    }
  );

  return unsubscribe;
};

/**
 * Toggles like on a confession. Prevent duplicate likes using transactional doc check.
 */
export const toggleConfessionLike = async (
  confessionId: string,
  uid: string
): Promise<{ liked: boolean; newCount: number }> => {
  if (!confessionId || !uid) throw new Error('Missing parameters.');

  const confessionRef = doc(db, CONFESSIONS_COL, confessionId);
  const likeRef = doc(db, CONFESSIONS_COL, confessionId, 'likes', uid);

  let liked = false;
  let newCount = 0;

  await runTransaction(db, async (tx) => {
    const confessionSnap = await tx.get(confessionRef);
    if (!confessionSnap.exists()) {
      throw new Error('Confession not found.');
    }

    const likeSnap = await tx.get(likeRef);
    const currentLikes = confessionSnap.data()?.likesCount || 0;

    if (likeSnap.exists()) {
      // Unlike
      tx.delete(likeRef);
      newCount = Math.max(0, currentLikes - 1);
      tx.update(confessionRef, { likesCount: newCount });
      liked = false;
    } else {
      // Like
      tx.set(likeRef, {
        confessionId,
        userId: uid,
        createdAt: serverTimestamp(),
      });
      newCount = currentLikes + 1;
      tx.update(confessionRef, { likesCount: newCount });
      liked = true;
    }
  });

  logAnalyticsEvent('confession_liked', { confessionId, liked });

  return { liked, newCount };
};

/**
 * Checks if current user has liked a confession.
 */
export const checkUserLikedConfession = async (
  confessionId: string,
  uid: string
): Promise<boolean> => {
  if (!confessionId || !uid) return false;
  try {
    const likeRef = doc(db, CONFESSIONS_COL, confessionId, 'likes', uid);
    const snap = await getDoc(likeRef);
    return snap.exists();
  } catch {
    return false;
  }
};

/**
 * Adds an anonymous comment to a confession.
 * Public comment contains ZERO author identity fields.
 */
export const addConfessionComment = async (
  confessionId: string,
  text: string,
  currentUser: FirebaseUser
): Promise<ConfessionComment> => {
  if (!currentUser) throw new Error('Authentication required to comment.');

  const cleanText = text.trim();
  if (!cleanText) throw new Error('Comment cannot be empty.');
  if (cleanText.length > 500) throw new Error('Comment is too long (max 500 chars).');

  const commentRef = doc(collection(db, CONFESSIONS_COL, confessionId, 'comments'));
  const confessionRef = doc(db, CONFESSIONS_COL, confessionId);

  const commentData: ConfessionComment = {
    id: commentRef.id,
    confessionId,
    text: cleanText,
    createdAt: serverTimestamp(),
    status: 'PUBLISHED',
  };

  const batch = writeBatch(db);
  batch.set(commentRef, commentData);
  batch.update(confessionRef, { commentsCount: increment(1) });
  await batch.commit();

  return {
    ...commentData,
    createdAt: new Date(),
  };
};

/**
 * Subscribes to anonymous comments for a specific confession.
 */
export const subscribeConfessionComments = (
  confessionId: string,
  callback: (comments: ConfessionComment[]) => void
): Unsubscribe => {
  const colRef = collection(db, CONFESSIONS_COL, confessionId, 'comments');
  const q = query(colRef, orderBy('createdAt', 'asc'), limit(100));

  return onSnapshot(
    q,
    (snap) => {
      const list: ConfessionComment[] = snap.docs.map((d) => ({
        ...(d.data() as ConfessionComment),
        id: d.id,
      }));
      callback(list);
    },
    () => {
      // Fallback un-ordered
      onSnapshot(collection(db, CONFESSIONS_COL, confessionId, 'comments'), (snap) => {
        const list: ConfessionComment[] = snap.docs.map((d) => ({
          ...(d.data() as ConfessionComment),
          id: d.id,
        }));
        callback(list);
      });
    }
  );
};

/**
 * Submits a report for an inappropriate confession.
 */
export const reportConfession = async (
  confessionId: string,
  reason: string,
  uid: string
): Promise<void> => {
  if (!confessionId || !uid) return;

  const reportRef = doc(db, CONFESSIONS_COL, confessionId, 'reports', uid);
  const confessionRef = doc(db, CONFESSIONS_COL, confessionId);

  await runTransaction(db, async (tx) => {
    const reportSnap = await tx.get(reportRef);
    if (reportSnap.exists()) {
      throw new Error('You have already reported this confession.');
    }

    tx.set(reportRef, {
      confessionId,
      reporterId: uid,
      reason: reason.trim() || 'Inappropriate content',
      createdAt: serverTimestamp(),
      status: 'PENDING',
    });

    const confessionSnap = await tx.get(confessionRef);
    if (confessionSnap.exists()) {
      tx.update(confessionRef, { reportsCount: increment(1) });
    }
  });

  logAnalyticsEvent('confession_reported', { confessionId, reason });
  toast.success('Report submitted to campus moderators. Thank you.');
};
