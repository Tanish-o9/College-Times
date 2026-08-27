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
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('points', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      uid: docSnap.id,
      ...docSnap.data(),
    })) as User[];
  } catch (error) {
    console.error('Error fetching top users for leaderboard:', error);
    throw error;
  }
};

/**
 * Computes a user's leaderboard rank based on points using Firestore count aggregation.
 * Rank = (number of users with points > current user points) + 1.
 */
export const getUserRank = async (userPoints: number = 0): Promise<number> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('points', '>', userPoints));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count + 1;
  } catch (error) {
    console.error('Error calculating user rank:', error);
    return 1;
  }
};
