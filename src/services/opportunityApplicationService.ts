import {
  doc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { OpportunityApplication, ApplicationStatus } from '../types/opportunity';

export const trackApplication = async (
  userId: string,
  opportunityId: string,
  opportunityTitle: string,
  organization: string,
  status: ApplicationStatus = 'applied',
  notes?: string
): Promise<void> => {
  if (!userId || !opportunityId) return;

  const appRef = doc(db, 'users', userId, 'opportunityApplications', opportunityId);
  await setDoc(appRef, {
    id: opportunityId,
    opportunityId,
    opportunityTitle,
    organization,
    userId,
    status,
    notes: notes?.trim() || '',
    appliedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  logAnalyticsEvent('application_status_updated', { opportunityId, status });
};

export const updateApplicationStatus = async (
  userId: string,
  opportunityId: string,
  newStatus: ApplicationStatus,
  notes?: string
): Promise<void> => {
  if (!userId || !opportunityId) return;

  const appRef = doc(db, 'users', userId, 'opportunityApplications', opportunityId);
  await setDoc(
    appRef,
    {
      status: newStatus,
      ...(notes !== undefined ? { notes: notes.trim() } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const getUserApplications = async (
  userId: string,
  limitCount: number = 20
): Promise<OpportunityApplication[]> => {
  if (!userId) return [];
  const boundedLimit = Math.min(50, limitCount);

  const colRef = collection(db, 'users', userId, 'opportunityApplications');
  const snap = await getDocs(colRef);

  return snap.docs.slice(0, boundedLimit).map((d) => d.data() as OpportunityApplication);
};

// Backward-compatible aliases used by existing OpportunityCard
export const trackApplicationStatus = trackApplication;
export const getUserApplicationStatus = async (userId: string, opportunityId: string): Promise<ApplicationStatus | null> => {
  if (!userId || !opportunityId) return null;
  const appRef = doc(db, 'users', userId, 'opportunityApplications', opportunityId);
  const { getDoc } = await import('firebase/firestore');
  const snap = await getDoc(appRef);
  if (!snap.exists()) return null;
  return (snap.data() as OpportunityApplication).status;
};
