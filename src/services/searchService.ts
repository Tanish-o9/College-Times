import { collection, query as fsQuery, where, limit as fsLimit, getDocs, collectionGroup } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type {
  SearchCategory,
  SearchResultItem,
  SearchSuggestion,
  UnifiedSearchResult,
  SearchError,
} from '../types/search';
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

const getBlockedUserIds = async (uid: string): Promise<string[]> => {
  if (!uid) return [];
  try {
    const colRef = collection(db, 'users', uid, 'blockedUsers');
    const snap = await getDocs(colRef);
    return snap.docs.map((docSnap) => docSnap.id);
  } catch {
    return [];
  }
};

export const calculateResultScore = (
  title: string = '',
  description: string = '',
  queryLower: string,
  extraMeta: string = ''
): number => {
  let score = 0;
  const tLower = title.toLowerCase().trim();
  const dLower = description.toLowerCase().trim();
  const mLower = extraMeta.toLowerCase().trim();
  const qClean = queryLower.toLowerCase().trim();

  if (!qClean) return 0;

  if (tLower === qClean) {
    score += 100;
  } else if (tLower.startsWith(qClean)) {
    score += 80;
  } else if (tLower.includes(qClean)) {
    score += 60;
  }

  const queryTokens = qClean.split(/\s+/).filter((t) => t.length > 0);
  if (queryTokens.length > 1) {
    const matchedTitleTokens = queryTokens.filter((token) => tLower.includes(token));
    if (matchedTitleTokens.length === queryTokens.length) {
      score += 55;
    } else {
      score += matchedTitleTokens.length * 15;
    }

    const matchedDescTokens = queryTokens.filter((token) => dLower.includes(token));
    if (matchedDescTokens.length === queryTokens.length) {
      score += 25;
    } else {
      score += matchedDescTokens.length * 8;
    }
  }

  if (mLower.includes(qClean)) {
    score += 35;
  }

  if (dLower.includes(qClean)) {
    score += 20;
  }

  return score;
};

export const fetchTrendingCampusTopics = async (): Promise<string[]> => {
  const fallbackTrends = ['Hackathon', 'Freshers', 'Placement', 'Robotics', 'CSE', 'Sports', 'AI Workshop', 'Coding Club'];
  try {
    const topicsMap = new Map<string, number>();

    const eventsRef = collection(db, 'events');
    const eventsSnap = await getDocs(fsQuery(eventsRef, fsLimit(15)));
    eventsSnap.docs.forEach((d) => {
      const data = d.data() as any;
      if (data.category) topicsMap.set(data.category, (topicsMap.get(data.category) || 0) + 3);
      if (data.tags && Array.isArray(data.tags)) {
        data.tags.forEach((tag: string) => topicsMap.set(tag, (topicsMap.get(tag) || 0) + 2));
      }
    });

    const oppsRef = collection(db, 'opportunities');
    const oppsSnap = await getDocs(fsQuery(oppsRef, fsLimit(15)));
    oppsSnap.docs.forEach((d) => {
      const data = d.data() as any;
      if (data.type) topicsMap.set(data.type, (topicsMap.get(data.type) || 0) + 2);
    });

    const postsRef = collection(db, 'posts');
    const postsSnap = await getDocs(fsQuery(postsRef, where('status', '==', 'active'), fsLimit(20)));
    postsSnap.docs.forEach((d) => {
      const data = d.data() as any;
      if (data.category) topicsMap.set(data.category, (topicsMap.get(data.category) || 0) + 2);
      if (data.tags && Array.isArray(data.tags)) {
        data.tags.forEach((tag: string) => topicsMap.set(tag, (topicsMap.get(tag) || 0) + 2));
      }
    });

    const sorted = Array.from(topicsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([term]) => term)
      .filter((term) => term.length >= 3 && !['General', 'Other', 'active'].includes(term));

    const combined = Array.from(new Set([...sorted, ...fallbackTrends])).slice(0, 8);
    return combined;
  } catch (e) {
    console.error('Error computing dynamic trending topics:', e);
    return fallbackTrends;
  }
};

