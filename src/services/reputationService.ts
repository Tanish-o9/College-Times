import {
  doc,
  runTransaction,
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type ReputationActionType =
  | 'create_post'
  | 'create_poll'
  | 'create_event'
  | 'helpful_reply'
  | 'join_group'
  | 'complete_challenge'
  | 'attend_event'
  | 'helpful_resource';

export interface ReputationHistoryEntry {
  id?: string;
  actionId: string;
  type: ReputationActionType;
  points: number;
  description: string;
  createdAt: any;
}

// Level threshold config: e.g. Level 1: 0-99 XP, Level 2: 100-199 XP, Level 3: 200-299 XP
export const calculateReputationLevel = (points: number): { level: number; badge: string } => {
  const level = Math.floor(points / 100) + 1;
  let badge = 'Campus Novice';
  if (level >= 15) badge = 'Campus Legend';
  else if (level >= 10) badge = 'Campus Star';
  else if (level >= 5) badge = 'Expert Helper';
  else if (level >= 2) badge = 'Active Contributor';
  return { level, badge };
};

// Daily max points allowed to prevent spam farming
const DAILY_MAX_XP = 150;

/**
 * Atomic transaction to award reputation points to a user.
 * Avoids duplicate rewards using the actionId index on reputationHistory subcollection.
 * Enforces daily maximum limits and handles level updates / badge achievements.
 */
export const awardReputation = async (
  userId: string,
  actionId: string,
  type: ReputationActionType,
  points: number,
  description: string
): Promise<void> => {
  if (!userId || !actionId) return;

  const userRef = doc(db, 'users', userId);
  const historyRef = doc(db, 'users', userId, 'reputationHistory', actionId);

  await runTransaction(db, async (transaction) => {
    // 1. Check if action has already been rewarded to prevent duplicate rewards
    const historySnap = await transaction.get(historyRef);
    if (historySnap.exists()) {
      return; // Already rewarded!
    }

    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    const currentPoints = userData.reputationPoints || 0;
    const currentBadges: string[] = userData.badges || ['Campus Novice'];

    // 2. Check Daily Limit
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastDailyDate = userData.reputationStats?.dailyDate || '';
    let dailyEarned = userData.reputationStats?.dailyEarned || 0;

    if (lastDailyDate !== todayStr) {
      dailyEarned = 0; // Reset daily limit for new day
    }

    if (dailyEarned >= DAILY_MAX_XP) {
      return; // Daily limit reached!
    }

    // Adjust points to fit daily cap if it would exceed
    const pointsAwarded = Math.min(points, DAILY_MAX_XP - dailyEarned);
    if (pointsAwarded <= 0) return;

    const nextPoints = currentPoints + pointsAwarded;
    const { level: nextLevel, badge: nextBadge } = calculateReputationLevel(nextPoints);

    // Update Badges array
    const updatedBadges = [...currentBadges];
    if (nextBadge && !updatedBadges.includes(nextBadge)) {
      updatedBadges.push(nextBadge);
    }

    // Weekly & Monthly calculations
    const currentWeekStr = getWeekIdentifier(new Date());
    const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM

    const lastWeeklyDate = userData.reputationStats?.weeklyDate || '';
    const lastMonthlyDate = userData.reputationStats?.monthlyDate || '';

    let currentWeeklyPoints = userData.weeklyPoints || 0;
    let currentMonthlyPoints = userData.monthlyPoints || 0;

    if (lastWeeklyDate !== currentWeekStr) {
      currentWeeklyPoints = 0;
    }
    if (lastMonthlyDate !== currentMonthStr) {
      currentMonthlyPoints = 0;
    }

    const nextWeeklyPoints = currentWeeklyPoints + pointsAwarded;
    const nextMonthlyPoints = currentMonthlyPoints + pointsAwarded;

    // Streak calculations
    let streakCount = userData.contributionStreak || 0;
    const lastActionTimestamp = userData.reputationStats?.lastActionAt;
    if (lastActionTimestamp) {
      const lastActionDate = new Date(lastActionTimestamp);
      const lastActionDayStr = lastActionDate.toISOString().split('T')[0];

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastActionDayStr === yesterdayStr) {
        streakCount += 1;
      } else if (lastActionDayStr !== todayStr) {
        streakCount = 1;
      }
    } else {
      streakCount = 1;
    }

    // Update user document
    transaction.update(userRef, {
      reputationPoints: nextPoints,
      weeklyPoints: nextWeeklyPoints,
      monthlyPoints: nextMonthlyPoints,
      level: nextLevel,
      badges: updatedBadges,
      contributionStreak: streakCount,
      // Update points field (gamification backward compatibility)
      points: (userData.points || 0) + pointsAwarded,
      reputationStats: {
        dailyDate: todayStr,
        dailyEarned: dailyEarned + pointsAwarded,
        weeklyDate: currentWeekStr,
        monthlyDate: currentMonthStr,
        lastActionAt: Date.now(),
      },
    });

    // Write audit trail into reputation history subcollection
    transaction.set(historyRef, {
      actionId,
      type,
      points: pointsAwarded,
      description,
      createdAt: serverTimestamp(),
    });
  });
};

function getWeekIdentifier(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${weekNo}`;
}

/**
 * Fetches contribution history logs for a user
 */
export const getUserReputationHistory = async (
  userId: string,
  limitCount: number = 20
): Promise<ReputationHistoryEntry[]> => {
  if (!userId) return [];
  try {
    const colRef = collection(db, 'users', userId, 'reputationHistory');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as ReputationHistoryEntry));
  } catch (err) {
    console.error('Failed to get reputation history:', err);
    return [];
  }
};
