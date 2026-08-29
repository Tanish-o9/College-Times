import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type ReportType = 'user' | 'post' | 'comment' | 'marketplace' | 'opportunity' | 'event' | 'group' | 'message';
export type ReportStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';

export interface Report {
  id?: string;
  reporterId: string;
  targetId: string;
  targetType: ReportType;
  reason: string;
  description: string;
  status: ReportStatus;
  createdAt: any;
  resolvedAt?: any;
  resolvedBy?: string;
  parentId?: string;
}

/**
 * Creates a new report record in top-level reports collection.
 */
export const createReport = async (
  reporterId: string,
  targetId: string,
  targetType: ReportType,
  reason: string,
  description: string,
  parentId?: string
): Promise<string> => {
  if (!reporterId || !targetId || !targetType || !reason) {
    throw new Error('All report parameters are required.');
  }

  const reportsRef = collection(db, 'reports');
  const docRef = await addDoc(reportsRef, {
    reporterId,
    targetId,
    targetType,
    reason: reason.trim(),
    description: description.trim().slice(0, 500),
    status: 'OPEN' as ReportStatus,
    createdAt: serverTimestamp(),
    ...(parentId ? { parentId } : {}),
  });

  return docRef.id;
};

/**
 * Fetches reports (all or filtered by status). Admin only.
 */
export const getReports = async (statusFilter?: ReportStatus): Promise<Report[]> => {
  try {
    const colRef = collection(db, 'reports');
    let q = query(colRef, orderBy('createdAt', 'desc'), limit(50));
    if (statusFilter) {
      q = query(colRef, where('status', '==', statusFilter), orderBy('createdAt', 'desc'), limit(50));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report));
  } catch (err) {
    console.error('Failed to get reports:', err);
    return [];
  }
};

/**
 * Updates a report status. Admin only.
 */
export const updateReportStatus = async (
  reportId: string,
  newStatus: ReportStatus,
  resolvedBy: string
): Promise<void> => {
  if (!reportId || !resolvedBy) throw new Error('Report ID and Resolver UID required.');

  const docRef = doc(db, 'reports', reportId);
  await updateDoc(docRef, {
    status: newStatus,
    resolvedBy,
    resolvedAt: serverTimestamp(),
  });
};

/**
 * Fetches reports submitted by a specific user.
 */
export const getReporterReports = async (reporterId: string): Promise<Report[]> => {
  if (!reporterId) return [];
  try {
    const colRef = collection(db, 'reports');
    const q = query(
      colRef,
      where('reporterId', '==', reporterId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report));
  } catch (err) {
    console.error('Failed to get reporter reports:', err);
    return [];
  }
};
