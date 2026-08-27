import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import { createNotification } from './notificationService';

export const SUPPORTED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'] as const;
export type SupportedReaction = (typeof SUPPORTED_REACTIONS)[number];

/**
 * Reads user reaction for a post.
 */
export const getUserPostReaction = async (
  postId: string,
  uid: string
): Promise<string | null> => {
  if (!postId || !uid) return null;
  try {
    const reactionRef = doc(db, 'posts', postId, 'reactions', uid);
    const snap = await getDoc(reactionRef);
    if (!snap.exists()) return null;
    return (snap.data() as { emoji: string }).emoji || null;
  } catch (err) {
    return null;
  }
};

/**
 * Toggles or updates post emoji reaction atomically using transactions.
 */
export const togglePostReaction = async (
  postId: string,
  emoji: SupportedReaction,
  currentUser: FirebaseUser,
  postAuthorId?: string
): Promise<{ userEmoji: string | null; reactionCounts: Record<string, number> }> => {
  if (!currentUser || !postId || !SUPPORTED_REACTIONS.includes(emoji)) {
    throw new Error('Valid reaction emoji required.');
  }

  const uid = currentUser.uid;
  const postRef = doc(db, 'posts', postId);
  const reactionRef = doc(db, 'posts', postId, 'reactions', uid);

  let newUserEmoji: string | null = null;
  let finalCounts: Record<string, number> = {};

  await runTransaction(db, async (transaction) => {
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists()) throw new Error('Post not found.');

    const reactionSnap = await transaction.get(reactionRef);
    const existingEmoji = reactionSnap.exists()
      ? (reactionSnap.data() as { emoji: string }).emoji
      : null;

    const currentCounts: Record<string, number> = {
      ...(postSnap.data().reactionCounts || {}),
    };

    if (existingEmoji === emoji) {
      // Toggle OFF
      currentCounts[emoji] = Math.max(0, (currentCounts[emoji] || 0) - 1);
      if (currentCounts[emoji] === 0) delete currentCounts[emoji];
      transaction.delete(reactionRef);
      newUserEmoji = null;
    } else {
      // If previous emoji existed, decrement its count
      if (existingEmoji && currentCounts[existingEmoji]) {
        currentCounts[existingEmoji] = Math.max(0, currentCounts[existingEmoji] - 1);
        if (currentCounts[existingEmoji] === 0) delete currentCounts[existingEmoji];
      }

      // Increment new emoji count
      currentCounts[emoji] = (currentCounts[emoji] || 0) + 1;
      transaction.set(reactionRef, {
        uid,
        emoji,
        reactedAt: serverTimestamp(),
      });
      newUserEmoji = emoji;
    }

    finalCounts = currentCounts;
    transaction.update(postRef, {
      reactionCounts: currentCounts,
    });
  });

  // Targeted notification for post author (if not self)
  if (newUserEmoji && postAuthorId && postAuthorId !== uid) {
    createNotification({
      recipientId: postAuthorId,
      senderId: uid,
      type: 'reaction',
      title: 'New Reaction',
      message: `${currentUser.displayName || 'Someone'} reacted ${emoji} to your post.`,
      deepLink: `/?postId=${postId}`,
    }).catch(() => {});
  }

  logAnalyticsEvent('post_reaction_toggled', { emoji });
  return { userEmoji: newUserEmoji, reactionCounts: finalCounts };
};
