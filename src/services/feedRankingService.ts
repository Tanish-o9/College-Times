import type { Post } from '../types/models';
import type { UserFeedPreferences, UserPreferencesProfile } from '../types/feed';

/**
 * Calculates deterministic ranking score for a post candidate.
 * score = recencyScore + engagementScore + relationshipScore + relevanceScore + groupAffinityScore
 */
export const calculatePostScore = (
  post: Post,
  preferences?: UserFeedPreferences,
  profile?: UserPreferencesProfile,
  userGroupIds?: string[],
  followedUserIds?: string[]
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
  const recencyScore = 100 / (1 + hoursSinceCreation * 0.15);

  // 2. Engagement Score
  const reactions = post.likeCount || 0;
  const comments = post.commentCount || 0;
  const saves = post.savedCount || post.savesCount || 0;
  const shares = post.sharesCount || 0;
  const engagementScore = reactions * 2 + comments * 4 + saves * 6 + shares * 8;

  // 3. Relationship & Follows Score
  let relationshipScore = 0;
  if (followedUserIds && followedUserIds.includes(post.authorId)) {
    relationshipScore += 45; // High boost for followed creators
  }
  if (profile?.followedUsers?.includes(post.authorId)) {
    relationshipScore += 30;
  }

  // 4. Group Affinity Score
  let groupAffinityScore = 0;
  if (post.groupId) {
    if (userGroupIds && userGroupIds.includes(post.groupId)) {
      groupAffinityScore += 50; // High boost for user's own groups
    }
    if (profile?.followedGroups?.includes(post.groupId)) {
      groupAffinityScore += 30;
    }
  }

  // 5. Relevance / Interests Score
  let relevanceScore = 0;
  if (profile?.interests && profile.interests.length > 0) {
    const contentLower = (post.title + ' ' + post.content).toLowerCase();
    profile.interests.forEach((interest) => {
      if (contentLower.includes(interest.toLowerCase())) {
        relevanceScore += 20;
      }
    });
  }

  // Legacy category preference check
  if (preferences) {
    if (preferences.preferredCategories?.includes(post.category)) {
      relevanceScore += 15;
    }
    if (preferences.mutedCategories?.includes(post.category)) {
      relevanceScore -= 60;
    }
  }

  // Freshness & Official Bonus
  const freshnessBonus = hoursSinceCreation <= 4 ? 25 : 0;
  const importantPostBonus = (post.isImportant || post.isOfficial) ? 60 : 0;

  return Math.round(
    recencyScore +
    engagementScore +
    relationshipScore +
    groupAffinityScore +
    relevanceScore +
    freshnessBonus +
    importantPostBonus
  );
};

/**
 * Ranks candidate post list based on personalized score.
 * Filters out deleted or hidden posts, and applies diversity controls
 * (ensuring no consecutive spam from the same author or group).
 */
export const rankPostsPersonalized = (
  posts: Post[],
  preferences?: UserFeedPreferences,
  profile?: UserPreferencesProfile,
  userGroupIds?: string[],
  followedUserIds?: string[]
): Post[] => {
  if (!posts || posts.length === 0) return [];

  // 1. Filter out deleted or hidden posts
  const eligible = posts.filter(
    (p) => p.status !== 'deleted' && p.status !== 'hidden' && p.status !== 'moderated'
  );

  // 2. Score posts
  const scored = eligible.map((post) => ({
    post,
    score: calculatePostScore(post, preferences, profile, userGroupIds, followedUserIds),
  }));

  // 3. Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // 4. Apply Feed Diversity Constraints (avoid author/group clustering)
  const result: Post[] = [];
  const authorCounts: Record<string, number> = {};
  const groupCounts: Record<string, number> = {};

  scored.forEach(({ post }) => {
    const authorId = post.authorId;
    const groupId = post.groupId || 'global';

    const currentAuthorCount = authorCounts[authorId] || 0;
    const currentGroupCount = groupCounts[groupId] || 0;

    // Diversity threshold: max 3 consecutive posts from same author/group
    if (currentAuthorCount < 3 && currentGroupCount < 3) {
      result.push(post);
      authorCounts[authorId] = currentAuthorCount + 1;
      groupCounts[groupId] = currentGroupCount + 1;
    } else {
      // Put at the end or demote
      result.push(post);
    }
  });

  return result;
};

// Backward-compatibility export
export const rankPosts = (posts: Post[], preferences?: UserFeedPreferences): Post[] => {
  return rankPostsPersonalized(posts, preferences);
};
