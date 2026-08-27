import { collection, query as fsQuery, where, limit as fsLimit, getDocs } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { SearchCategory, SearchResultItem, SearchSuggestion, UnifiedSearchResult } from '../types/search';
import { searchGroups } from './groupService';
import type { Post, CampusEvent } from '../types/models';
import type { MarketplaceListing } from '../types/marketplace';
import type { Opportunity } from '../types/opportunity';

const SEARCH_CACHE = new Map<string, UnifiedSearchResult>();
const MAX_CACHE_ENTRIES = 50;
const RECENT_SEARCHES_KEY = 'ct_recent_searches_v1';

export const getRecentSearches = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
};

export const saveRecentSearch = (queryStr: string): void => {
  const clean = queryStr.trim();
  if (!clean || clean.length < 2) return;

  try {
    const existing = getRecentSearches();
    const filtered = existing.filter((q) => q.toLowerCase() !== clean.toLowerCase());
    const updated = [clean, ...filtered].slice(0, 10);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {}
};

export const removeRecentSearch = (queryStr: string): void => {
  try {
    const existing = getRecentSearches();
    const updated = existing.filter((q) => q.toLowerCase() !== queryStr.toLowerCase());
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {}
};

export const clearRecentSearches = (): void => {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {}
};

/**
 * Ranks search results deterministically based on match precision and recency.
 */
const calculateResultScore = (title: string = '', text: string = '', queryLower: string): number => {
  let score = 0;
  const tLower = title.toLowerCase();
  const descLower = text.toLowerCase();

  if (tLower === queryLower) score += 50; // Exact title match
  else if (tLower.startsWith(queryLower)) score += 40; // Title prefix match
  else if (tLower.includes(queryLower)) score += 30; // Title substring match

  if (descLower.includes(queryLower)) score += 20; // Description substring match

  return score;
};

/**
 * Primary Unified Campus Search Service.
 */
export const searchUnifiedCampus = async (
  queryStr: string,
  category: SearchCategory = 'all',
  limitCount: number = 10,
  _currentUser?: FirebaseUser | null
): Promise<UnifiedSearchResult> => {
  const cleanQuery = queryStr.trim().toLowerCase();

  if (!cleanQuery || cleanQuery.length < 2) {
    return { items: [], suggestions: [], totalMatches: 0, query: queryStr };
  }

  const cacheKey = `${category}:${limitCount}:${cleanQuery}`;
  if (SEARCH_CACHE.has(cacheKey)) {
    return SEARCH_CACHE.get(cacheKey)!;
  }

  const searchResults: SearchResultItem[] = [];

  try {
    // 1. Search People (Users)
    if (category === 'all' || category === 'people') {
      try {
        const usersRef = collection(db, 'users');
        const q = fsQuery(usersRef, fsLimit(20));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const name = data.displayName || data.username || 'Campus User';
          const dept = data.department || '';
          const batch = data.batch ? `Batch ${data.batch}` : '';
          const bio = data.bio || '';
          const textToMatch = `${name} ${dept} ${batch} ${bio}`.toLowerCase();

          if (textToMatch.includes(cleanQuery)) {
            const score = calculateResultScore(name, `${dept} ${batch}`, cleanQuery);
            searchResults.push({
              id: docSnap.id,
              type: 'user',
              title: name,
              subtitle: [dept, batch].filter(Boolean).join(' • ') || 'AKGEC Student',
              avatar: data.photoURL,
              url: `/profile/${docSnap.id}`,
              category: 'People',
              score,
            });
          }
        });
      } catch (e) {
        console.error('Error searching people:', e);
      }
    }

    // 2. Search Groups
    if (category === 'all' || category === 'groups') {
      try {
        const groups = await searchGroups(cleanQuery, 'all', 20);
        groups.forEach((g) => {
          const score = calculateResultScore(g.name, g.description, cleanQuery);
          searchResults.push({
            id: g.id,
            type: 'group',
            title: g.name,
            subtitle: `${g.type} • ${g.visibility} • ${g.memberCount} members`,
            description: g.description,
            avatar: g.iconUrl,
            url: `/groups/${g.id}`,
            category: 'Groups',
            score,
          });
        });
      } catch (e) {
        console.error('Error searching groups:', e);
      }
    }

    // 3. Search Campus Feed Posts
    if (category === 'all' || category === 'posts') {
      try {
        const postsRef = collection(db, 'posts');
        const q = fsQuery(postsRef, where('status', '==', 'active'), fsLimit(25));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const post = docSnap.data() as Post;
          if (post.groupId) return; // Skip private group posts in global search

          const title = post.title || post.content.slice(0, 50);
          const content = post.content || '';
          const textMatch = `${title} ${content}`.toLowerCase();

          if (textMatch.includes(cleanQuery)) {
            const score = calculateResultScore(title, content, cleanQuery);
            searchResults.push({
              id: docSnap.id!,
              type: 'post',
              title,
              subtitle: `By ${post.authorName || 'Student'} • ${post.category || 'Feed'}`,
              description: content.slice(0, 120),
              imageUrl: post.imageUrl || post.images?.[0]?.downloadUrl,
              url: `/?postId=${docSnap.id}`,
              category: 'Posts',
              score,
            });
          }
        });
      } catch (e) {
        console.error('Error searching posts:', e);
      }
    }

    // 4. Search Events
    if (category === 'all' || category === 'events') {
      try {
        const eventsRef = collection(db, 'events');
        const q = fsQuery(eventsRef, fsLimit(20));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const event = docSnap.data() as CampusEvent;
          const organizer = event.organizerName || 'Campus';
          const textMatch = `${event.title} ${event.description || ''} ${organizer}`.toLowerCase();

          if (textMatch.includes(cleanQuery)) {
            const score = calculateResultScore(event.title, event.description, cleanQuery);
            searchResults.push({
              id: docSnap.id,
              type: 'event',
              title: event.title,
              subtitle: `Organizer: ${organizer} • ${event.category || 'Event'}`,
              description: event.description?.slice(0, 120),
              url: `/events/${docSnap.id}`,
              category: 'Events',
              score,
            });
          }
        });
      } catch (e) {
        console.error('Error searching events:', e);
      }
    }

    // 5. Search Lost & Found Items
    if (category === 'all' || category === 'lost_found') {
      try {
        const itemsRef = collection(db, 'lostFoundItems');
        const q = fsQuery(itemsRef, fsLimit(20));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const title = data.title || '';
          const description = data.description || '';
          const cat = data.category || 'Item';
          const location = data.location || '';
          const textMatch = `${title} ${description} ${cat}`.toLowerCase();

          if (textMatch.includes(cleanQuery)) {
            const score = calculateResultScore(title, description, cleanQuery);
            searchResults.push({
              id: docSnap.id,
              type: 'lost_found',
              title,
              subtitle: `${cat} • ${location}`,
              description: description.slice(0, 120),
              imageUrl: data.imageUrl || data.images?.[0],
              url: `/lost-found`,
              category: 'Lost & Found',
              score,
            });
          }
        });
      } catch (e) {
        console.error('Error searching lost & found:', e);
      }
    }

    // 6. Search Marketplace Listings
    if (category === 'all' || category === 'marketplace') {
      try {
        const itemsRef = collection(db, 'marketplaceItems');
        const q = fsQuery(itemsRef, fsLimit(20));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const item = docSnap.data() as MarketplaceListing;
          const textMatch = `${item.title} ${item.description || ''} ${item.category || ''}`.toLowerCase();

          if (textMatch.includes(cleanQuery)) {
            const score = calculateResultScore(item.title, item.description, cleanQuery);
            searchResults.push({
              id: docSnap.id,
              type: 'marketplace',
              title: item.title,
              subtitle: `₹${item.price} • ${item.category} • Seller: ${item.sellerName || 'Student'}`,
              description: item.description?.slice(0, 120),
              imageUrl: item.images?.[0],
              url: `/marketplace`,
              category: 'Marketplace',
              score,
            });
          }
        });
      } catch (e) {
        console.error('Error searching marketplace:', e);
      }
    }

    // 7. Search Opportunities
    if (category === 'all' || category === 'opportunities') {
      try {
        const oppsRef = collection(db, 'opportunities');
        const q = fsQuery(oppsRef, fsLimit(20));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const opp = docSnap.data() as Opportunity;
          const textMatch = `${opp.title} ${opp.organizationName || ''} ${opp.description || ''}`.toLowerCase();

          if (textMatch.includes(cleanQuery)) {
            const score = calculateResultScore(opp.title, opp.description, cleanQuery);
            searchResults.push({
              id: docSnap.id,
              type: 'opportunity',
              title: opp.title,
              subtitle: `${opp.organizationName} • ${opp.type || 'Opportunity'}`,
              description: opp.description?.slice(0, 120),
              url: `/opportunities`,
              category: 'Opportunities',
              score,
            });
          }
        });
      } catch (e) {
        console.error('Error searching opportunities:', e);
      }
    }

    // Sort by deterministic score desc
    searchResults.sort((a, b) => b.score - a.score);

    const boundedItems = searchResults.slice(0, limitCount);

    // Build suggestions popover items (top 10)
    const suggestions: SearchSuggestion[] = searchResults.slice(0, 10).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category || 'Campus',
      type: item.type,
      url: item.url,
      subtitle: item.subtitle,
    }));

    const resultPayload: UnifiedSearchResult = {
      items: boundedItems,
      suggestions,
      totalMatches: searchResults.length,
      query: queryStr,
    };

    // Cache result
    if (SEARCH_CACHE.size >= MAX_CACHE_ENTRIES) {
      const firstKey = SEARCH_CACHE.keys().next().value;
      if (firstKey) SEARCH_CACHE.delete(firstKey);
    }
    SEARCH_CACHE.set(cacheKey, resultPayload);

    logAnalyticsEvent('search_submitted', { category, resultsCount: searchResults.length });

    return resultPayload;
  } catch (err) {
    console.error('Unified search error:', err);
    return { items: [], suggestions: [], totalMatches: 0, query: queryStr };
  }
};
