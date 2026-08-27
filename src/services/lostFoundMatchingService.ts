import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Post } from '../types';
import type { MatchSuggestionResult } from '../types/lostFound';

/**
 * Deterministic Smart Matching Engine for Lost & Found items.
 * Candidate pool is strictly bounded (max 30 items) to prevent O(N²) scans.
 */
export const findMatchesForItem = async (
  item: Post,
  candidatesLimit: number = 30
): Promise<MatchSuggestionResult[]> => {
  if (!item || !item.postType || (item.postType !== 'lost' && item.postType !== 'found')) {
    return [];
  }

  const oppositeType = item.postType === 'lost' ? 'found' : 'lost';

  try {
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('postType', '==', oppositeType),
      limit(Math.min(50, candidatesLimit))
    );
    const snapshot = await getDocs(q);

    const targetCategory = (item.category || '').toLowerCase();
    const targetLocation = (item.location || '').toLowerCase();
    const targetTitle = (item.title || '').toLowerCase();
    const targetContent = (item.content || '').toLowerCase();
    const targetTime = item.timestamp
      ? typeof item.timestamp.toDate === 'function'
        ? item.timestamp.toDate().getTime()
        : new Date(item.timestamp).getTime()
      : Date.now();

    const matches: MatchSuggestionResult[] = [];

    snapshot.docs.forEach((docSnap) => {
      if (docSnap.id === item.id) return;
      const data = docSnap.data() as Post;
      if (data.status === 'resolved') return;

      let score = 0;

      // 1. Category Match (+30 pts)
      const candCategory = (data.category || '').toLowerCase();
      if (targetCategory && candCategory && (targetCategory === candCategory || targetCategory.includes(candCategory) || candCategory.includes(targetCategory))) {
        score += 30;
      }

      // 2. Location Similarity (+25 pts)
      const candLocation = (data.location || '').toLowerCase();
      if (targetLocation && candLocation) {
        const locTokens = targetLocation.split(/\s+/).filter((t) => t.length > 2);
        const matchesLoc = locTokens.some((t) => candLocation.includes(t));
        if (matchesLoc) score += 25;
      }

      // 3. Date Proximity (+25 pts)
      if (data.timestamp) {
        const candTime = typeof data.timestamp.toDate === 'function'
          ? data.timestamp.toDate().getTime()
          : new Date(data.timestamp).getTime();
        const diffDays = Math.abs(targetTime - candTime) / (1000 * 60 * 60 * 24);
        if (diffDays <= 1) {
          score += 25;
        } else if (diffDays <= 3) {
          score += 15;
        } else if (diffDays <= 7) {
          score += 5;
        }
      }

      // 4. Title / Content Keyword Overlap (+20 pts)
      const text = `${data.title} ${data.content}`.toLowerCase();
      const targetText = `${targetTitle} ${targetContent}`;
      const textTokens = targetText.split(/\s+/).filter((t) => t.length > 3);
      const matchedTokens = textTokens.filter((t) => text.includes(t));
      if (matchedTokens.length > 0) {
        score += Math.min(20, matchedTokens.length * 7);
      }

      // Filter score threshold >= 40
      if (score >= 40) {
        matches.push({
          itemId: docSnap.id,
          title: data.title,
          category: data.category || 'General',
          location: data.location || 'Campus',
          postType: data.postType as 'lost' | 'found',
          matchScore: Math.min(100, score),
          confidenceBand: score >= 70 ? 'High Match' : 'Possible Match',
        });
      }
    });

    matches.sort((a, b) => b.matchScore - a.matchScore);
    return matches.slice(0, 5); // Return top 5 matches
  } catch (err) {
    console.error('Error computing smart matches:', err);
    return [];
  }
};
