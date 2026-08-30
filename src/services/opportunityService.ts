import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  writeBatch,
  query, 
  where, 
  orderBy, 
  limit, 
  runTransaction, 
  serverTimestamp, 
  Timestamp,
  increment
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { Opportunity, OpportunityType, OpportunityMode, OpportunityStatus } from '../types/opportunity';
import { createPost } from './postService';
import { logCampusActivity } from './activityCenterService';

export interface CreateOpportunityPayload {
  title: string;
  description: string;
  organizationName: string;
  organizationLogo?: string;
  type: OpportunityType;
  category?: string;
  location?: string;
  mode: OpportunityMode;
  eligibility?: string;
  branches?: string[];
  yearOfStudy?: string[];
  skills?: string[];
  stipend?: string;
  salaryRange?: string;
  applicationUrl: string;
  applicationDeadline: string; // ISO date string
  startDate?: string;
  endDate?: string;
  groupId?: string;
  eventId?: string;
  isOfficial?: boolean;
}

/**
 * Creates a new Campus Opportunity.
 * Path: opportunities/{opportunityId}
 */
export const createOpportunity = async (
  payload: CreateOpportunityPayload,
  currentUser: FirebaseUser,
  isAdmin: boolean = false
): Promise<Opportunity> => {
  if (!currentUser) throw new Error('Authentication required to create an opportunity.');

  const title = payload.title.trim();
  const orgName = payload.organizationName.trim();
  const appUrl = payload.applicationUrl.trim();

  if (title.length < 3) throw new Error('Title must be at least 3 characters long.');
  if (orgName.length < 2) throw new Error('Organization name required.');
  if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
    throw new Error('Valid application URL starting with http:// or https:// required.');
  }

  const deadlineTimestamp = Timestamp.fromDate(new Date(payload.applicationDeadline));
  const opportunitiesRef = collection(db, 'opportunities');

  const newOpportunityData = {
    title,
    description: payload.description.trim(),
    organizationName: orgName,
    organizationLogo: payload.organizationLogo?.trim() || undefined,
    type: payload.type,
    category: payload.category || payload.type,
    location: payload.location?.trim() || 'Campus / Remote',
    mode: payload.mode,
    eligibility: payload.eligibility?.trim() || undefined,
    branches: payload.branches || [],
    yearOfStudy: payload.yearOfStudy || [],
    skills: payload.skills || [],
    stipend: payload.stipend?.trim() || undefined,
    salaryRange: payload.salaryRange?.trim() || undefined,
    applicationUrl: appUrl,
    applicationDeadline: deadlineTimestamp,
    ...(payload.startDate ? { startDate: Timestamp.fromDate(new Date(payload.startDate)) } : {}),
    ...(payload.endDate ? { endDate: Timestamp.fromDate(new Date(payload.endDate)) } : {}),
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
    status: 'active' as OpportunityStatus,
    visibility: 'campus' as const,
    isOfficial: isAdmin ? (payload.isOfficial ?? false) : false,
    isVerified: isAdmin ? true : false,
    ...(payload.groupId ? { groupId: payload.groupId } : {}),
    ...(payload.eventId ? { eventId: payload.eventId } : {}),
    saveCount: 0,
    viewCount: 0,
    applicationCount: 0,
  };

  const docRef = await addDoc(opportunitiesRef, newOpportunityData);

  // Cross-post reference to Campus Feed
  try {
    await createPost(
      {
        title: `🎯 [Opportunity: ${payload.type}] ${title} at ${orgName}`,
        content: `Mode: ${payload.mode.toUpperCase()} | Location: ${newOpportunityData.location}\nDeadline: ${new Date(payload.applicationDeadline).toLocaleDateString()}\n\n${payload.description.trim()}`,
        category: 'General',
        imageUrl: payload.organizationLogo,
      },
      currentUser
    );
  } catch (err) {
    // Non-blocking feed fallback
  }

  logCampusActivity({
    type: 'opportunity',
    action: `posted a new ${payload.type} opportunity`,
    actorId: currentUser.uid,
    actorName: currentUser.displayName || 'Campus Recruiter',
    actorAvatar: currentUser.photoURL || undefined,
    groupId: payload.groupId,
    targetId: docRef.id,
    targetTitle: title,
    previewText: `${orgName} - ${payload.location?.trim() || 'Campus / Remote'}`,
  });

  logAnalyticsEvent('opportunity_created', { type: payload.type, isOfficial: newOpportunityData.isOfficial });

  return {
    id: docRef.id,
    ...newOpportunityData,
    createdAt: new Date(),
  } as Opportunity;
};

