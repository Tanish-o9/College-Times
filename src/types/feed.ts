export type FeedMode = 'latest' | 'trending' | 'personalized' | 'events' | 'lost_found' | 'important';

export interface UserFeedPreferences {
  preferredCategories: string[];
  mutedCategories: string[];
  updatedAt?: any;
}

export const DEFAULT_USER_FEED_PREFERENCES: UserFeedPreferences = {
  preferredCategories: ['General', 'Event', 'LostFound'],
  mutedCategories: [],
};
