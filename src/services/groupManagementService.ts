import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  increment,
  runTransaction,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import type {
  GroupRole,
  GroupJoinRequest,
  GroupAnnouncement,
  GroupMemberReport,
  GroupAuditLog,
} from '../types/group';
import { createNotification } from './notificationService';

/**
 * Logs a privacy-safe audit log event for group administrative actions.
 */
export const logGroupActivity = async (
  groupId: string,
  action: GroupAuditLog['action'],
  actorId: string,
  actorName: string,
  details: string
): Promise<void> => {
  if (!groupId || !actorId) return;

  try {
    const logsRef = collection(db, 'groups', groupId, 'auditLogs');
    await addDoc(logsRef, {
      groupId,
      action,
      actorId,
      actorName,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to log group activity:', err);
  }
};

/**
 * Fetches paginated audit logs for a group (Admin/Owner only).
 */
export const getGroupAuditLogs = async (
  groupId: string,
  limitCount: number = 50
): Promise<GroupAuditLog[]> => {
  const logsRef = collection(db, 'groups', groupId, 'auditLogs');
  const q = query(logsRef, orderBy('timestamp', 'desc'), limit(limitCount));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as GroupAuditLog[];
};

/**
 * Creates a join request for a private campus group.
 */
export const requestToJoinGroup = async (
  groupId: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!groupId || !currentUser) {
    throw new Error('Group ID and authentication are required.');
  }

  const reqRef = doc(db, 'groups', groupId, 'joinRequests', currentUser.uid);
  const snap = await getDoc(reqRef);

  if (snap.exists() && snap.data().status === 'pending') {
    throw new Error('You already have a pending join request for this group.');
  }

  const reqData: GroupJoinRequest = {
    userId: currentUser.uid,
    userName: userProfile?.displayName || currentUser.displayName || 'Campus Student',
    ...(userProfile?.photoURL ? { avatar: userProfile.photoURL } : {}),
    status: 'pending',
    createdAt: serverTimestamp(),
  };

  await setDoc(reqRef, reqData);
  logAnalyticsEvent('group_join_request_created', { groupId });
};

/**
 * Fetches pending join requests for a group.
 */
export const getGroupJoinRequests = async (
  groupId: string,
  limitCount: number = 50
): Promise<GroupJoinRequest[]> => {
  const reqsRef = collection(db, 'groups', groupId, 'joinRequests');
  const q = query(reqsRef, where('status', '==', 'pending'), limit(limitCount));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as GroupJoinRequest[];
};

/**
 * Approves a user's join request atomically.
 */
export const approveJoinRequest = async (
  groupId: string,
  targetUid: string,
  adminUser: FirebaseUser,
  adminProfile?: User | null
): Promise<void> => {
  if (!groupId || !targetUid || !adminUser) return;

  const reqRef = doc(db, 'groups', groupId, 'joinRequests', targetUid);
  const memberRef = doc(db, 'groups', groupId, 'members', targetUid);
  const userMembershipRef = doc(db, 'users', targetUid, 'groupMemberships', groupId);
  const groupRef = doc(db, 'groups', groupId);

  await runTransaction(db, async (tx) => {
    tx.update(reqRef, {
      status: 'approved',
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUser.uid,
    });

    tx.set(memberRef, {
      uid: targetUid,
      role: 'member',
      status: 'active',
      joinedAt: serverTimestamp(),
    });

    tx.set(userMembershipRef, {
      groupId,
      joinedAt: serverTimestamp(),
    });

    tx.update(groupRef, {
      memberCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  });

  createNotification({
    recipientId: targetUid,
    senderId: adminUser.uid,
    message: 'Your join request was approved! You are now a group member.',
    relatedPostId: groupId,
  });

  const adminName = adminProfile?.displayName || adminUser.displayName || 'Admin';
  logGroupActivity(groupId, 'member_joined', adminUser.uid, adminName, `Approved join request for ${targetUid}`);
  logAnalyticsEvent('group_join_request_approved', { groupId, targetUid });
};

/**
 * Rejects a user's join request.
 */
export const rejectJoinRequest = async (
  groupId: string,
  targetUid: string,
  adminUser: FirebaseUser
): Promise<void> => {
  if (!groupId || !targetUid) return;

  const reqRef = doc(db, 'groups', groupId, 'joinRequests', targetUid);
  await updateDoc(reqRef, {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUser.uid,
  });

  logAnalyticsEvent('group_join_request_rejected', { groupId, targetUid });
};

/**
 * Updates a group member's role (e.g. promote to moderator/admin or demote).
 */
export const updateMemberRole = async (
  groupId: string,
  targetUid: string,
  newRole: GroupRole,
  adminUser: FirebaseUser,
  adminProfile?: User | null
): Promise<void> => {
  if (!groupId || !targetUid || !adminUser) return;

  const memberRef = doc(db, 'groups', groupId, 'members', targetUid);
  await updateDoc(memberRef, {
    role: newRole,
    updatedAt: serverTimestamp(),
  });

  const adminName = adminProfile?.displayName || adminUser.displayName || 'Admin';
  logGroupActivity(groupId, 'role_changed', adminUser.uid, adminName, `Changed role of ${targetUid} to ${newRole}`);
  logAnalyticsEvent('group_role_changed', { groupId, targetUid, newRole });
};

/**
 * Removes a member from a group.
 */
export const removeMemberFromGroup = async (
  groupId: string,
  targetUid: string,
  adminUser: FirebaseUser,
  adminProfile?: User | null
): Promise<void> => {
  if (!groupId || !targetUid || !adminUser) return;

  const memberRef = doc(db, 'groups', groupId, 'members', targetUid);
  const userMembershipRef = doc(db, 'users', targetUid, 'groupMemberships', groupId);
  const groupRef = doc(db, 'groups', groupId);

  await runTransaction(db, async (tx) => {
    tx.delete(memberRef);
    tx.delete(userMembershipRef);
    tx.update(groupRef, {
      memberCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  });

  const adminName = adminProfile?.displayName || adminUser.displayName || 'Admin';
  logGroupActivity(groupId, 'member_removed', adminUser.uid, adminName, `Removed member ${targetUid}`);
  logAnalyticsEvent('group_member_removed', { groupId, targetUid });
};

/**
 * Bans a member from a group to prevent rejoining or invite usage.
 */
export const banMemberFromGroup = async (
  groupId: string,
  targetUid: string,
  reason: string,
  adminUser: FirebaseUser,
  adminProfile?: User | null
): Promise<void> => {
  if (!groupId || !targetUid || !adminUser) return;

  const memberRef = doc(db, 'groups', groupId, 'members', targetUid);
  const userMembershipRef = doc(db, 'users', targetUid, 'groupMemberships', groupId);
  const groupRef = doc(db, 'groups', groupId);

  await runTransaction(db, async (tx) => {
    tx.set(memberRef, {
      uid: targetUid,
      role: 'member',
      status: 'banned',
      banReason: reason || 'Violation of community guidelines',
      bannedAt: serverTimestamp(),
      bannedBy: adminUser.uid,
    });
    tx.delete(userMembershipRef);
    tx.update(groupRef, {
      memberCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  });

  const adminName = adminProfile?.displayName || adminUser.displayName || 'Admin';
  logGroupActivity(groupId, 'member_banned', adminUser.uid, adminName, `Banned user ${targetUid}: ${reason}`);
  logAnalyticsEvent('group_member_banned', { groupId, targetUid });
};

/**
 * Unbans a previously banned member.
 */
export const unbanMemberFromGroup = async (
  groupId: string,
  targetUid: string,
  _adminUser: FirebaseUser
): Promise<void> => {
  if (!groupId || !targetUid) return;

  const memberRef = doc(db, 'groups', groupId, 'members', targetUid);
  await deleteDoc(memberRef);

  logAnalyticsEvent('group_member_unbanned', { groupId, targetUid });
};

/**
 * Atomically transfers group ownership to a new owner.
 */
export const transferGroupOwnership = async (
  groupId: string,
  newOwnerUid: string,
  currentOwnerUser: FirebaseUser,
  currentOwnerProfile?: User | null
): Promise<void> => {
  if (!groupId || !newOwnerUid || !currentOwnerUser) return;

  const groupRef = doc(db, 'groups', groupId);
  const oldOwnerRef = doc(db, 'groups', groupId, 'members', currentOwnerUser.uid);
  const newOwnerRef = doc(db, 'groups', groupId, 'members', newOwnerUid);

  await runTransaction(db, async (tx) => {
    tx.update(groupRef, {
      createdBy: newOwnerUid,
      updatedAt: serverTimestamp(),
    });
    tx.update(oldOwnerRef, {
      role: 'admin',
      updatedAt: serverTimestamp(),
    });
    tx.update(newOwnerRef, {
      role: 'owner',
      status: 'active',
      updatedAt: serverTimestamp(),
    });
  });

  const ownerName = currentOwnerProfile?.displayName || currentOwnerUser.displayName || 'Owner';
  logGroupActivity(groupId, 'ownership_transferred', currentOwnerUser.uid, ownerName, `Transferred group ownership to ${newOwnerUid}`);
  logAnalyticsEvent('group_ownership_transferred', { groupId, newOwnerUid });
};

/**
 * Archives a campus group (read-only state).
 */
export const archiveGroup = async (
  groupId: string,
  adminUser: FirebaseUser,
  adminProfile?: User | null
): Promise<void> => {
  if (!groupId || !adminUser) return;

  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    active: false,
    updatedAt: serverTimestamp(),
  });

  const adminName = adminProfile?.displayName || adminUser.displayName || 'Admin';
  logGroupActivity(groupId, 'group_archived', adminUser.uid, adminName, 'Archived the campus group');
  logAnalyticsEvent('group_archived', { groupId });
};

/**
 * Creates an official Group Announcement.
 */
export const createGroupAnnouncement = async (
  groupId: string,
  title: string,
  content: string,
  pinned: boolean,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<GroupAnnouncement> => {
  if (!groupId || !currentUser) {
    throw new Error('Group ID and authentication required.');
  }

  const annRef = collection(db, 'groups', groupId, 'announcements');
  const annData: Omit<GroupAnnouncement, 'id'> = {
    groupId,
    title: title.trim().slice(0, 150),
    content: content.trim().slice(0, 2000),
    createdBy: currentUser.uid,
    creatorName: userProfile?.displayName || currentUser.displayName || 'Admin',
    createdAt: serverTimestamp(),
    pinned,
    status: 'active',
  };

  const newDoc = await addDoc(annRef, annData);
  const actorName = userProfile?.displayName || currentUser.displayName || 'Admin';
  logGroupActivity(groupId, 'announcement_created', currentUser.uid, actorName, `Created announcement: ${title}`);
  logAnalyticsEvent('group_announcement_created', { groupId });

  return {
    id: newDoc.id,
    ...annData,
    createdAt: new Date(),
  } as GroupAnnouncement;
};

/**
 * Fetches active announcements for a group.
 */
export const getGroupAnnouncements = async (
  groupId: string,
  limitCount: number = 10
): Promise<GroupAnnouncement[]> => {
  const annRef = collection(db, 'groups', groupId, 'announcements');
  const q = query(annRef, where('status', '==', 'active'), orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as GroupAnnouncement[];
};

/**
 * Soft deletes an announcement.
 */
export const deleteGroupAnnouncement = async (
  groupId: string,
  announcementId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!groupId || !announcementId) return;

  const annRef = doc(db, 'groups', groupId, 'announcements', announcementId);
  await updateDoc(annRef, {
    status: 'deleted',
    updatedAt: serverTimestamp(),
  });

  logGroupActivity(groupId, 'announcement_deleted', currentUser.uid, 'Admin', `Deleted announcement ${announcementId}`);
};

/**
 * Reports a group member.
 */
export const reportGroupMember = async (
  groupId: string,
  targetUserId: string,
  reason: GroupMemberReport['reason'],
  description: string,
  reporterUser: FirebaseUser
): Promise<void> => {
  if (!groupId || !targetUserId || !reporterUser) return;

  const reportsRef = collection(db, 'groups', groupId, 'memberReports');
  await addDoc(reportsRef, {
    groupId,
    reporterId: reporterUser.uid,
    targetUserId,
    reason,
    description: description.trim().slice(0, 500),
    createdAt: serverTimestamp(),
    status: 'pending',
  });

  logAnalyticsEvent('group_member_reported', { groupId, targetUserId, reason });
};

/**
 * Fetches pending moderation member reports for a group.
 */
export const getGroupModerationReports = async (
  groupId: string,
  limitCount: number = 50
): Promise<GroupMemberReport[]> => {
  const reportsRef = collection(db, 'groups', groupId, 'memberReports');
  const q = query(reportsRef, where('status', '==', 'pending'), limit(limitCount));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as GroupMemberReport[];
};

/**
 * Deactivates a campus group (Owner/Admin only). Enters read-only state.
 */
export const deactivateGroup = async (
  groupId: string,
  adminUser: FirebaseUser,
  adminProfile?: User | null
): Promise<void> => {
  if (!groupId || !adminUser) return;

  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    active: false,
    updatedAt: serverTimestamp(),
  });

  const actorName = adminProfile?.displayName || adminUser.displayName || 'Admin';
  logGroupActivity(groupId, 'group_archived', adminUser.uid, actorName, `Deactivated campus group ${groupId}`);
  logAnalyticsEvent('group_deactivated', { groupId });
};

/**
 * Reactivates a deactivated campus group (Owner/Admin only).
 */
export const reactivateGroup = async (
  groupId: string,
  adminUser: FirebaseUser,
  adminProfile?: User | null
): Promise<void> => {
  if (!groupId || !adminUser) return;

  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    active: true,
    updatedAt: serverTimestamp(),
  });

  const actorName = adminProfile?.displayName || adminUser.displayName || 'Admin';
  logGroupActivity(groupId, 'group_unarchived', adminUser.uid, actorName, `Reactivated campus group ${groupId}`);
  logAnalyticsEvent('group_reactivated', { groupId });
};
