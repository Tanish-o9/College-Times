import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  setDoc,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { CampusEvent } from '../types/models';
import type { Opportunity } from '../types/opportunity';

export interface RecommendedEvent extends CampusEvent {
  score: number;
  explanation: string;
}

export interface RecommendedOpportunity extends Opportunity {
  score: number;
  explanation: string;
}

/**
 * Smart recommendation engine for campus events.
 */
export const getRecommendedEvents = async (
  userId: string,
  limitCount: number = 4
): Promise<RecommendedEvent[]> => {
  if (!userId) return [];
  try {
    // 1. Fetch User Profile
    const userDoc = await getDoc(doc(db, 'users', userId));
    const profile = userDoc.exists() ? userDoc.data() : null;

    // 2. Fetch Events
    const eventsRef = collection(db, 'events');
    const q = query(eventsRef, where('status', '==', 'published'), limit(50));
    const snap = await getDocs(q);
    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CampusEvent));

    // 3. Score events
    const scored: RecommendedEvent[] = events.map((event) => {
      let score = event.rsvpCount || 0;
      let explanation = 'Upcoming popular campus event';

      if (profile) {
        // Boost for category interest match
        if (profile.interests && Array.isArray(profile.interests) && event.category) {
          const hasMatch = profile.interests.some(
            (interest: string) => interest.toLowerCase() === event.category?.toLowerCase()
          );
          if (hasMatch) {
            score += 50;
            explanation = `Matches your interest in ${event.category}`;
          }
        }

        // Boost for department relevance
        if (profile.departmentId && event.description?.toLowerCase().includes(profile.departmentId.toLowerCase())) {
          score += 35;
          explanation = 'Relevant to your department';
        }
      }

      return {
        ...event,
        score,
        explanation,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limitCount);
  } catch (err) {
    console.error('Error generating event recommendations:', err);
    return [];
  }
};

/**
 * Smart recommendation engine for opportunities (jobs, internships, research).
 */
export const getRecommendedOpportunities = async (
  userId: string,
  limitCount: number = 4
): Promise<RecommendedOpportunity[]> => {
  if (!userId) return [];
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const profile = userDoc.exists() ? userDoc.data() : null;

    const oppRef = collection(db, 'opportunities');
    const q = query(oppRef, where('status', '==', 'active'), limit(40));
    const snap = await getDocs(q);
    const opportunities = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Opportunity));

    const scored: RecommendedOpportunity[] = opportunities.map((opp) => {
      let score = 0;
      let explanation = 'New opportunity matching your profile';

      if (profile) {
        // Match skills
        if (profile.skills && Array.isArray(profile.skills)) {
          const matchedSkills = profile.skills.filter((skill: string) =>
            opp.skills?.some((req: string) => req.toLowerCase() === skill.toLowerCase())
          );
          if (matchedSkills.length > 0) {
            score += matchedSkills.length * 20;
            explanation = `Matches your skills: ${matchedSkills.join(', ')}`;
          }
        }

        // Match department/field
        if (profile.departmentId && opp.description?.toLowerCase().includes(profile.departmentId.toLowerCase())) {
          score += 25;
          explanation = 'Relevant to your department major';
        }
      }

      return {
        ...opp,
        score,
        explanation,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limitCount);
  } catch (err) {
    console.error('Error generating opportunity recommendations:', err);
    return [];
  }
};

/**
 * Personalized Search History - save recent searches (cap max 10)
 */
export const saveSearchHistory = async (userId: string, queryText: string): Promise<void> => {
  const cleanQuery = queryText.trim();
  if (!userId || !cleanQuery || cleanQuery.length > 100) return;

  try {
    const historyRef = doc(db, 'users', userId, 'preferences', 'searchHistory');
    const historyDoc = await getDoc(historyRef);
    let searches: string[] = [];

    if (historyDoc.exists()) {
      searches = historyDoc.data().searches || [];
    }

    // Remove if duplicates exist, then push to front
    searches = searches.filter((s) => s.toLowerCase() !== cleanQuery.toLowerCase());
    searches.unshift(cleanQuery);

    // Keep top 10
    searches = searches.slice(0, 10);

    await setDoc(historyRef, { searches, updatedAt: new Date() }, { merge: true });
  } catch (err) {
    console.error('Error saving search history:', err);
  }
};

/**
 * Fetches the user's search history.
 */
export const getSearchHistory = async (userId: string): Promise<string[]> => {
  if (!userId) return [];
  try {
    const historyRef = doc(db, 'users', userId, 'preferences', 'searchHistory');
    const snap = await getDoc(historyRef);
    return snap.exists() ? snap.data().searches || [] : [];
  } catch {
    return [];
  }
};

/**
 * Clears search history.
 */
export const clearSearchHistory = async (userId: string): Promise<void> => {
  if (!userId) return;
  try {
    const historyRef = doc(db, 'users', userId, 'preferences', 'searchHistory');
    await setDoc(historyRef, { searches: [], updatedAt: new Date() }, { merge: true });
    logAnalyticsEvent('search_history_cleared', { userId });
  } catch (err) {
    console.error('Error clearing search history:', err);
  }
};
