import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import { createNotification } from './notificationService';

export const checkUserLikedPost = async (postId: string, userId: string): Promise<boolean> => {
  if (!postId || !userId) return false;
  try {
    const likeRef = doc(db, 'posts', postId, 'likes', userId);
    const snap = await getDoc(likeRef);
    return snap.exists();
  } catch (err) {
    return false;
  }
};

/**
 * Atomic transaction toggle for post likes.
 * Maintains posts/{postId}/likes/{userId} and increments/decrements parent post likeCount safely.
 */
export const togglePostLike = async (
  postId: string,
  currentUser: FirebaseUser,
  postAuthorId?: string
): Promise<{ liked: boolean; newCount: number }> => {
  if (!currentUser || !postId) {
    throw new Error('Authentication required to like posts.');
  }

  const postRef = doc(db, 'posts', postId);
  const likeRef = doc(db, 'posts', postId, 'likes', currentUser.uid);

  let liked = false;
  let newCount = 0;

  await runTransaction(db, async (transaction) => {
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists()) throw new Error('Post not found.');

    const currentLikeCount = postSnap.data().likeCount || 0;
    const likeSnap = await transaction.get(likeRef);

    if (likeSnap.exists()) {
      // Unlike action
      transaction.delete(likeRef);
      newCount = Math.max(0, currentLikeCount - 1);
      transaction.update(postRef, { likeCount: newCount });
      liked = false;
    } else {
      // Like action
      transaction.set(likeRef, {
        userId: currentUser.uid,
        likedAt: serverTimestamp(),
      });
      newCount = currentLikeCount + 1;
      transaction.update(postRef, { likeCount: newCount });
      liked = true;
    }
  });

  // Targeted notification for post author (skipped if liking own post)
  if (liked && postAuthorId && postAuthorId !== currentUser.uid) {
    createNotification({
      recipientId: postAuthorId,
      senderId: currentUser.uid,
      type: 'post_like',
      message: `${currentUser.displayName || 'A student'} liked your post.`,
      postId,
      actorId: currentUser.uid,
      actorName: currentUser.displayName || 'Student',
      deepLink: `/?postId=${postId}`,
    });
  }

  logAnalyticsEvent(liked ? 'post_liked' : 'post_unliked', { postId });
  return { liked, newCount };
};
