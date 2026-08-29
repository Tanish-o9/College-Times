import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createAuditLog } from './auditLogService';

export interface UserAppeal {
  id?: string;
  userId: string;
  userEmail?: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: any;
  reviewedAt?: any;
  reviewerId?: string;
}

/**
 * Submits a new moderation restriction appeal
 */
export const submitAppeal = async (userId: string, userEmail: string, reason: string): Promise<string> => {
  if (!userId || !reason) throw new Error('User ID and appeal reason are required.');
  const appealsColl = collection(db, 'appeals');
  const docRef = await addDoc(appealsColl, {
    userId,
    userEmail,
    reason: reason.trim().slice(0, 1000),
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Retrieves all pending appeals (Moderators / Admins only)
 */
export const getPendingAppeals = async (): Promise<UserAppeal[]> => {
  try {
    const appealsColl = collection(db, 'appeals');
    const q = query(appealsColl, where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as UserAppeal));
  } catch (err) {
    console.error('Failed to fetch pending appeals:', err);
    return [];
  }
};

/**
 * Resolves user appeal and modifies restriction flags
 */
export const resolveAppeal = async (
  appealId: string,
  userId: string,
  status: 'resolved' | 'dismissed',
  reviewerId: string,
  liftRestrictions: boolean
): Promise<void> => {
  if (!appealId || !userId) throw new Error('Appeal ID and User ID are required.');

  // Update Appeal doc
  const appealRef = doc(db, 'appeals', appealId);
  await updateDoc(appealRef, {
    status,
    reviewerId,
    reviewedAt: serverTimestamp(),
  });

  // If restrictions are lifted, reset flags on user doc
  if (liftRestrictions) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role: 'student', // restore role from suspended
      messagingRestricted: false,
      postingRestricted: false,
      groupsRestricted: false,
      updatedAt: serverTimestamp(),
    });

    await createAuditLog(
      reviewerId,
      'USER_RESTRICTED',
      'user',
      userId,
      'Appeal resolved successfully. Restrictions cleared.'
    );
  }
};

/**
 * Granularly restricts user interaction privileges
 */
export const restrictUser = async (
  moderatorId: string,
  userId: string,
  restrictions: {
    messagingRestricted?: boolean;
    postingRestricted?: boolean;
    groupsRestricted?: boolean;
    suspended?: boolean;
  }
): Promise<void> => {
  if (!userId) throw new Error('User ID required.');

  const userRef = doc(db, 'users', userId);
  const updates: any = {
    updatedAt: serverTimestamp(),
  };

  if (restrictions.messagingRestricted !== undefined) updates.messagingRestricted = restrictions.messagingRestricted;
  if (restrictions.postingRestricted !== undefined) updates.postingRestricted = restrictions.postingRestricted;
  if (restrictions.groupsRestricted !== undefined) updates.groupsRestricted = restrictions.groupsRestricted;
  if (restrictions.suspended) {
    updates.role = 'suspended'; // suspend user role
  }

  await updateDoc(userRef, updates);

  await createAuditLog(
    moderatorId,
    'USER_RESTRICTED',
    'user',
    userId,
    `Applied: ${JSON.stringify(restrictions)}`
  );
};