export const searchUnifiedCampus = async (
  queryStr: string,
  category: SearchCategory = 'all',
  limitCount: number = 30,
  currentUser?: FirebaseUser | null,
  joinedGroupIds: string[] = []
): Promise<UnifiedSearchResult> => {
  const cleanQuery = queryStr.trim().toLowerCase();

  if (!cleanQuery || cleanQuery.length < 2) {
    return { items: [], suggestions: [], totalMatches: 0, query: queryStr, errors: [] };
  }

  const cacheKey = `${category}:${limitCount}:${cleanQuery}:${currentUser?.uid || 'anon'}:${joinedGroupIds.sort().join(',')}`;
  if (SEARCH_CACHE.has(cacheKey)) {
    return SEARCH_CACHE.get(cacheKey)!;
  }

  const searchResults: SearchResultItem[] = [];
  const errors: SearchError[] = [];
  const blockedUserIds = currentUser ? await getBlockedUserIds(currentUser.uid) : [];

  const tasks: { category: SearchCategory; run: () => Promise<void> }[] = [];

  // 1. Search People
  if (category === 'all' || category === 'people') {
    tasks.push({
      category: 'people',
      run: async () => {
        const usersRef = collection(db, 'users');
        const q = fsQuery(usersRef, fsLimit(50));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          if (blockedUserIds.includes(docSnap.id)) return;

          const data = docSnap.data() as any;
          const name = data.displayName || data.username || 'Campus Student';
          const dept = data.department || data.departmentId || '';
          const batch = data.batchYear ? `Batch ${data.batchYear}` : data.batch ? `Batch ${data.batch}` : '';
          const bio = data.bio || '';
          const interests = Array.isArray(data.interests) ? data.interests.join(' ') : '';
          const skills = Array.isArray(data.skills) ? data.skills.join(' ') : '';
          const metaText = `${dept} ${batch} ${interests} ${skills} ${data.username || ''}`;
          const fullText = `${name} ${metaText} ${bio}`.toLowerCase();

          if (fullText.includes(cleanQuery)) {
            const score = calculateResultScore(name, bio, cleanQuery, metaText);
            searchResults.push({
              id: docSnap.id,
              type: 'user',
              title: name,
              subtitle: [data.username ? `@${data.username}` : null, dept, batch].filter(Boolean).join(' • ') || 'AKGEC Student',
              description: bio || (interests ? `Interests: ${interests}` : undefined),
              avatar: data.photoURL,
              url: `/profile/${docSnap.id}`,
              category: 'People',
              score,
              meta: {
                department: dept,
                batch: data.batchYear || data.batch,
              },
            });
          }
        });
      },
    });
  }

  // 2. Search Groups
  if (category === 'all' || category === 'groups') {
    tasks.push({
      category: 'groups',
      run: async () => {
        const groups = await searchGroups(cleanQuery, 'all', 40);
        groups.forEach((g: any) => {
          if (g.createdBy && blockedUserIds.includes(g.createdBy)) return;

          const catName = g.category || g.type || 'community';
          const dept = g.departmentId || g.department || '';
          const tagsStr = g.tags ? g.tags.join(' ') : '';
          const metaText = `${catName} ${dept} ${g.batch || ''} ${tagsStr}`;
          const score = calculateResultScore(g.name, g.description || '', cleanQuery, metaText);
          const isPrivate = g.visibility === 'private';

          searchResults.push({
            id: g.id,
            type: 'group',
            title: g.name,
            subtitle: `${catName.toUpperCase()} • ${isPrivate ? 'Private Group' : 'Public Group'} • ${g.memberCount || 1} Members`,
            description: g.description?.slice(0, 140),
            imageUrl: g.iconUrl,
            url: `/groups/${g.id}`,
            category: 'Groups',
            score,
            meta: {
              memberCount: g.memberCount,
              isPrivate,
              department: dept,
              tags: g.tags,
            },
          });
        });
      },
    });
  }

  // 3. Search Feed Posts
  if (category === 'all' || category === 'posts') {
    tasks.push({
      category: 'posts',
      run: async () => {
        const postsRef = collection(db, 'posts');
        const q = fsQuery(postsRef, where('status', '==', 'active'), fsLimit(50));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const post = docSnap.data() as Post;
          const postRaw = post as any;
          if (post.groupId && !joinedGroupIds.includes(post.groupId)) return;
          if (post.authorId && blockedUserIds.includes(post.authorId)) return;

          const tagsStr = postRaw.tags ? postRaw.tags.join(' ') : '';
          const metaText = `${post.category || ''} ${tagsStr} ${post.authorName || ''}`;
          const textMatch = `${post.title || ''} ${post.content || ''} ${metaText}`.toLowerCase();

          if (textMatch.includes(cleanQuery)) {
            const score = calculateResultScore(post.title || 'Campus Post', post.content || '', cleanQuery, metaText);
            searchResults.push({
              id: docSnap.id,
              type: 'post',
              title: post.title || (post.content ? post.content.slice(0, 50) + '...' : 'Campus Post'),
              subtitle: `By ${post.authorName || 'Student'} • ${post.category || 'Feed'}`,
              description: post.content?.slice(0, 140),
              imageUrl: post.imageUrl,
              url: `/posts/${docSnap.id}`,
              category: 'Feed Posts',
              score,
              createdAt: post.timestamp,
              meta: {
                authorName: post.authorName,
                likeCount: post.likeCount || 0,
                commentCount: post.commentCount || 0,
                tags: postRaw.tags,
              },
            });
          }
        });
      },
    });
  }

  // 4. Search Events
  if (category === 'all' || category === 'events') {
    tasks.push({
      category: 'events',
      run: async () => {
        const eventsRef = collection(db, 'events');
        const q = fsQuery(eventsRef, fsLimit(40));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const event = docSnap.data() as CampusEvent;
          const eventRaw = event as any;
          if (event.createdBy && blockedUserIds.includes(event.createdBy)) return;

          if (
            (event.visibility === 'group' || event.groupId) &&
            event.visibility !== 'campus' &&
            (event.visibility as any) !== 'public' &&
            event.groupId &&
            !joinedGroupIds.includes(event.groupId) &&
            event.createdBy !== currentUser?.uid
          ) {
            return;
          }

          const tagsStr = eventRaw.tags ? eventRaw.tags.join(' ') : '';
          const metaText = `${event.category} ${event.location || ''} ${tagsStr} ${event.groupName || ''}`;
          const textMatch = `${event.title} ${event.description || ''} ${metaText}`.toLowerCase();

          if (textMatch.includes(cleanQuery)) {
            const score = calculateResultScore(event.title, event.description || '', cleanQuery, metaText);
            const dateDisplay = event.eventDate ? 'Scheduled' : 'Upcoming';
            searchResults.push({
              id: docSnap.id,
              type: 'event',
              title: event.title,
              subtitle: `${event.category || 'Event'} • ${event.location || 'AKGEC Campus'} • ${dateDisplay}`,
              description: event.description?.slice(0, 140),
              url: `/events/${docSnap.id}`,
              category: 'Events',
              score,
              meta: {
                location: event.location,
                date: event.eventDate,
                isPrivate: event.visibility === 'group',
              },
            });
          }
        });
      },
    });
  }

  // 5. Search Lost & Found
  if (category === 'all' || category === 'lost_found') {
    tasks.push({
      category: 'lost_found',
      run: async () => {
        const itemsRef = collection(db, 'lostFoundItems');
        const q = fsQuery(itemsRef, fsLimit(30));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.createdBy && blockedUserIds.includes(data.createdBy)) return;

          const metaText = `${data.type || ''} ${data.location || ''} ${data.category || ''}`;
          const textMatch = `${data.title || ''} ${data.description || ''} ${metaText}`.toLowerCase();

          if (textMatch.includes(cleanQuery)) {
            const score = calculateResultScore(data.title || 'Lost & Found Item', data.description || '', cleanQuery, metaText);
            searchResults.push({
              id: docSnap.id,
              type: 'lost_found',
              title: data.title || 'Lost & Found Record',
              subtitle: `${(data.type || 'ITEM').toUpperCase()} • Location: ${data.location || 'Campus'}`,
              description: data.description?.slice(0, 140),
              imageUrl: data.mediaUrls?.[0],
              url: `/lost-found`,
              category: 'Lost & Found',
              score,
              meta: {
                location: data.location,
                status: data.type,
              },
            });
          }
        });
      },
    });
  }

  // 6. Search Marketplace Listings
  if (category === 'all' || category === 'marketplace') {
    tasks.push({
      category: 'marketplace',
      run: async () => {
        const itemsRef = collection(db, 'marketplaceListings');
        const q = fsQuery(itemsRef, fsLimit(40));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const item = docSnap.data() as MarketplaceListing;
          if (item.sellerId && blockedUserIds.includes(item.sellerId)) return;
          if ((item.status as string) === 'sold' || (item.status as string) === 'deleted') return;

          const metaText = `${item.category} ${item.condition} ${item.sellerName || ''}`;
          const textMatch = `${item.title} ${item.description || ''} ${metaText}`.toLowerCase();

          if (textMatch.includes(cleanQuery)) {
            const score = calculateResultScore(item.title, item.description || '', cleanQuery, metaText);
            searchResults.push({
              id: docSnap.id,
              type: 'marketplace',
              title: item.title,
              subtitle: `₹${item.price} • ${item.category} • Condition: ${item.condition} • Seller: ${item.sellerName || 'Student'}`,
              description: item.description?.slice(0, 140),
              imageUrl: item.images?.[0],
              url: `/marketplace/${docSnap.id}`,
              category: 'Marketplace',
              score,
              meta: {
                price: item.price,
                sellerName: item.sellerName,
                status: item.status,
              },
            });
          }
        });
      },
    });
  }

  // 7. Search Opportunities
  if (category === 'all' || category === 'opportunities') {
    tasks.push({
      category: 'opportunities',
      run: async () => {
        const oppsRef = collection(db, 'opportunities');
        const q = fsQuery(oppsRef, fsLimit(40));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const opp = docSnap.data() as Opportunity;
          const oppRaw = opp as any;
          if (opp.createdBy && blockedUserIds.includes(opp.createdBy)) return;

          const skillsStr = opp.skills ? opp.skills.join(' ') : oppRaw.skillsRequired ? oppRaw.skillsRequired.join(' ') : '';
          const metaText = `${opp.organizationName} ${opp.type || ''} ${opp.category || ''} ${skillsStr}`;
          const textMatch = `${opp.title} ${opp.description || ''} ${metaText}`.toLowerCase();

          if (textMatch.includes(cleanQuery)) {
            const score = calculateResultScore(opp.title, opp.description || '', cleanQuery, metaText);
            searchResults.push({
              id: docSnap.id,
              type: 'opportunity',
              title: opp.title,
              subtitle: `${opp.organizationName} • ${opp.type || 'Opportunity'} • Deadline: ${opp.deadline || 'Open'}`,
              description: opp.description?.slice(0, 140),
              url: `/opportunities`,
              category: 'Opportunities',
              score,
              meta: {
                organization: opp.organizationName,
                type: opp.type,
              },
            });
          }
        });
      },
    });
  }

  // 8. Search Group Resources
  if (category === 'all' || category === 'resources') {
    tasks.push({
      category: 'resources',
      run: async () => {
        const resourcesRef = collectionGroup(db, 'resources');
        const q = fsQuery(resourcesRef, fsLimit(30));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const res = docSnap.data();
          if (res.createdBy && blockedUserIds.includes(res.createdBy)) return;
          if (res.groupId && !joinedGroupIds.includes(res.groupId)) return;

          const metaText = `${res.creatorName || ''} ${res.category || ''}`;
          const textMatch = `${res.title} ${res.description || ''} ${metaText}`.toLowerCase();

          if (textMatch.includes(cleanQuery)) {
            const score = calculateResultScore(res.title, res.description || '', cleanQuery, metaText);
            searchResults.push({
              id: docSnap.id,
              type: 'resource',
              title: res.title,
              subtitle: `Resource • Shared by ${res.creatorName || 'Student'}`,
              description: res.description?.slice(0, 140),
              url: `/groups/${res.groupId}`,
              category: 'Resources',
              score,
            });
          }
        });
      },
    });
  }

  // 9. Search Public Academic Subjects
  if (category === 'all' || category === 'academics') {
    tasks.push({
      category: 'academics',
      run: async () => {
        const subjectsRef = collection(db, 'subjects');
        const snap = await getDocs(fsQuery(subjectsRef, fsLimit(30)));

        snap.docs.forEach((docSnap) => {
          const sub = docSnap.data() as any;
          const metaText = `${sub.code || ''} ${sub.department || ''} ${sub.semester ? `Sem ${sub.semester}` : ''} ${sub.batch || ''}`;
          const textMatch = `${sub.name || ''} ${metaText}`.toLowerCase();

          if (textMatch.includes(cleanQuery)) {
            const score = calculateResultScore(sub.name || 'Subject', `${sub.department} ${sub.code}`, cleanQuery, metaText);
            searchResults.push({
              id: docSnap.id,
              type: 'academic',
              title: sub.name || 'Academic Subject',
              subtitle: `${sub.code ? `${sub.code} • ` : ''}${sub.department || 'Academic Hub'} ${sub.semester ? `(Sem ${sub.semester})` : ''}`,
              description: `Batch: ${sub.batch || 'All'} • Access course details and shared notes on Academics Hub.`,
              url: `/academics`,
              category: 'Academics',
              score,
              meta: {
                department: sub.department,
                batch: sub.batch,
              },
            });
          }
        });
      },
    });
  }

  const resultsSettled = await Promise.allSettled(tasks.map((t) => t.run()));

  resultsSettled.forEach((res, idx) => {
    if (res.status === 'rejected') {
      const taskCategory = tasks[idx].category;
      console.error(`Search error in category '${taskCategory}':`, res.reason);
      errors.push({
        category: taskCategory,
        message: res.reason?.message || `Failed to query ${taskCategory}`,
      });
    }
  });

  searchResults.sort((a, b) => b.score - a.score);

  const boundedItems = searchResults.slice(0, limitCount);

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
    errors,
  };

  if (SEARCH_CACHE.size >= MAX_CACHE_ENTRIES) {
    const firstKey = SEARCH_CACHE.keys().next().value;
    if (firstKey) SEARCH_CACHE.delete(firstKey);
  }
  SEARCH_CACHE.set(cacheKey, resultPayload);

  logAnalyticsEvent('search_submitted', { category, resultsCount: searchResults.length });

  return resultPayload;
};
