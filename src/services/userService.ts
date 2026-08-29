import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  where, 
  getCountFromServer 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { User } from '../types';

/**
 * Fetches the top ranked users ordered by gamification points descending.
 */
export const getTopUsers = async (limitCount: number = 10): Promise<User[]> => {
  return getTopUsersByTimeframe('all_time', limitCount);
};

export const getTopUsersByTimeframe = async (
  timeframe: 'all_time' | 'weekly' | 'monthly',
  limitCount: number = 10
): Promise<User[]> => {
  try {
    const usersRef = collection(db, 'users');
    let orderField = 'points';
    if (timeframe === 'weekly') orderField = 'weeklyPoints';
    else if (timeframe === 'monthly') orderField = 'monthlyPoints';

    const q = query(usersRef, orderBy(orderField, 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      uid: docSnap.id,
      ...docSnap.data(),
    })) as User[];
  } catch (error) {
    console.error(`Error fetching top users for ${timeframe} leaderboard:`, error);
    throw error;
  }
};

/**
 * Computes a user's leaderboard rank based on points using Firestore count aggregation.
 */
export const getUserRank = async (userPoints: number = 0): Promise<number> => {
  return getUserRankByTimeframe('all_time', userPoints);
};

export const getUserRankByTimeframe = async (
  timeframe: 'all_time' | 'weekly' | 'monthly',
  userPoints: number = 0
): Promise<number> => {
  try {
    const usersRef = collection(db, 'users');
    let targetField = 'points';
    if (timeframe === 'weekly') targetField = 'weeklyPoints';
    else if (timeframe === 'monthly') targetField = 'monthlyPoints';

    const q = query(usersRef, where(targetField, '>', userPoints));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count + 1;
  } catch (error) {
    console.error(`Error calculating user ${timeframe} rank:`, error);
    return 1;
  }
};
