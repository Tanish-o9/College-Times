export type SearchCategory =
  | 'all'
  | 'people'
  | 'groups'
  | 'posts'
  | 'events'
  | 'lost_found'
  | 'marketplace'
  | 'opportunities'
  | 'resources'
  | 'academics';

export interface SearchFilterState {
  department?: string;
  batch?: string;
  groupPrivacy?: 'all' | 'public' | 'private';
  eventTimeframe?: 'all' | 'upcoming' | 'past';
  marketplaceCategory?: string;
  priceRange?: 'all' | 'under500' | '500to2000' | 'above2000';
  opportunityType?: string;
  resourceCategory?: string;
}

export interface SearchResultItem {
  id: string;
  type: 'user' | 'group' | 'post' | 'event' | 'lost_found' | 'marketplace' | 'opportunity' | 'resource' | 'academic';
  title: string;
  subtitle?: string;
  description?: string;
  avatar?: string;
  imageUrl?: string;
  url: string;
  category?: string;
  score: number;
  createdAt?: any;
  meta?: {
    department?: string;
    batch?: string;
    price?: number;
    location?: string;
    organization?: string;
    likeCount?: number;
    commentCount?: number;
    memberCount?: number;
    status?: string;
    tags?: string[];
    isPrivate?: boolean;
    type?: string;
    date?: any;
    sellerName?: string;
    authorName?: string;
  };
}

export interface SearchSuggestion {
  id: string;
  title: string;
  category: string;
  type: SearchResultItem['type'];
  url: string;
  subtitle?: string;
}

export interface SearchError {
  category: SearchCategory;
  message: string;
}

export interface UnifiedSearchResult {
  items: SearchResultItem[];
  suggestions: SearchSuggestion[];
  totalMatches: number;
  query: string;
  errors?: SearchError[];
}
