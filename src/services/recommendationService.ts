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

export interface RecommendedPerson {
  uid: string;
  displayName: string;
  photoURL?: string;
  departmentId?: string;
  year?: string;
  score: number;
  explanation: string;
}

/**
 * Recommends campus peers based on department, year, and interests.
 */
export const getRecommendedPeople = async (
  userId: string,
  limitCount: number = 5
): Promise<RecommendedPerson[]> => {
  if (!userId) return [];
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const profile = userDoc.exists() ? userDoc.data() : null;
    if (!profile) return [];

    const usersSnap = await getDocs(query(collection(db, 'users'), limit(100)));
    const recommendedList: RecommendedPerson[] = [];

    const friendsSnap = await getDocs(collection(db, 'users', userId, 'friends'));
    const friendIds = friendsSnap.docs.map((d) => d.id);

    const blockedSnap = await getDocs(collection(db, 'users', userId, 'blockedUsers'));
    const blockedIds = blockedSnap.docs.map((d) => d.id);

    usersSnap.forEach((d) => {
      const uData = d.data();
      if (d.id === userId) return;
      if (friendIds.includes(d.id)) return;
      if (blockedIds.includes(d.id)) return;

      let score = 0;
      let explanation = 'A student in your campus';

      if (profile.departmentId && uData.departmentId === profile.departmentId) {
        score += 40;
        explanation = `In your department (${profile.departmentId})`;
      }

      if (profile.year && uData.year === profile.year) {
        score += 20;
        if (score > 40) explanation += ' and same graduation year';
        else explanation = `Same graduation year (${profile.year})`;
      }

      if (profile.interests && uData.interests && Array.isArray(profile.interests) && Array.isArray(uData.interests)) {
        const mutualInterests = profile.interests.filter((i: string) =>
          uData.interests.some((ui: string) => ui.toLowerCase() === i.toLowerCase())
        );
        if (mutualInterests.length > 0) {
          score += mutualInterests.length * 15;
          explanation = `Mutual interests in ${mutualInterests.join(', ')}`;
        }
      }

      if (score > 0) {
        recommendedList.push({
          uid: d.id,
          displayName: uData.displayName || 'Campus Student',
          photoURL: uData.photoURL || undefined,
          departmentId: uData.departmentId,
          year: uData.year,
          score,
          explanation,
        });
      }
    });

    recommendedList.sort((a, b) => b.score - a.score);
    return recommendedList.slice(0, limitCount);
  } catch (err) {
    console.error('Error generating people recommendations:', err);
    return [];
  }
};