/**
 * Fetches opportunities with cursor pagination and filter parameters.
 */
export const getOpportunities = async (
  filters?: {
    type?: string;
    mode?: string;
    isOfficial?: boolean;
    closingSoon?: boolean;
    searchQuery?: string;
    creatorId?: string;
  },
  limitCount: number = 20
): Promise<Opportunity[]> => {
  try {
    const opportunitiesRef = collection(db, 'opportunities');
    const boundedLimit = Math.min(50, Math.max(1, limitCount));

    let q = query(opportunitiesRef, orderBy('createdAt', 'desc'), limit(boundedLimit));

    if (filters?.closingSoon) {
      q = query(opportunitiesRef, where('status', '==', 'active'), orderBy('applicationDeadline', 'asc'), limit(boundedLimit));
    } else if (filters?.creatorId) {
      q = query(opportunitiesRef, where('createdBy', '==', filters.creatorId), limit(boundedLimit));
    }

    const snapshot = await getDocs(q);
    let list = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Opportunity[];

    // Client-side in-memory filtering for type, mode, official, & search query
    if (filters) {
      const qLower = (filters.searchQuery || '').trim().toLowerCase();
      list = list.filter((item) => {
        if (item.status === 'deleted' || item.status === 'hidden') return false;
        if (filters.type && filters.type !== 'All' && item.type !== filters.type) return false;
        if (filters.mode && filters.mode !== 'All' && item.mode !== filters.mode) return false;
        if (filters.isOfficial && !item.isOfficial) return false;
        if (qLower) {
          const matchTitle = item.title.toLowerCase().includes(qLower);
          const matchOrg = (item.organizationName || item.organization || '').toLowerCase().includes(qLower);
          const matchDesc = item.description.toLowerCase().includes(qLower);
          if (!matchTitle && !matchOrg && !matchDesc) return false;
        }
        return true;
      });
    }

    return list;
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return [];
  }
};

/**
 * Reads a single opportunity document by ID.
 */
export const getOpportunityById = async (id: string): Promise<Opportunity | null> => {
  if (!id) return null;
  try {
    const docRef = doc(db, 'opportunities', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Opportunity;
  } catch (err) {
    console.error(`Error fetching opportunity ${id}:`, err);
    return null;
  }
};

/**
 * Toggles verification status of an opportunity (Admin only).
 */
export const toggleVerifyOpportunity = async (
  opportunityId: string,
  isVerified: boolean,
  currentUser: FirebaseUser,
  isAdmin: boolean
): Promise<void> => {
  if (!currentUser || !isAdmin) throw new Error('Admin privileges required.');

  const docRef = doc(db, 'opportunities', opportunityId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) throw new Error('Opportunity not found.');

    transaction.update(docRef, {
      isVerified,
      updatedAt: serverTimestamp(),
    });
  });

  logAnalyticsEvent('opportunity_verified', { opportunityId, isVerified });
};

/**
 * Updates an opportunity document (creator or admin only).
 */
