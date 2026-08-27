import { 
  doc, 
  runTransaction, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';

export interface ToggleReactionParams {
  channelId: string;
  messageId: string;
  userId: string;
  emoji: string;
}

/**
 * Transactionally toggles or updates an emoji reaction on a message.
 * Maintains atomic synchronization between user's reaction sub-doc and message.reactionCounts map.
 */
export const toggleReaction = async ({
  channelId,
  messageId,
  userId,
  emoji,
}: ToggleReactionParams): Promise<void> => {
  if (!channelId || !messageId || !userId || !emoji) return;

  const reactionRef = doc(db, 'channels', channelId, 'messages', messageId, 'reactions', userId);
  const messageRef = doc(db, 'channels', channelId, 'messages', messageId);

  await runTransaction(db, async (transaction) => {
    const messageSnap = await transaction.get(messageRef);
    if (!messageSnap.exists()) {
      throw new Error('Message no longer exists.');
    }

    const reactionSnap = await transaction.get(reactionRef);

    if (!reactionSnap.exists()) {
      // Case A: Add new reaction
      transaction.set(reactionRef, {
        emoji,
        userId,
        createdAt: serverTimestamp(),
      });

      transaction.update(messageRef, {
        [`reactionCounts.${emoji}`]: increment(1),
      });
    } else {
      const existingEmoji = reactionSnap.data().emoji;

      if (existingEmoji === emoji) {
        // Case B: Remove existing reaction (Same emoji clicked)
        transaction.delete(reactionRef);

        const currentCounts = messageSnap.data().reactionCounts || {};
        const currentVal = currentCounts[emoji] || 0;
        const newVal = Math.max(0, currentVal - 1);

        transaction.update(messageRef, {
          [`reactionCounts.${emoji}`]: newVal,
        });
      } else {
        // Case C: Change reaction (e.g., 👍 -> ❤️)
        transaction.set(reactionRef, {
          emoji,
          userId,
          updatedAt: serverTimestamp(),
        });

        const currentCounts = messageSnap.data().reactionCounts || {};
        const oldVal = currentCounts[existingEmoji] || 0;
        const newOldVal = Math.max(0, oldVal - 1);

        transaction.update(messageRef, {
          [`reactionCounts.${existingEmoji}`]: newOldVal,
          [`reactionCounts.${emoji}`]: increment(1),
        });
      }
    }
  });

  logAnalyticsEvent('chat_reaction_toggled', { channelId, emoji });
};
