export type FeedMode = 'latest' | 'trending' | 'personalized' | 'events' | 'lost_found' | 'important' | 'following' | 'groups' | 'saved';

export interface UserFeedPreferences {
  preferredCategories: string[];
  mutedCategories: string[];
  updatedAt?: any;
}

export const DEFAULT_USER_FEED_PREFERENCES: UserFeedPreferences = {
  preferredCategories: ['General', 'Event', 'LostFound'],
  mutedCategories: [],
};

export interface PostReference {
  type: 'group' | 'event' | 'opportunity' | 'marketplace';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
}

export interface UserPreferencesProfile {
  interests: string[];
  followedGroups: string[];
  followedUsers: string[];
  recentSearches: string[];
  savedContent: string[];
  interactedCategories: Record<string, number>;
}

export const DEFAULT_USER_PREFERENCES_PROFILE: UserPreferencesProfile = {
  interests: [],
  followedGroups: [],
  followedUsers: [],
  recentSearches: [],
  savedContent: [],
  interactedCategories: {},
};
