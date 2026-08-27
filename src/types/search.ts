export type SearchCategory =
  | 'all'
  | 'people'
  | 'groups'
  | 'posts'
  | 'events'
  | 'lost_found'
  | 'marketplace'
  | 'opportunities';

export interface SearchResultItem {
  id: string;
  type: 'user' | 'group' | 'post' | 'event' | 'lost_found' | 'marketplace' | 'opportunity';
  title: string;
  subtitle?: string;
  description?: string;
  avatar?: string;
  imageUrl?: string;
  url: string;
  category?: string;
  score: number;
  createdAt?: any;
  meta?: Record<string, any>;
}

export interface SearchSuggestion {
  id: string;
  title: string;
  category: string;
  type: SearchResultItem['type'];
  url: string;
  subtitle?: string;
}

export interface UnifiedSearchResult {
  items: SearchResultItem[];
  suggestions: SearchSuggestion[];
  totalMatches: number;
  query: string;
}
