import { doc, getDoc, runTransaction, serverTimestamp, collection } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { Post, User } from '../types/models';
import type { PollData, PollOption, PollVoteRecord } from '../types/poll';

export interface CreatePollParams {
  question: string;
  options: string[];
  allowMultiple?: boolean;
  anonymous?: boolean;
  durationDays?: number;
  groupId?: string;
  category?: 'Mishap' | 'Event' | 'General' | 'LostFound';
}

/**
 * Creates a new poll post in Firestore posts collection.
 */
export const createPollPost = async (
  params: CreatePollParams,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<Post> => {
  if (!currentUser) throw new Error('Authentication required to create a poll.');
  if (!params.question || params.question.trim().length === 0) {
    throw new Error('Poll question is required.');
  }

  const cleanOptions = (params.options || []).map((o) => o.trim()).filter(Boolean);
  if (cleanOptions.length < 2 || cleanOptions.length > 10) {
    throw new Error('Poll must contain between 2 and 10 options.');
  }

  const durationDays = params.durationDays || 3;
  const expiresAtMs = Date.now() + durationDays * 24 * 60 * 60 * 1000;

  const pollOptions: PollOption[] = cleanOptions.map((text, idx) => ({
    id: `opt_${idx + 1}`,
    text: text.slice(0, 100),
    voteCount: 0,
  }));

  const pollData: PollData = {
    question: params.question.trim().slice(0, 200),
    options: pollOptions,
    allowMultiple: params.allowMultiple ?? false,
    anonymous: params.anonymous ?? false,
    expiresAt: expiresAtMs,
    totalVotes: 0,
  };

  const postsRef = collection(db, 'posts');
  const authorName = userProfile?.displayName || currentUser.displayName || 'Student';

  const newPostData = {
    title: params.question.trim().slice(0, 80),
    content: `📊 Poll: ${params.question.trim()}`,
    category: params.category || 'General',
    authorId: currentUser.uid,
    authorName,
    timestamp: serverTimestamp(),
    likeCount: 0,
    commentCount: 0,
    reportCount: 0,
    status: 'active' as const,
    postType: 'news' as const,
    ...(params.groupId ? { groupId: params.groupId } : {}),
    poll: pollData,
  };

  let newDocId = '';
  await runTransaction(db, async (transaction) => {
    const newPostRef = doc(postsRef);
    newDocId = newPostRef.id;
    transaction.set(newPostRef, newPostData);
  });

  logAnalyticsEvent('group_poll_created', { optionCount: pollOptions.length });

  return {
    id: newDocId,
    ...newPostData,
    timestamp: new Date(),
  } as Post;
};

/**
 * Checks if user has already voted on a poll post.
 */
export const getUserPollVote = async (
  postId: string,
  uid: string
): Promise<PollVoteRecord | null> => {
  if (!postId || !uid) return null;
  try {
    const voteRef = doc(db, 'posts', postId, 'pollVotes', uid);
    const snap = await getDoc(voteRef);
    if (!snap.exists()) return null;
    return snap.data() as PollVoteRecord;
  } catch (err) {
    return null;
  }
};

/**
 * Atomic transaction to register a poll vote.
 * Updates user vote record in posts/{postId}/pollVotes/{uid} and updates option voteCounts.
 */
export const votePoll = async (
  postId: string,
  selectedOptionIds: string[],
  currentUser: FirebaseUser
): Promise<{ success: boolean; pollData: PollData }> => {
  if (!currentUser || !postId || !selectedOptionIds || selectedOptionIds.length === 0) {
    throw new Error('Valid option selection is required.');
  }

  const uid = currentUser.uid;
  const postRef = doc(db, 'posts', postId);
  const voteRef = doc(db, 'posts', postId, 'pollVotes', uid);

  let updatedPollData: PollData | null = null;

  await runTransaction(db, async (transaction) => {
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists()) throw new Error('Poll post not found.');

    const postData = postSnap.data() as Post;
    if (!postData.poll) throw new Error('Post does not contain a poll.');

    const currentPoll: PollData = postData.poll;

    // Check expiration
    let expMs = currentPoll.expiresAt;
    if (typeof expMs === 'object' && expMs !== null && typeof expMs.toMillis === 'function') {
      expMs = expMs.toMillis();
    }
    if (Date.now() >= expMs) {
      throw new Error('This poll has expired.');
    }

    const voteSnap = await transaction.get(voteRef);
    const prevVote = voteSnap.exists() ? (voteSnap.data() as PollVoteRecord) : null;

    const optionsMap = new Map<string, PollOption>();
    currentPoll.options.forEach((opt) => optionsMap.set(opt.id, { ...opt }));

    // Decrement previous votes if re-voting
    if (prevVote && prevVote.optionIds) {
      prevVote.optionIds.forEach((oldOptId) => {
        const oldOpt = optionsMap.get(oldOptId);
        if (oldOpt) {
          oldOpt.voteCount = Math.max(0, oldOpt.voteCount - 1);
        }
      });
    }

    // Increment new selected options
    selectedOptionIds.forEach((newOptId) => {
      const newOpt = optionsMap.get(newOptId);
      if (newOpt) {
        newOpt.voteCount += 1;
      }
    });

    const updatedOptions = Array.from(optionsMap.values());
    const totalVotes = updatedOptions.reduce((sum, opt) => sum + opt.voteCount, 0);

    updatedPollData = {
      ...currentPoll,
      options: updatedOptions,
      totalVotes,
    };

    // Save vote record and update post poll data
    transaction.set(voteRef, {
      uid,
      optionIds: selectedOptionIds,
      votedAt: serverTimestamp(),
    });

    transaction.update(postRef, {
      poll: updatedPollData,
    });
  });

  logAnalyticsEvent('group_poll_voted', { postId });
  return { success: true, pollData: updatedPollData! };
};
