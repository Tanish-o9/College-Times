import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, storage, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import type {
  IncidentReport,
  EvidenceAttachment,
  ReportSeverity,
} from '../types/incidentReport';
import type { IncidentCategory } from '../types/alert';
import { createIncident } from './incidentService';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
]);

/**
 * Sanitizes filename replacing unsafe control & URI characters with underscores.
 */
export const sanitizeFilename = (filename: string): string => {
  if (!filename) return 'evidence_file';
  const clean = filename.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
  return clean.slice(0, 100);
};

/**
 * Validates & uploads an evidence file to Firebase Storage.
 */
export const uploadEvidenceFile = async (
  file: File,
  reportId: string,
  userId: string,
  onProgress?: (percentage: number) => void
): Promise<EvidenceAttachment> => {
  if (!file) throw new Error('No file provided.');
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File size exceeds 10MB limit.');
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`File type '${file.type}' is not supported. Allowed: JPEG, PNG, WEBP, MP4, WEBM.`);
  }

  const cleanName = sanitizeFilename(file.name);
  const storagePath = `incidentEvidence/${reportId}/${userId}/${Date.now()}_${cleanName}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(progress);
      },
      (error) => {
        console.error('Evidence upload error:', error);
        reject(new Error('Failed to upload evidence file.'));
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        const type: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';

        resolve({
          type,
          storagePath,
          downloadUrl,
          mimeType: file.type,
          size: file.size,
        });
      }
    );
  });
};

/**
 * Server-side rate limit check: Max 3 reports per 10 minutes per user.
 */
export const checkReportRateLimit = async (userId: string): Promise<void> => {
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
  const colRef = collection(db, 'incidentReports');
  const q = query(colRef, where('reporterId', '==', userId), where('createdAt', '>=', tenMinsAgo), limit(5));

  const snap = await getDocs(q);
  if (snap.docs.length >= 3) {
    throw new Error("You're submitting reports too quickly. Please try again in a few minutes.");
  }
};

/**
 * Student Action: Submits a new incident report.
 */
export const createIncidentReport = async (
  data: {
    category: IncidentCategory;
    description: string;
    locationName: string;
    locationLat?: number;
    locationLng?: number;
    evidence?: EvidenceAttachment[];
  },
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<string> => {
  if (!currentUser) throw new Error('Authentication required to submit report.');

  if (!data.description || data.description.trim().length < 10 || data.description.trim().length > 1000) {
    throw new Error('Description must be between 10 and 1000 characters.');
  }

  if (!data.locationName || data.locationName.trim().length > 150) {
    throw new Error('Location is required and must be 150 characters or fewer.');
  }

  if (data.evidence && data.evidence.length > 5) {
    throw new Error('Maximum of 5 evidence attachments allowed per report.');
  }

  // Rate limit check
  await checkReportRateLimit(currentUser.uid);

  const newDocRef = doc(collection(db, 'incidentReports'));
  const reportDoc: Omit<IncidentReport, 'id'> = {
    reporterId: currentUser.uid,
    reporterDisplayName: (userProfile as any)?.name || userProfile?.displayName || currentUser.displayName || 'Student',
    category: data.category,
    description: data.description.trim(),
    locationName: data.locationName.trim(),
    ...(data.locationLat !== undefined ? { locationLat: data.locationLat } : {}),
    ...(data.locationLng !== undefined ? { locationLng: data.locationLng } : {}),
    ...(data.evidence ? { evidence: data.evidence } : {}),
    status: 'pending',
    severity: 'unknown',
    createdAt: serverTimestamp(),
    retentionStatus: 'active',
  };

  await setDoc(newDocRef, reportDoc);

  logAnalyticsEvent('incident_report_submitted', {
    category: data.category,
  });

  return newDocRef.id;
};

/**
 * Fetches student's own submitted reports.
 */
export const getMyIncidentReports = async (currentUser: FirebaseUser): Promise<IncidentReport[]> => {
  if (!currentUser) return [];

  const colRef = collection(db, 'incidentReports');
  const q = query(colRef, where('reporterId', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    ...(d.data() as IncidentReport),
    id: d.id,
  }));
};

/**
 * Reads single incident report with authorization check.
 */
export const getIncidentReportById = async (
  reportId: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<IncidentReport | null> => {
  if (!reportId || !currentUser) return null;

  const snap = await getDoc(doc(db, 'incidentReports', reportId));
  if (!snap.exists()) return null;

  const report = { ...(snap.data() as IncidentReport), id: snap.id };

  // Reporter or Admin authorization
  if (report.reporterId !== currentUser.uid && userProfile?.role !== 'admin') {
    throw new Error('Unauthorized to view this report.');
  }

  return report;
};

/**
 * Admin Action: Transitions report status from pending to under_review.
 */
export const takeReportReview = async (
  reportId: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required to review report.');
  }

  const reportRef = doc(db, 'incidentReports', reportId);
  await updateDoc(reportRef, {
    status: 'under_review',
    reviewedBy: currentUser.uid,
    reviewedByName: (userProfile as any)?.name || userProfile?.displayName || 'Admin',
    reviewStartedAt: serverTimestamp(),
  });

  const auditRef = doc(collection(db, 'adminAuditLogs'));
  await setDoc(auditRef, {
    actorId: currentUser.uid,
    actorName: (userProfile as any)?.name || 'Admin',
    action: 'INCIDENT_REPORT_REVIEW_STARTED',
    resourceType: 'alert',
    targetId: reportId,
    timestamp: serverTimestamp(),
  });
};

/**
 * Admin Action: Verifies report and creates/links an Emergency Incident.
 */
export const verifyIncidentReport = async (
  reportId: string,
  severity: ReportSeverity,
  reviewNote: string | undefined,
  newIncidentData: {
    title: string;
    summary: string;
    locationName: string;
    affectedArea: 'campus' | 'department' | 'building' | 'batch' | 'community';
    affectedAreaId?: string;
    emergencyInstructions?: string;
  } | null,
  existingIncidentId: string | undefined,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<string> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required to verify report.');
  }

  let targetIncidentId = existingIncidentId;

  // If creating new incident
  if (!targetIncidentId && newIncidentData) {
    targetIncidentId = await createIncident(
      {
        title: newIncidentData.title,
        summary: newIncidentData.summary,
        category: 'accident',
        severity: severity === 'unknown' ? 'moderate' : (severity as any),
        locationName: newIncidentData.locationName,
        affectedArea: newIncidentData.affectedArea,
        affectedAreaId: newIncidentData.affectedAreaId,
        emergencyInstructions: newIncidentData.emergencyInstructions,
      },
      currentUser,
      userProfile
    );
  }

  const reportRef = doc(db, 'incidentReports', reportId);
  await updateDoc(reportRef, {
    status: 'verified',
    severity,
    reviewedAt: serverTimestamp(),
    reviewedBy: currentUser.uid,
    reviewedByName: (userProfile as any)?.name || 'Admin',
    ...(reviewNote ? { reviewNote: reviewNote.trim() } : {}),
    ...(targetIncidentId ? { incidentId: targetIncidentId } : {}),
  });

  // Notify reporter privately
  const snap = await getDoc(reportRef);
  if (snap.exists()) {
    const repData = snap.data() as IncidentReport;
    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, {
      userId: repData.reporterId,
      type: 'system',
      title: 'Incident Report Verified',
      message: `Your incident report '${repData.description.slice(0, 50)}...' has been verified by campus admins.`,
      read: false,
      createdAt: serverTimestamp(),
      link: `/my-reports/${reportId}`,
    });
  }

  // Audit Log
  const auditRef = doc(collection(db, 'adminAuditLogs'));
  await setDoc(auditRef, {
    actorId: currentUser.uid,
    actorName: (userProfile as any)?.name || 'Admin',
    action: 'INCIDENT_REPORT_VERIFIED',
    resourceType: 'alert',
    targetId: reportId,
    timestamp: serverTimestamp(),
    metadata: { incidentId: targetIncidentId, severity },
  });

  logAnalyticsEvent('incident_report_verified', { severity });
  return targetIncidentId || '';
};

/**
 * Admin Action: Rejects or Dismisses an incident report.
 */
export const rejectOrDismissReport = async (
  reportId: string,
  newStatus: 'rejected' | 'dismissed',
  reviewNote: string | undefined,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required to resolve report.');
  }

  const reportRef = doc(db, 'incidentReports', reportId);
  await updateDoc(reportRef, {
    status: newStatus,
    reviewedAt: serverTimestamp(),
    reviewedBy: currentUser.uid,
    reviewedByName: (userProfile as any)?.name || 'Admin',
    ...(reviewNote ? { reviewNote: reviewNote.trim() } : {}),
  });

  // Notify reporter privately
  const snap = await getDoc(reportRef);
  if (snap.exists()) {
    const repData = snap.data() as IncidentReport;
    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, {
      userId: repData.reporterId,
      type: 'system',
      title: `Incident Report ${newStatus === 'rejected' ? 'Rejected' : 'Dismissed'}`,
      message: `Your incident report has been reviewed and marked as ${newStatus}.`,
      read: false,
      createdAt: serverTimestamp(),
      link: `/my-reports/${reportId}`,
    });
  }

  // Audit Log
  const auditRef = doc(collection(db, 'adminAuditLogs'));
  await setDoc(auditRef, {
    actorId: currentUser.uid,
    actorName: (userProfile as any)?.name || 'Admin',
    action: newStatus === 'rejected' ? 'INCIDENT_REPORT_REJECTED' : 'INCIDENT_REPORT_DISMISSED',
    resourceType: 'alert',
    targetId: reportId,
    timestamp: serverTimestamp(),
  });

  logAnalyticsEvent(newStatus === 'rejected' ? 'incident_report_rejected' : 'incident_report_dismissed', {});
};
