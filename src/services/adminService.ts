import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit as fsLimit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../lib/firebase';
import { sendAdminNotification } from './adminNotificationService';
import type { User } from '../types';

export interface ModerationLog {
  id?: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: 'user' | 'post' | 'confession' | 'event' | 'group' | 'moment' | 'comment' | 'listing';
  targetId: string;
  targetUserId?: string;
  reason?: string;
  createdAt: any;
}

export interface ConfessionAuthorDetail {
  confessionId: string;
  authorId: string;
  authorEmail?: string;
  authorName?: string;
  userProfile?: User | null;
  createdAt?: any;
}

/**
 * Creates a permanent moderation audit log in `moderationLogs/{logId}`.
 * Only readable and writable by verified admins in Firestore security rules.
 */
export const recordModerationLog = async (
  adminUser: FirebaseUser,
  action: string,
  targetType: ModerationLog['targetType'],
  targetId: string,
  targetUserId?: string,
  reason?: string
): Promise<void> => {
  try {
    const logRef = doc(collection(db, 'moderationLogs'));
    await setDoc(logRef, {
      adminId: adminUser.uid,
      adminEmail: adminUser.email || 'admin@college.edu',
      action,
      targetType,
      targetId,
      targetUserId: targetUserId || null,
      reason: reason || 'Moderation action taken',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Error writing moderation log:', err);
  }
};

/**
 * Blocks a user at platform database level (`users/{uid}`).
 * Sets `moderationStatus: 'blocked'`, preventing all Firestore writes.
 */
export const blockUser = async (
  targetUid: string,
  reason: string,
  adminUser: FirebaseUser
): Promise<void> => {
  if (!targetUid) throw new Error('Target User ID is required.');
  if (!adminUser) throw new Error('Admin authentication required.');

  const userRef = doc(db, 'users', targetUid);
  await updateDoc(userRef, {
    moderationStatus: 'blocked',
    blockedAt: serverTimestamp(),
    blockedBy: adminUser.uid,
    blockReason: reason || 'Violation of campus community guidelines',
  });

  await recordModerationLog(adminUser, 'BLOCK_USER', 'user', targetUid, targetUid, reason);

  await sendAdminNotification(
    {
      type: 'block',
      title: 'User Account Blocked',
      message: `User ${targetUid} was blocked by admin ${adminUser.email}. Reason: ${reason}`,
      targetUserId: targetUid,
    },
    adminUser
  );
};

/**
 * Restores a blocked user account back to active status.
 */
export const unblockUser = async (
  targetUid: string,
  adminUser: FirebaseUser
): Promise<void> => {
  if (!targetUid) throw new Error('Target User ID is required.');
  if (!adminUser) throw new Error('Admin authentication required.');

  const userRef = doc(db, 'users', targetUid);
  await updateDoc(userRef, {
    moderationStatus: 'active',
    blockedAt: null,
    blockedBy: null,
    blockReason: null,
  });

  await recordModerationLog(adminUser, 'UNBLOCK_USER', 'user', targetUid, targetUid);
};

/**
 * Privileged Admin Fetch: Retrieves the identity of an anonymous confession author.
 * Protected by Firestore rules — returns permission denied for normal users.
 */
export const getConfessionAuthorDetails = async (
  confessionId: string
): Promise<ConfessionAuthorDetail | null> => {
  if (!confessionId) return null;

  const metaRef = doc(db, 'confessionPrivateMetadata', confessionId);
  const snap = await getDoc(metaRef);
  if (!snap.exists()) return null;

  const data = snap.data();
  let userProfile: User | null = null;
  if (data.authorId) {
    const userSnap = await getDoc(doc(db, 'users', data.authorId));
    if (userSnap.exists()) {
      userProfile = userSnap.data() as User;
    }
  }

  return {
    confessionId,
    authorId: data.authorId,
    authorEmail: data.authorEmail || userProfile?.email || 'N/A',
    authorName: data.authorName || userProfile?.displayName || 'Anonymous Student',
    userProfile,
    createdAt: data.createdAt,
  };
};

/**
 * Fetches user profile moderation metadata for Admin inspection.
 */
export const getUserModerationDetails = async (
  userId: string
): Promise<{ user: User | null; reportsCount: number } | null> => {
  if (!userId) return null;

  const userSnap = await getDoc(doc(db, 'users', userId));
  const user = userSnap.exists() ? (userSnap.data() as User) : null;

  // Check report count if available
  let reportsCount = 0;
  try {
    const reportsQuery = query(collection(db, 'reports'), where('reportedUserId', '==', userId));
    const rSnap = await getDocs(reportsQuery);
    reportsCount = rSnap.size;
  } catch {
    // Ignore report query error
  }

  return { user, reportsCount };
};

/**
 * Generic Admin Content Moderation Handler:
 * Deletes or hides content documents across features and logs the action.
 */
export const moderateContent = async (
  targetType: ModerationLog['targetType'],
  targetId: string,
  action: 'delete' | 'hide' | 'suspend',
  reason: string,
  adminUser: FirebaseUser,
  targetUserId?: string
): Promise<void> => {
  if (!targetId || !targetType) throw new Error('Target specification required.');

  let colName = '';
  switch (targetType) {
    case 'post':
      colName = 'posts';
      break;
    case 'confession':
      colName = 'confessions';
      break;
    case 'event':
      colName = 'events';
      break;
    case 'group':
      colName = 'groups';
      break;
    case 'listing':
      colName = 'marketplace';
      break;
    default:
      throw new Error(`Unsupported moderation target type: ${targetType}`);
  }

  const docRef = doc(db, colName, targetId);

  if (action === 'delete') {
    await deleteDoc(docRef);
  } else {
    await updateDoc(docRef, {
      status: action === 'suspend' ? 'suspended' : 'hidden',
      moderationReason: reason,
      moderatedAt: serverTimestamp(),
      moderatedBy: adminUser.uid,
    });
  }

  await recordModerationLog(adminUser, `${action.toUpperCase()}_${targetType.toUpperCase()}`, targetType, targetId, targetUserId, reason);
};

/**
 * Fetches recent moderation audit logs for admin audit.
 */
export const getModerationLogs = async (limitCount: number = 30): Promise<ModerationLog[]> => {
  try {
    const q = query(collection(db, 'moderationLogs'), orderBy('createdAt', 'desc'), fsLimit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ModerationLog) }));
  } catch (err) {
    console.error('Error fetching moderation logs:', err);
    return [];
  }
};
