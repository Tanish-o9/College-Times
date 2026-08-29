import { collection, query, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Post } from '../types/models';
import type { CampusGroup } from '../types/group';
import type { Opportunity } from '../types/opportunity';
import type { MarketplaceListing } from '../types/marketplace';

export interface TrendingEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  organizerId: string;
  organizerName: string;
  rsvpCount: number;
  category: string;
  explanation: string;
}

/**
 * Calculates a trending post score using time-decayed engagement velocity.
 */
export const getTrendingPosts = async (limitCount: number = 10): Promise<Post[]> => {
  try {
    const postsRef = collection(db, 'posts');
    // Fetch recent posts to run time-decay on
    const q = query(postsRef, orderBy('timestamp', 'desc'), limit(100));
    const snap = await getDocs(q);
    const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));

    const scored = posts.map((post) => {
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

      const hoursOld = Math.max(0, (Date.now() - postTimeMs) / (1000 * 60 * 60));
      const engagement = (post.likeCount || 0) * 2 + (post.commentCount || 0) * 4 + (post.savedCount || 0) * 6;
      const trendScore = engagement / Math.pow(1 + hoursOld * 0.15, 1.5);

      return { post, trendScore };
    });

    scored.sort((a, b) => b.trendScore - a.trendScore);
    return scored.slice(0, limitCount).map((item) => item.post);
  } catch (err) {
    console.error('Error calculating trending posts:', err);
    return [];
  }
};

/**
 * Prioritizes upcoming events based on RSVP popularity and department/batch match.
 */
export const getTrendingEvents = async (
  currentUser: any,
  limitCount: number = 10
): Promise<TrendingEvent[]> => {
  try {
    const eventsRef = collection(db, 'events');
    const q = query(eventsRef, orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    const rawEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    const now = new Date();
    // Filter out past events
    const upcoming = rawEvents.filter((ev) => {
      if (!ev.date) return false;
      const evDate = new Date(ev.date);
      return evDate >= now;
    });

    const scored = upcoming.map((ev) => {
      let score = ev.rsvpCount || 0;
      let explanation = 'Popular upcoming event';

      if (currentUser?.departmentId && ev.description?.toLowerCase().includes(currentUser.departmentId.toLowerCase())) {
        score += 30;
        explanation = 'Highly popular in your department';
      }
      if (currentUser?.batchYear && ev.description?.toLowerCase().includes(String(currentUser.batchYear))) {
        score += 20;
        explanation = 'Recommended for your batch year';
      }

      return {
        event: {
          id: ev.id,
          title: ev.title || 'Untitled Event',
          description: ev.description || '',
          date: ev.date || '',
          location: ev.location || 'Campus',
          organizerId: ev.organizerId || ev.createdBy || '',
          organizerName: ev.organizerName || 'Campus Organizer',
          rsvpCount: ev.rsvpCount || 0,
          category: ev.category || 'General',
          explanation,
        },
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limitCount).map((item) => item.event);
  } catch (err) {
    console.error('Error fetching trending events:', err);
    return [];
  }
};

/**
 * Fetches trending campus groups ordered by memberCount descending.
 */
export const getTrendingGroups = async (limitCount: number = 10): Promise<CampusGroup[]> => {
  try {
    const colRef = collection(db, 'groups');
    const q = query(colRef, orderBy('memberCount', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CampusGroup));
  } catch (err) {
    console.error('Error fetching trending groups:', err);
    return [];
  }
};

/**
 * Fetches trending opportunities with active deadlines, soonest first.
 */
export const getTrendingOpportunities = async (limitCount: number = 10): Promise<Opportunity[]> => {
  try {
    const colRef = collection(db, 'opportunities');
    const q = query(colRef, limit(50));
    const snap = await getDocs(q);
    const now = Date.now();
    const active = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Opportunity))
      .filter((opp) => {
        if (!opp.deadline) return false;
        const deadlineTime = new Date(opp.deadline).getTime();
        return deadlineTime >= now;
      });

    // Sort by deadline ascending (soonest first)
    active.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    return active.slice(0, limitCount);
  } catch (err) {
    console.error('Error fetching trending opportunities:', err);
    return [];
  }
};

/**
 * Fetches trending marketplace listings based on newest or highest saveCount.
 */
export const getTrendingListings = async (limitCount: number = 10): Promise<MarketplaceListing[]> => {
  try {
    const colRef = collection(db, 'marketplaceListings');
    // Order by createdAt descending as fallback / default
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MarketplaceListing));
  } catch (err) {
    console.error('Error fetching trending listings:', err);
    return [];
  }
};

