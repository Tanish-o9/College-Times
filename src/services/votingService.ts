import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import { awardReputation } from './reputationService';
import { trackChallengeAction } from './challengeService';

export interface PollOption2 {
  id: string;
  text: string;
  voteCount: number;
}

export interface VotingPoll {
  id?: string;
  question: string;
  options: PollOption2[];
  allowMultiple: boolean;
  anonymous: boolean;
  isPublic: boolean; // campus-wide or group-only
  groupId?: string; // empty if campus-wide
  expiresAt: number; // millisecond timestamp
  createdBy: string;
  creatorName: string;
  totalVotes: number;
  createdAt: any;
}

export interface PollVoteRecord2 {
  uid: string;
  optionIds: string[];
  votedAt: any;
}

/**
 * Creates a new voting poll.
 */
export const createVotingPoll = async (
  params: {
    question: string;
    options: string[];
    allowMultiple: boolean;
    anonymous: boolean;
    isPublic: boolean;
    groupId?: string;
    durationDays?: number;
  },
  currentUser: FirebaseUser,
  userDisplayName?: string
): Promise<string> => {
  if (!currentUser) throw new Error('Authentication required.');
  if (params.options.length < 2 || params.options.length > 10) {
    throw new Error('Poll must have between 2 and 10 options.');
  }

  const durationDays = params.durationDays || 3;
  const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;

  const pollOptions: PollOption2[] = params.options.map((opt, idx) => ({
    id: `opt_${idx + 1}`,
    text: opt.trim(),
    voteCount: 0,
  }));

  const colRef = collection(db, 'polls');
  const creatorName = userDisplayName || currentUser.displayName || 'Campus Student';

  const docRef = await addDoc(colRef, {
    question: params.question.trim(),
    options: pollOptions,
    allowMultiple: params.allowMultiple,
    anonymous: params.anonymous,
    isPublic: params.isPublic,
    groupId: params.groupId || null,
    expiresAt,
    createdBy: currentUser.uid,
    creatorName,
    totalVotes: 0,
    createdAt: serverTimestamp(),
  });

  // Award Reputation points +15 for creating a poll
  awardReputation(currentUser.uid, docRef.id, 'create_poll', 15, `Created poll: ${params.question}`).catch(() => {});
  trackChallengeAction(currentUser.uid, 'polls', 1).catch(() => {});

  return docRef.id;
};

/**
 * Gets all active campus-wide polls.
 */
export const getActiveCampusPolls = async (): Promise<VotingPoll[]> => {
  try {
    const colRef = collection(db, 'polls');
    const q = query(colRef, where('isPublic', '==', true), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as VotingPoll));
  } catch (err) {
    console.error('Failed to get campus polls:', err);
    return [];
  }
};

/**
 * Gets all active polls for a specific group.
 */
export const getGroupVotingPolls = async (groupId: string): Promise<VotingPoll[]> => {
  if (!groupId) return [];
  try {
    const colRef = collection(db, 'polls');
    const q = query(colRef, where('groupId', '==', groupId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as VotingPoll));
  } catch (err) {
    console.error('Failed to get group polls:', err);
    return [];
  }
};

/**
 * Fetches user's vote for a specific poll.
 */
export const getUserVoteRecord = async (pollId: string, userId: string): Promise<PollVoteRecord2 | null> => {
  if (!pollId || !userId) return null;
  try {
    const docRef = doc(db, 'polls', pollId, 'votes', userId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as PollVoteRecord2;
  } catch {
    return null;
  }
};

/**
 * Transactional vote submitter.
 */
export const castVote = async (
  pollId: string,
  selectedOptionIds: string[],
  userId: string
): Promise<void> => {
  if (!pollId || !userId || selectedOptionIds.length === 0) {
    throw new Error('Valid parameters required to cast a vote.');
  }

  const pollRef = doc(db, 'polls', pollId);
  const voteRef = doc(db, 'polls', pollId, 'votes', userId);

  await runTransaction(db, async (tx) => {
    const pollSnap = await tx.get(pollRef);
    if (!pollSnap.exists()) throw new Error('Poll not found.');

    const pollData = pollSnap.data() as VotingPoll;

    // 1. Verify closing time
    if (Date.now() >= pollData.expiresAt) {
      throw new Error('Voting has closed for this poll.');
    }

    // 2. Group membership check for private group polls
    if (pollData.groupId) {
      const memberRef = doc(db, 'groups', pollData.groupId, 'members', userId);
      const memberSnap = await tx.get(memberRef);
      if (!memberSnap.exists()) {
        throw new Error('You must be a member of the group to vote.');
      }
    }

    // 3. Check for previous vote
    const voteSnap = await tx.get(voteRef);
    const prevVote = voteSnap.exists() ? (voteSnap.data() as PollVoteRecord2) : null;

    const optionsMap = new Map<string, PollOption2>();
    pollData.options.forEach((opt) => optionsMap.set(opt.id, { ...opt }));

    // Decrement previous counts if they are changing their vote
    if (prevVote && prevVote.optionIds) {
      prevVote.optionIds.forEach((oldId) => {
        const oldOpt = optionsMap.get(oldId);
        if (oldOpt) {
          oldOpt.voteCount = Math.max(0, oldOpt.voteCount - 1);
        }
      });
    }

    // Increment new selection counts
    selectedOptionIds.forEach((newId) => {
      const newOpt = optionsMap.get(newId);
      if (newOpt) {
        newOpt.voteCount += 1;
      }
    });

    const updatedOptions = Array.from(optionsMap.values());
    const totalVotes = updatedOptions.reduce((sum, opt) => sum + opt.voteCount, 0);

    // Save vote record
    tx.set(voteRef, {
      uid: userId,
      optionIds: selectedOptionIds,
      votedAt: serverTimestamp(),
    });

    // Update poll totals
    tx.update(pollRef, {
      options: updatedOptions,
      totalVotes,
    });
  });

  logAnalyticsEvent('campus_poll_voted', { pollId });
};
