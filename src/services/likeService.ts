import { 
  doc, 
  getDoc, 
  runTransaction, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createNotification } from './notificationService';
import { logCampusActivity } from './activityCenterService';
import type { User } from '../types';

export type ReactionType = 'like' | 'love' | 'celebrate' | 'support' | 'insightful';

/**
 * Checks whether a user has reacted to a specific post and returns the type.
 */
export const getUserReaction = async (postId: string, userId: string): Promise<ReactionType | null> => {
  if (!postId || !userId) return null;
  try {
    const likeRef = doc(db, 'posts', postId, 'likes', userId);
    const snap = await getDoc(likeRef);
    if (!snap.exists()) return null;
    return (snap.data().type as ReactionType) || 'like';
  } catch (error) {
    console.error('Error checking reaction status:', error);
    return null;
  }
};

/**
 * Backward-compatible wrapper checking if user liked/reacted to a post.
 */
export const hasUserLiked = async (postId: string, userId: string): Promise<boolean> => {
  const reaction = await getUserReaction(postId, userId);
  return reaction !== null;
};

/**
 * Atomically updates post reaction for a user.
 * Supports Like, Love, Celebrate, Support, Insightful.
 */
export const toggleReaction = async (
  postId: string,
  userId: string,
  reactionType: ReactionType,
  postAuthorId?: string,
  userProfile?: User | null
): Promise<{ reacted: boolean; reactionType: ReactionType | null; newLikeCount: number; reactionCounts: Record<string, number> }> => {
  if (!postId || !userId) {
    throw new Error('Post ID and User ID are required to react');
  }

  const likeRef = doc(db, 'posts', postId, 'likes', userId);
  const postRef = doc(db, 'posts', postId);

  let isNowReacted = false;
  let activeReactionType: ReactionType | null = null;
  let updatedCount = 0;
  let updatedReactions: Record<string, number> = {};

  await runTransaction(db, async (transaction) => {
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists()) {
      throw new Error('Post does not exist');
    }

    const likeSnap = await transaction.get(likeRef);
    const postData = postSnap.data();
    const currentCount = postData.likeCount ?? 0;
    
    // Dynamic schema migration: initialize reactionCounts if not present
    const reactionCounts: Record<string, number> = {
      like: 0,
      love: 0,
      celebrate: 0,
      support: 0,
      insightful: 0,
      ...(postData.reactionCounts || {})
    };

    // If reactionCounts is empty and likeCount > 0, migrate legacy likes to 'like' type
    if (!postData.reactionCounts && currentCount > 0) {
      reactionCounts.like = currentCount;
    }

    if (likeSnap.exists()) {
      const oldType: ReactionType = likeSnap.data().type || 'like';
      if (oldType === reactionType) {
        // Toggle OFF (User removes their active reaction)
        transaction.delete(likeRef);
        updatedCount = Math.max(0, currentCount - 1);
        reactionCounts[oldType] = Math.max(0, reactionCounts[oldType] - 1);
        transaction.update(postRef, {
          likeCount: increment(-1),
          reactionCounts,
        });
        isNowReacted = false;
        activeReactionType = null;
      } else {
        // Change reaction type (e.g. Like -> Love)
        transaction.update(likeRef, { type: reactionType, likedAt: serverTimestamp() });
        reactionCounts[oldType] = Math.max(0, reactionCounts[oldType] - 1);
        reactionCounts[reactionType] = (reactionCounts[reactionType] || 0) + 1;
        updatedCount = currentCount;
        transaction.update(postRef, {
          reactionCounts,
        });
        isNowReacted = true;
        activeReactionType = reactionType;
      }
    } else {
      // Add NEW reaction
      transaction.set(likeRef, { type: reactionType, likedAt: serverTimestamp() });
      updatedCount = currentCount + 1;
      reactionCounts[reactionType] = (reactionCounts[reactionType] || 0) + 1;
      transaction.update(postRef, {
        likeCount: increment(1),
        reactionCounts,
      });
      isNowReacted = true;
      activeReactionType = reactionType;
    }

    updatedReactions = reactionCounts;
  });

  if (isNowReacted) {
    logCampusActivity(
      {
        type: 'system',
        action: `reacted with '${reactionType}' to a post`,
        actorId: userId,
        actorName: userProfile?.displayName || 'Student',
        actorAvatar: userProfile?.photoURL || undefined,
        targetId: postId,
      },
      `reaction_${postId}_${userId}`
    );
  }

  // Trigger notification if newly reacted/changed and not reacting own post
  if (isNowReacted && postAuthorId && postAuthorId !== userId) {
    const senderName = userProfile?.displayName || 'A student';
    createNotification({
      recipientId: postAuthorId,
      senderId: userId,
      message: `${senderName} reacted with '${reactionType}' to your post`,
      relatedPostId: postId,
      type: 'post_like',
      category: 'feed',
      deepLink: `/feed`,
      deterministicId: `like_${postId}_${userId}`,
    });
  }

  return {
    reacted: isNowReacted,
    reactionType: activeReactionType,
    newLikeCount: updatedCount,
    reactionCounts: updatedReactions,
  };
};

/**
 * Backward-compatible toggleLike function.
 */
export const toggleLike = async (
  postId: string,
  userId: string,
  postAuthorId?: string,
  userProfile?: User | null
): Promise<{ liked: boolean; newLikeCount: number }> => {
  const res = await toggleReaction(postId, userId, 'like', postAuthorId, userProfile);
  return { liked: res.reacted, newLikeCount: res.newLikeCount };
};
