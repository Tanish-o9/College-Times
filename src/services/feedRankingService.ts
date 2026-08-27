import type { Post } from '../types/models';
import type { UserFeedPreferences } from '../types/feed';

/**
 * Calculates deterministic ranking score for a post candidate.
 * Formula: score = recencyScore + engagementScore + categoryPreferenceScore + freshnessBonus + importantPostBonus
 */
export const calculatePostScore = (
  post: Post,
  preferences?: UserFeedPreferences
): number => {
  // Convert Firestore Timestamp / Date into milliseconds
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

  // 1. Recency Score (Decays with hours)
  const recencyScore = 100 / (1 + hoursSinceCreation * 0.2);

  // 2. Engagement Score
  const likes = post.likeCount || 0;
  const comments = post.commentCount || 0;
  const saves = post.savedCount || 0;
  const shares = post.sharesCount || 0;
  const engagementScore = likes * 1 + comments * 3 + saves * 4 + shares * 5;

  // 3. Category Preference Score
  let categoryPreferenceScore = 0;
  if (preferences) {
    if (preferences.preferredCategories.includes(post.category)) {
      categoryPreferenceScore += 30;
    }
    if (preferences.mutedCategories.includes(post.category)) {
      categoryPreferenceScore -= 50;
    }
  }

  // 4. Freshness Bonus (+20 if under 6 hours old)
  const freshnessBonus = hoursSinceCreation <= 6 ? 20 : 0;

  // 5. Important / Official Post Bonus (+50)
  const importantPostBonus = (post.isImportant || post.isOfficial) ? 50 : 0;

  return Math.round(recencyScore + engagementScore + categoryPreferenceScore + freshnessBonus + importantPostBonus);
};

/**
 * Ranks candidate post list deterministically based on formula scores.
 * Excludes deleted or hidden posts.
 */
export const rankPosts = (
  posts: Post[],
  preferences?: UserFeedPreferences
): Post[] => {
  if (!posts || posts.length === 0) return [];

  // Filter eligible active posts
  const eligible = posts.filter(
    (p) => p.status !== 'deleted' && p.status !== 'hidden'
  );

  // Score and sort descending
  return eligible
    .map((post) => ({
      post,
      score: calculatePostScore(post, preferences),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => ({
      ...item.post,
      trendingScore: item.score,
    }));
};