export const editOpportunity = async (
  opportunityId: string,
  userId: string,
  updates: Partial<CreateOpportunityPayload>,
  isAdmin: boolean = false
): Promise<void> => {
  if (!opportunityId || !userId) throw new Error('Opportunity ID and User ID are required.');

  const docRef = doc(db, 'opportunities', opportunityId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) throw new Error('Opportunity not found.');

    const data = snap.data() as Opportunity;
    if (data.createdBy !== userId && !isAdmin) {
      throw new Error('Unauthorized to edit this opportunity.');
    }

    const title = updates.title?.trim();
    const orgName = updates.organizationName?.trim();
    const appUrl = updates.applicationUrl?.trim();

    if (title && title.length < 3) throw new Error('Title must be at least 3 characters.');
    if (orgName && orgName.length < 2) throw new Error('Organization name required.');
    if (appUrl && !appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      throw new Error('Valid application URL starting with http:// or https:// required.');
    }

    const payload = {
      ...(title ? { title } : {}),
      ...(updates.description ? { description: updates.description.trim() } : {}),
      ...(orgName ? { organizationName: orgName } : {}),
      ...(updates.organizationLogo ? { organizationLogo: updates.organizationLogo.trim() } : {}),
      ...(updates.type ? { type: updates.type, category: updates.category || updates.type } : {}),
      ...(updates.location ? { location: updates.location.trim() } : {}),
      ...(updates.mode ? { mode: updates.mode } : {}),
      ...(updates.eligibility ? { eligibility: updates.eligibility.trim() } : {}),
      ...(updates.branches ? { branches: updates.branches } : {}),
      ...(updates.yearOfStudy ? { yearOfStudy: updates.yearOfStudy } : {}),
      ...(updates.skills ? { skills: updates.skills } : {}),
      ...(updates.stipend ? { stipend: updates.stipend.trim() } : {}),
      ...(updates.salaryRange ? { salaryRange: updates.salaryRange.trim() } : {}),
      ...(appUrl ? { applicationUrl: appUrl } : {}),
      ...(updates.applicationDeadline ? { applicationDeadline: Timestamp.fromDate(new Date(updates.applicationDeadline)) } : {}),
      ...(updates.startDate ? { startDate: Timestamp.fromDate(new Date(updates.startDate)) } : {}),
      ...(updates.endDate ? { endDate: Timestamp.fromDate(new Date(updates.endDate)) } : {}),
      updatedAt: serverTimestamp(),
    };

    transaction.update(docRef, payload);
  });

  logAnalyticsEvent('opportunity_edited', { opportunityId });
};

/**
 * Deletes an opportunity document (creator or admin only).
 */
export const deleteOpportunity = async (
  opportunityId: string,
  userId: string,
  isAdmin: boolean = false
): Promise<void> => {
  if (!opportunityId || !userId) throw new Error('Opportunity ID and User ID are required.');

  const docRef = doc(db, 'opportunities', opportunityId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Opportunity not found.');

  const data = snap.data() as Opportunity;
  if (data.createdBy !== userId && !isAdmin) {
    throw new Error('Unauthorized to delete this opportunity.');
  }

  const batch = writeBatch(db);
  batch.delete(docRef);

  // Delete reports
  const reportsSnap = await getDocs(collection(db, 'opportunities', opportunityId, 'reports'));
  reportsSnap.docs.forEach((d) => batch.delete(d.ref));

  await batch.commit();
  logAnalyticsEvent('opportunity_deleted', { opportunityId });
};

/**
 * Reports an opportunity.
 * Path: opportunities/{opportunityId}/reports/{userId}
 */
export const reportOpportunity = async (
  opportunityId: string,
  reporterId: string,
  reason: string
): Promise<{ success: boolean; alreadyReported: boolean }> => {
  if (!opportunityId || !reporterId) throw new Error('Opportunity ID and Reporter ID are required.');

  const oppRef = doc(db, 'opportunities', opportunityId);
  const reportRef = doc(db, 'opportunities', opportunityId, 'reports', reporterId);

  let alreadyReported = false;

  await runTransaction(db, async (transaction) => {
    const reportSnap = await transaction.get(reportRef);
    if (reportSnap.exists()) {
      alreadyReported = true;
      return;
    }

    transaction.set(reportRef, {
      reporterId,
      reason: reason.trim().slice(0, 300),
      reportedAt: serverTimestamp(),
    });
    transaction.update(oppRef, { reportCount: increment(1) });
  });

  return { success: !alreadyReported, alreadyReported };
};
