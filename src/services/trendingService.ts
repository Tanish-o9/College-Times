import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Post } from '../types/models';

/**
 * Calculates trending score for candidate posts using time-decayed engagement.
 */
export const calculateTrendingScore = (post: Post): number => {
  let postTimeMs = Date.now();
  if (post.timestamp) {
    if (typeof post.timestamp.toMillis === 'function') {
      postTimeMs = post.timestamp.toMillis();
    } else if (post.timestamp instanceof Date) {
      postTimeMs = post.timestamp.getTime();
    } else if (typeof post.timestamp === 'number') {
      postTimeMs = post.timestamp;
    }
  }

  const hoursSinceCreation = Math.max(0, (Date.now() - postTimeMs) / (1000 * 60 * 60));

  const likes = post.likeCount || 0;
  const comments = post.commentCount || 0;
  const saves = post.savedCount || 0;
  const shares = post.sharesCount || 0;
  const rawEngagement = likes * 1 + comments * 3 + saves * 4 + shares * 5;

  // Recency decay formula
  const score = rawEngagement / (1 + hoursSinceCreation * 0.3);
  return Math.round(score * 10) / 10;
};

/**
 * Fetches top trending posts on campus from candidate pool (limit: 30).
 */
export const getTrendingPosts = async (limitCount: number = 5): Promise<Post[]> => {
  try {
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('status', '==', 'active'),
      orderBy('timestamp', 'desc'),
      limit(30)
    );

    const snapshot = await getDocs(q);
    const candidatePosts = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Post),
    }));

    // Rank candidates by time-decayed trending score
    const scored = candidatePosts
      .map((p) => ({
        ...p,
        trendingScore: calculateTrendingScore(p),
      }))
      .sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));

    return scored.slice(0, limitCount);
  } catch (error) {
    console.error('Error fetching trending posts:', error);
    return [];
  }
};
