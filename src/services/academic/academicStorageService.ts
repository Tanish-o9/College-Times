import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type {
  AcademicProfile,
  AcademicAttendanceSubject,
  AcademicAttendanceSummary,
  AcademicMarksRecord,
  AcademicMarksSummary,
  AcademicSyncMetadata,
  AcademicSyncHistoryRecord,
} from '../../types/academic';

/**
 * Saves or updates a user's academic profile under users/{uid}/academic/profile
 */
export const saveAcademicProfile = async (uid: string, profile: AcademicProfile): Promise<void> => {
  const ref = doc(db, 'users', uid, 'academic', 'profile');
  await setDoc(ref, {
    ...profile,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

/**
 * Gets a user's academic profile from users/{uid}/academic/profile
 */
export const getAcademicProfile = async (uid: string): Promise<AcademicProfile | null> => {
  try {
    const ref = doc(db, 'users', uid, 'academic', 'profile');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as AcademicProfile;
    }
    return null;
  } catch (err) {
    console.error('Failed to get academic profile:', err);
    return null;
  }
};

/**
 * Saves attendance subjects list under users/{uid}/academic/attendance
 */
export const saveAcademicAttendance = async (
  uid: string,
  subjects: AcademicAttendanceSubject[]
): Promise<void> => {
  const colRef = collection(db, 'users', uid, 'academic_attendance');
  // Write each subject doc by subjectCode ID to prevent duplication
  for (const sub of subjects) {
    const docRef = doc(colRef, sub.subjectCode);
    await setDoc(docRef, {
      ...sub,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
};

/**
 * Gets attendance subjects list for a user
 */
export const getAcademicAttendance = async (uid: string): Promise<AcademicAttendanceSubject[]> => {
  try {
    const colRef = collection(db, 'users', uid, 'academic_attendance');
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => d.data() as AcademicAttendanceSubject);
  } catch (err) {
    console.error('Failed to get academic attendance:', err);
    return [];
  }
};

/**
 * Calculates attendance summary metrics safely from actual subject data
 */
export const computeAttendanceSummary = (
  subjects: AcademicAttendanceSubject[],
  alertThreshold: number = 75
): AcademicAttendanceSummary => {
  if (subjects.length === 0) {
    return {
      overallPercentage: 0,
      totalClasses: 0,
      presentClasses: 0,
      absentClasses: 0,
      totalSubjects: 0,
      needsAttentionCount: 0,
    };
  }

  let totalClasses = 0;
  let presentClasses = 0;
  let absentClasses = 0;
  let needsAttentionCount = 0;

  let lowest: { name: string; percentage: number } | undefined;
  let highest: { name: string; percentage: number } | undefined;

  subjects.forEach((s) => {
    totalClasses += s.totalClasses;
    presentClasses += s.presentClasses;
    absentClasses += s.absentClasses;

    if (s.percentage < alertThreshold) {
      needsAttentionCount++;
    }

    if (!lowest || s.percentage < lowest.percentage) {
      lowest = { name: s.subjectName, percentage: s.percentage };
    }
    if (!highest || s.percentage > highest.percentage) {
      highest = { name: s.subjectName, percentage: s.percentage };
    }
  });

  const overallPercentage = totalClasses > 0 ? Number(((presentClasses / totalClasses) * 100).toFixed(1)) : 0;

  return {
    overallPercentage,
    totalClasses,
    presentClasses,
    absentClasses,
    totalSubjects: subjects.length,
    lowestSubject: lowest,
    highestSubject: highest,
    needsAttentionCount,
  };
};

/**
 * Saves marks records under users/{uid}/academic/marks
 */
export const saveAcademicMarks = async (
  uid: string,
  records: AcademicMarksRecord[]
): Promise<void> => {
  const colRef = collection(db, 'users', uid, 'academic_marks');
  for (const r of records) {
    const docId = r.id || `${r.subjectCode}_${r.assessmentType.replace(/\s+/g, '_')}`;
    const docRef = doc(colRef, docId);
    await setDoc(docRef, {
      ...r,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
};

/**
 * Gets marks records for a user
 */
export const getAcademicMarks = async (uid: string): Promise<AcademicMarksRecord[]> => {
  try {
    const colRef = collection(db, 'users', uid, 'academic_marks');
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AcademicMarksRecord));
  } catch (err) {
    console.error('Failed to get academic marks:', err);
    return [];
  }
};

/**
 * Calculates marks summary metrics safely from actual fetched records
 */
export const computeMarksSummary = (records: AcademicMarksRecord[]): AcademicMarksSummary => {
  if (records.length === 0) {
    return {
      overallPercentage: 0,
      totalSubjects: 0,
      averageMarks: 0,
    };
  }

  let totalPct = 0;
  let highest: { name: string; percentage: number } | undefined;
  let lowest: { name: string; percentage: number } | undefined;
  let latestAssessment: string | undefined;

  const subjectSet = new Set<string>();

  records.forEach((r) => {
    subjectSet.add(r.subjectCode);
    totalPct += r.percentage;

    if (!highest || r.percentage > highest.percentage) {
      highest = { name: r.subjectName, percentage: r.percentage };
    }
    if (!lowest || r.percentage < lowest.percentage) {
      lowest = { name: r.subjectName, percentage: r.percentage };
    }
    if (r.assessmentType) {
      latestAssessment = r.assessmentType;
    }
  });

  const overallPercentage = Number((totalPct / records.length).toFixed(1));

  return {
    overallPercentage,
    totalSubjects: subjectSet.size,
    averageMarks: overallPercentage,
    highestSubject: highest,
    lowestSubject: lowest,
    latestAssessment,
  };
};

/**
 * Saves sync metadata under users/{uid}/academic/syncMetadata
 */
export const saveSyncMetadata = async (uid: string, meta: AcademicSyncMetadata): Promise<void> => {
  const ref = doc(db, 'users', uid, 'academic', 'syncMetadata');
  await setDoc(ref, {
    ...meta,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

/**
 * Gets sync metadata for a user
 */
export const getSyncMetadata = async (uid: string): Promise<AcademicSyncMetadata | null> => {
  try {
    const ref = doc(db, 'users', uid, 'academic', 'syncMetadata');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as AcademicSyncMetadata;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Logs a sync event in users/{uid}/academic_sync_history
 */
export const addSyncHistoryRecord = async (
  uid: string,
  record: Omit<AcademicSyncHistoryRecord, 'id'>
): Promise<void> => {
  try {
    const colRef = collection(db, 'users', uid, 'academic_sync_history');
    await addDoc(colRef, {
      ...record,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to log sync history:', err);
  }
};

/**
 * Gets sync history list for a user
 */
export const getSyncHistory = async (uid: string, limitCount: number = 10): Promise<AcademicSyncHistoryRecord[]> => {
  try {
    const colRef = collection(db, 'users', uid, 'academic_sync_history');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AcademicSyncHistoryRecord));
  } catch {
    return [];
  }
};
