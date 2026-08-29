import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { awardReputation } from './reputationService';

export interface Challenge {
  id?: string;
  title: string;
  description: string;
  type: 'events' | 'groups' | 'posts' | 'replies' | 'polls' | 'resources' | 'custom';
  targetCount: number;
  rewardXp: number;
  startDate: any;
  endDate: any;
  status: 'active' | 'upcoming' | 'completed';
}

export interface UserChallengeProgress {
  challengeId: string;
  progress: number;
  status: 'active' | 'completed';
  updatedAt: any;
  completedAt?: any;
}

/**
 * Creates a new campus challenge (Admin Only)
 */
export const createChallenge = async (challenge: Omit<Challenge, 'id'>): Promise<string> => {
  const colRef = collection(db, 'challenges');
  const docRef = await addDoc(colRef, {
    ...challenge,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Fetches all active challenges
 */
export const getActiveChallenges = async (): Promise<Challenge[]> => {
  try {
    const colRef = collection(db, 'challenges');
    const q = query(colRef, where('status', '==', 'active'), orderBy('endDate', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as Challenge));
  } catch (err) {
    console.error('Failed to get active challenges:', err);
    return [];
  }
};

/**
 * Fetches completed challenges for a specific user
 */
export const getUserChallengeProgressList = async (userId: string): Promise<UserChallengeProgress[]> => {
  if (!userId) return [];
  try {
    const colRef = collection(db, 'users', userId, 'challengeProgress');
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => d.data() as UserChallengeProgress);
  } catch (err) {
    console.error('Failed to get user challenge progress:', err);
    return [];
  }
};

/**
 * Join/Register a user for a challenge
 */
export const joinChallenge = async (userId: string, challengeId: string): Promise<void> => {
  if (!userId || !challengeId) return;

  const progressRef = doc(db, 'users', userId, 'challengeProgress', challengeId);
  const participantRef = doc(db, 'challenges', challengeId, 'participants', userId);

  await runTransaction(db, async (tx) => {
    const progressSnap = await tx.get(progressRef);
    if (progressSnap.exists()) return; // Already joined

    tx.set(progressRef, {
      challengeId,
      progress: 0,
      status: 'active',
      updatedAt: serverTimestamp(),
    });

    tx.set(participantRef, {
      uid: userId,
      joinedAt: serverTimestamp(),
      progress: 0,
      status: 'active',
    });
  });
};

/**
 * Transactionally updates challenge progress for a user and awards points if completed.
 */
export const trackChallengeAction = async (
  userId: string,
  challengeType: Challenge['type'],
  incrementVal: number = 1
): Promise<void> => {
  if (!userId) return;

  try {
    // Get all active challenges matching this type
    const challengesCol = collection(db, 'challenges');
    const q = query(challengesCol, where('status', '==', 'active'), where('type', '==', challengeType));
    const activeChallengesSnap = await getDocs(q);

    if (activeChallengesSnap.empty) return;

    for (const challengeDoc of activeChallengesSnap.docs) {
      const challengeId = challengeDoc.id;
      const challengeData = challengeDoc.data() as Challenge;
      
      const progressRef = doc(db, 'users', userId, 'challengeProgress', challengeId);
      const participantRef = doc(db, 'challenges', challengeId, 'participants', userId);

      await runTransaction(db, async (tx) => {
        const progressSnap = await tx.get(progressRef);
        // If they haven't joined yet, join first
        let currentProgress = 0;
        let isCompleted = false;

        if (progressSnap.exists()) {
          const data = progressSnap.data() as UserChallengeProgress;
          if (data.status === 'completed') return; // Already completed
          currentProgress = data.progress;
        }

        const nextProgress = Math.min(challengeData.targetCount, currentProgress + incrementVal);
        if (nextProgress >= challengeData.targetCount) {
          isCompleted = true;
        }

        tx.set(progressRef, {
          challengeId,
          progress: nextProgress,
          status: isCompleted ? 'completed' : 'active',
          updatedAt: serverTimestamp(),
          ...(isCompleted ? { completedAt: serverTimestamp() } : {}),
        }, { merge: true });

        tx.set(participantRef, {
          uid: userId,
          progress: nextProgress,
          status: isCompleted ? 'completed' : 'active',
          updatedAt: serverTimestamp(),
          ...(isCompleted ? { completedAt: serverTimestamp() } : {}),
        }, { merge: true });

        if (isCompleted) {
          // Award XP via reputation service inside transaction if possible
          // Note: Since awardReputation will run inside a transaction, we should structure reputation service carefully.
          // Wait, calling awardReputation inside transaction requires us to run it under the SAME transaction.
          // We will design awardReputation to support passing a transaction object!
        }
      });

      // Award after transaction to avoid nested transaction errors in Firestore
      const checkProgressSnap = await getDoc(progressRef);
      if (checkProgressSnap.exists()) {
        const data = checkProgressSnap.data() as UserChallengeProgress;
        // Verify completed state change
        if (data.status === 'completed' && (!data.completedAt || (Date.now() - (data.completedAt.toMillis ? data.completedAt.toMillis() : Date.now()) < 5000))) {
          // Just completed, award XP
          await awardReputation(
            userId,
            `challenge_${challengeId}`,
            'complete_challenge',
            challengeData.rewardXp,
            `Completed challenge: ${challengeData.title}`
          ).catch((e) => console.warn('Failed to award reputation for challenge:', e));
        }
      }
    }
  } catch (err) {
    console.error('Failed to update challenge progress:', err);
  }
};
