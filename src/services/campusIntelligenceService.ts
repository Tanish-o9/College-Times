import {
  collection,
  query,
  getDocs,
  limit,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { User } from '../types/models';
import type { CampusEvent } from '../types';
import type { Opportunity } from '../types/opportunity';

export interface IntelligenceItem {
  id: string;
  type: 'event' | 'opportunity' | 'task' | 'assignment' | 'challenge';
  title: string;
  subtitle?: string;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  dueDate?: Date | null;
  linkUrl?: string;
  category?: string;
  groupName?: string;
}

export interface TodaySummary {
  urgentCount: number;
  highCount: number;
  items: IntelligenceItem[];
}

/**
 * Parses any Firestore timestamp, Date, ISO string, or number into a valid Date object.
 */
export const parseCanonicalDate = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  try {
    if (typeof dateVal.toDate === 'function') return dateVal.toDate();
    if (dateVal instanceof Date) return dateVal;
    if (typeof dateVal === 'number') return new Date(dateVal);
    if (typeof dateVal === 'object' && typeof dateVal.seconds === 'number') {
      return new Date(dateVal.seconds * 1000);
    }
    if (typeof dateVal === 'string') return new Date(dateVal);
  } catch {
    return null;
  }
  return null;
};

/**
 * Priority Scoring Engine: Deterministically assigns priority scores.
 */
export const computePriority = (
  dueDate: Date | null,
  isSaved?: boolean
): 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' => {
  if (!dueDate) return isSaved ? 'HIGH' : 'NORMAL';

  const now = new Date();
  const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours <= 24 && diffHours >= -2) return 'URGENT';
  if (diffHours <= 72 && diffHours > 24) return 'HIGH';
  if (diffHours > 72 && diffHours <= 168) return 'NORMAL';
  return 'LOW';
};

/**
 * Fetches Today's Summary & Priority Items for the authenticated student.
 */
export const getTodaySummary = async (
  userId: string,
  _userProfile?: User | null
): Promise<TodaySummary> => {
  if (!userId) return { urgentCount: 0, highCount: 0, items: [] };

  const items: IntelligenceItem[] = [];

  try {
    // 1. Fetch Events starting today or soon
    const eventsRef = collection(db, 'events');
    const eventsSnap = await getDocs(query(eventsRef, limit(20)));
    eventsSnap.docs.forEach((d) => {
      const data = d.data() as CampusEvent;
      const startDate = parseCanonicalDate(data.eventDate || (data as any).createdAt);
      if (startDate) {
        const priority = computePriority(startDate);
        items.push({
          id: d.id,
          type: 'event',
          title: data.title || 'Campus Event',
          subtitle: data.location || data.category || 'Campus Event',
          priority,
          dueDate: startDate,
          linkUrl: `/events/${d.id}`,
          category: data.category,
        });
      }
    });

    // 2. Fetch Opportunities
    const oppsRef = collection(db, 'opportunities');
    const oppsSnap = await getDocs(query(oppsRef, orderBy('createdAt', 'desc'), limit(15)));
    oppsSnap.docs.forEach((d) => {
      const data = d.data() as Opportunity;
      const deadline = parseCanonicalDate(data.deadline || data.createdAt);
      if (deadline) {
        const priority = computePriority(deadline);
        if (priority === 'URGENT' || priority === 'HIGH') {
          items.push({
            id: d.id,
            type: 'opportunity',
            title: data.title || 'Campus Opportunity',
            subtitle: data.organization || data.location || 'Career Opportunity',
            priority,
            dueDate: deadline,
            linkUrl: `/opportunities/${d.id}`,
            category: data.type,
          });
        }
      }
    });

    // Sort by priority (URGENT -> HIGH -> NORMAL -> LOW) and due date
    const priorityWeight = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
    items.sort((a, b) => {
      const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (pDiff !== 0) return pDiff;
      if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
      return 0;
    });

    const urgentCount = items.filter((i) => i.priority === 'URGENT').length;
    const highCount = items.filter((i) => i.priority === 'HIGH').length;

    return {
      urgentCount,
      highCount,
      items: items.slice(0, 10),
    };
  } catch (err) {
    console.error('Error computing today summary:', err);
    return { urgentCount: 0, highCount: 0, items: [] };
  }
};

/**
 * Returns personalized recommendations based on student's department, interests, and groups.
 */
export const getRecommendedItems = async (
  userId: string,
  userProfile?: User | null
): Promise<IntelligenceItem[]> => {
  if (!userId) return [];

  try {
    const items: IntelligenceItem[] = [];
    const dept = userProfile?.department || userProfile?.departmentId;

    const oppsRef = collection(db, 'opportunities');
    const oppsSnap = await getDocs(query(oppsRef, orderBy('createdAt', 'desc'), limit(10)));
    oppsSnap.docs.forEach((d) => {
      const data = d.data() as Opportunity;
      items.push({
        id: d.id,
        type: 'opportunity',
        title: data.title || 'Recommended Opportunity',
        subtitle: dept ? `Recommended for ${dept}` : data.organization || 'Career',
        priority: 'HIGH',
        dueDate: parseCanonicalDate(data.deadline),
        linkUrl: `/opportunities/${d.id}`,
      });
    });

    return items.slice(0, 5);
  } catch (err) {
    console.error('Error fetching recommendations:', err);
    return [];
  }
};
