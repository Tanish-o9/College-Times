import type { User } from '../types/models';
import type { CampusGroup } from '../types/group';
import type { CampusEvent } from '../types/models';
import type { Opportunity } from '../types/opportunity';
import type { MarketplaceListing } from '../types/marketplace';
import type { UserPreferencesProfile } from '../types/feed';

/**
 * Deterministic discovery ranking scoring algorithm
 */

export interface DiscoveryExplanation {
  reason: string;
}

export interface RecommendedPerson extends User {
  score: number;
  explanation: string;
}

export interface RecommendedGroup extends CampusGroup {
  score: number;
  explanation: string;
}

export interface RecommendedEvent extends CampusEvent {
  score: number;
  explanation: string;
}

export interface RecommendedOpportunity extends Opportunity {
  score: number;
  explanation: string;
}

export interface RecommendedListing extends MarketplaceListing {
  score: number;
  explanation: string;
}

// 1. People Discovery
export function rankPeople(
  candidates: User[],
  currentUser: User,
  mutualGroupCountMap: Record<string, number> = {},
  interactionCounts: Record<string, number> = {}
): RecommendedPerson[] {
  return candidates
    .filter((c) => {
      if (c.uid === currentUser.uid) return false;
      if (!c.username || c.username.trim() === '' || c.username.startsWith('student_')) return false;
      if (!c.displayName || c.displayName === 'Student' || c.displayName === 'Campus Student') return false;
      return true;
    })
    .map((c) => {
      let score = 0;
      let explanation = 'Popular on campus';

      if (c.departmentId && c.departmentId === currentUser.departmentId) {
        score += 40;
        explanation = 'In your department';
      }
      if (c.batchYear && c.batchYear === currentUser.batchYear) {
        score += 30;
        explanation = 'From your batch year';
      }
      const mutuals = mutualGroupCountMap[c.uid] || 0;
      if (mutuals > 0) {
        score += mutuals * 15;
        explanation = `Shared ${mutuals} mutual group(s)`;
      }
      const interactions = interactionCounts[c.uid] || 0;
      if (interactions > 0) {
        score += interactions * 10;
        explanation = 'Interacted recently';
      }

      return { ...c, score, explanation };
    })
    .sort((a, b) => b.score - a.score);
}

// 2. Group Discovery
export function rankGroups(
  groups: CampusGroup[],
  profile?: UserPreferencesProfile,
  currentUserDepartmentId?: string
): RecommendedGroup[] {
  return groups.map((g) => {
    let score = 0;
    let explanation = 'Trending on campus';

    if (currentUserDepartmentId && g.description?.toLowerCase().includes(currentUserDepartmentId.toLowerCase())) {
      score += 40;
      explanation = 'Popular in your department';
    }

    if (profile?.interests && profile.interests.length > 0) {
      const match = profile.interests.some((interest) =>
        g.name.toLowerCase().includes(interest.toLowerCase()) ||
        g.description?.toLowerCase().includes(interest.toLowerCase())
      );
      if (match) {
        score += 35;
        explanation = 'Matches your interests';
      }
    }

    const memberCount = g.memberCount || 0;
    score += Math.min(25, memberCount * 0.1);

    return { ...g, score, explanation };
  }).sort((a, b) => b.score - a.score);
}

// 3. Event Discovery
export function rankEvents(
  events: CampusEvent[],
  profile?: UserPreferencesProfile,
  userGroupIds: string[] = []
): RecommendedEvent[] {
  const now = Date.now();
  return events
    .filter((e) => {
      const date = e.eventDate?.toDate ? e.eventDate.toDate().getTime() : Number(e.eventDate || 0);
      return date > now; // Upcoming events only
    })
    .map((e) => {
      let score = 0;
      let explanation = 'Featured event';

      if (e.groupId && userGroupIds.includes(e.groupId)) {
        score += 50;
        explanation = 'Event from one of your groups';
      }

      if (profile?.interests && profile.interests.length > 0) {
        const match = profile.interests.some((interest) =>
          e.title.toLowerCase().includes(interest.toLowerCase()) ||
          (e.description || '').toLowerCase().includes(interest.toLowerCase())
        );
        if (match) {
          score += 30;
          explanation = 'Aligned with your interests';
        }
      }

      return { ...e, score, explanation };
    })
    .sort((a, b) => b.score - a.score);
}

// 4. Opportunity Discovery
export function rankOpportunities(
  opportunities: Opportunity[],
  profile?: UserPreferencesProfile,
  userSkills: string[] = []
): RecommendedOpportunity[] {
  return opportunities.map((o) => {
    let score = 0;
    let explanation = 'Hot opportunity';

    // Skill match scoring
    if (o.skills && o.skills.length > 0 && userSkills.length > 0) {
      const matched = o.skills.filter((s) => userSkills.includes(s)).length;
      if (matched > 0) {
        score += matched * 20;
        explanation = `Matches ${matched} of your skills`;
      }
    }

    if (profile?.interests && profile.interests.length > 0) {
      const match = profile.interests.some((interest) =>
        o.title.toLowerCase().includes(interest.toLowerCase()) ||
        (o.description || '').toLowerCase().includes(interest.toLowerCase())
      );
      if (match) {
        score += 15;
        explanation = 'Related to your interests';
      }
    }

    return { ...o, score, explanation };
  }).sort((a, b) => b.score - a.score);
}

// 5. Marketplace Discovery
export function rankListings(
  listings: MarketplaceListing[],
  profile?: UserPreferencesProfile
): RecommendedListing[] {
  return listings
    .filter((l) => l.status === 'active') // Active listings only
    .map((l) => {
      let score = 0;
      let explanation = 'Highly relevant on campus';

      if (profile?.interests && profile.interests.length > 0) {
        const match = profile.interests.some((interest) =>
          l.title.toLowerCase().includes(interest.toLowerCase()) ||
          (l.description || '').toLowerCase().includes(interest.toLowerCase())
        );
        if (match) {
          score += 30;
          explanation = 'Matches your saved categories';
        }
      }

      return { ...l, score, explanation };
    })
    .sort((a, b) => b.score - a.score);
}
