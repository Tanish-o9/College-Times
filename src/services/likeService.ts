import { 
  doc, 
  getDoc, 
  runTransaction, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createNotification } from './notificationService';
import type { User } from '../types';

/**
 * Checks whether a user has liked a specific post.
 */
export const hasUserLiked = async (postId: string, userId: string): Promise<boolean> => {
  if (!postId || !userId) return false;
  try {
    const likeRef = doc(db, 'posts', postId, 'likes', userId);
    const snap = await getDoc(likeRef);
    return snap.exists();
  } catch (error) {
    console.error('Error checking like status:', error);
    return false;
  }
};

/**
 * Atomically toggles a post like for a user.
 * Uses a Firestore transaction to ensure parent post `likeCount` and sub-collection document stay synchronized.
 */
export const toggleLike = async (
  postId: string,
  userId: string,
  postAuthorId?: string,
  userProfile?: User | null
): Promise<{ liked: boolean; newLikeCount: number }> => {
  if (!postId || !userId) {
    throw new Error('Post ID and User ID are required to toggle like');
  }

  const likeRef = doc(db, 'posts', postId, 'likes', userId);
  const postRef = doc(db, 'posts', postId);

  let isNowLiked = false;
  let updatedCount = 0;

  await runTransaction(db, async (transaction) => {
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists()) {
      throw new Error('Post does not exist');
    }

    const likeSnap = await transaction.get(likeRef);
    const currentCount = postSnap.data().likeCount ?? 0;

    if (likeSnap.exists()) {
      // Unlike post
      transaction.delete(likeRef);
      updatedCount = Math.max(0, currentCount - 1);
      transaction.update(postRef, { likeCount: increment(-1) });
      isNowLiked = false;
    } else {
      // Like post
      transaction.set(likeRef, { likedAt: serverTimestamp() });
      updatedCount = currentCount + 1;
      transaction.update(postRef, { likeCount: increment(1) });
      isNowLiked = true;
    }
  });

  // Trigger notification if newly liked and not liking own post
  if (isNowLiked && postAuthorId && postAuthorId !== userId) {
    const senderName = userProfile?.displayName || 'A student';
    createNotification({
      recipientId: postAuthorId,
      senderId: userId,
      message: `${senderName} liked your post`,
      relatedPostId: postId,
    });
  }

  return { liked: isNowLiked, newLikeCount: updatedCount };
};
