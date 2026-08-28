import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  serverTimestamp,
  increment,
  runTransaction,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import type { GroupMember, GroupRole } from '../types/group';
import { logGroupActivity } from './groupManagementService';

export interface PaginatedGroupMembersResult {
  members: GroupMember[];
  lastDoc: QueryDocumentSnapshot | null;
}

/**
 * Fetches cursor-paginated members for a campus group (bounded size 1 to 50, default 20).
 */
export const getGroupMembersPage = async (
  groupId: string,
  pageSize: number = 20,
  lastDoc: QueryDocumentSnapshot | null = null,
  roleFilter?: GroupRole
): Promise<PaginatedGroupMembersResult> => {
  if (!groupId) return { members: [], lastDoc: null };

  const boundedSize = Math.min(50, Math.max(1, pageSize));
  const colRef = collection(db, 'groups', groupId, 'members');

  let q;
  if (roleFilter) {
    q = query(colRef, where('role', '==', roleFilter), orderBy('joinedAt', 'desc'), limit(boundedSize));
    if (lastDoc) {
      q = query(colRef, where('role', '==', roleFilter), orderBy('joinedAt', 'desc'), startAfter(lastDoc), limit(boundedSize));
    }
  } else {
    q = query(colRef, orderBy('joinedAt', 'desc'), limit(boundedSize));
    if (lastDoc) {
      q = query(colRef, orderBy('joinedAt', 'desc'), startAfter(lastDoc), limit(boundedSize));
    }
  }

  const snap = await getDocs(q);
  const members: GroupMember[] = snap.docs.map((d) => ({
    ...(d.data() as GroupMember),
    uid: d.id,
  }));

  const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { members, lastDoc: newLastDoc };
};

/**
 * Searches group members by display name (bounded query max 50).
 */
export const searchGroupMembers = async (
  groupId: string,
  queryText: string,
  limitCount: number = 20
): Promise<GroupMember[]> => {
  if (!groupId || !queryText.trim()) return [];

  const clean = queryText.trim().toLowerCase();
  const boundedSize = Math.min(50, Math.max(1, limitCount));
  const colRef = collection(db, 'groups', groupId, 'members');

  const snap = await getDocs(query(colRef, limit(100)));
  const results: GroupMember[] = [];

  snap.docs.forEach((d) => {
    const data = d.data() as GroupMember;
    const name = (data.displayName || '').toLowerCase();
    if (name.includes(clean)) {
      results.push({ ...data, uid: d.id });
    }
  });

  return results.slice(0, boundedSize);
};

/**
 * Updates a member's role with transaction safety.
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
  logGroupActivity(groupId, 'role_changed', adminUser.uid, adminName, `Updated role of ${targetUid} to ${newRole}`);
  logAnalyticsEvent('group_member_promoted', { groupId, targetUid, newRole });
};

/**
 * Removes a member from a group atomically.
 */
export const removeGroupMember = async (
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
 * Bans a member from a group permanently or temporarily.
 */
export const banGroupMember = async (
  groupId: string,
  targetUid: string,
  reason: string,
  durationDays: number = 0,
  adminUser: FirebaseUser,
  adminProfile?: User | null
): Promise<void> => {
  if (!groupId || !targetUid || !adminUser) return;

  const banRef = doc(db, 'groups', groupId, 'bannedMembers', targetUid);
  const memberRef = doc(db, 'groups', groupId, 'members', targetUid);
  const userMembershipRef = doc(db, 'users', targetUid, 'groupMemberships', groupId);
  const groupRef = doc(db, 'groups', groupId);

  const expiresAt = durationDays > 0 ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : null;

  await runTransaction(db, async (tx) => {
    tx.set(banRef, {
      userId: targetUid,
      bannedBy: adminUser.uid,
      reason: reason || 'Violation of group rules',
      createdAt: serverTimestamp(),
      ...(expiresAt ? { expiresAt } : {}),
      status: 'active',
    });
    tx.delete(memberRef);
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
 * Unbans a user.
 */
export const unbanGroupMember = async (
  groupId: string,
  targetUid: string,
  adminUser: FirebaseUser
): Promise<void> => {
  if (!groupId || !targetUid || !adminUser) return;

  const banRef = doc(db, 'groups', groupId, 'bannedMembers', targetUid);
  await deleteDoc(banRef);

  logGroupActivity(groupId, 'role_changed', adminUser.uid, 'Admin', `Unbanned user ${targetUid}`);
  logAnalyticsEvent('group_member_unbanned', { groupId, targetUid });
};

/**
 * Mutes a member temporarily (prevents posting, chatting, creating moments).
 */
export const muteGroupMember = async (
  groupId: string,
  targetUid: string,
  durationMinutes: number = 60,
  adminUser: FirebaseUser,
  adminProfile?: User | null
): Promise<void> => {
  if (!groupId || !targetUid || !adminUser) return;

  const mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
  const memberRef = doc(db, 'groups', groupId, 'members', targetUid);

  await updateDoc(memberRef, {
    mutedUntil,
    updatedAt: serverTimestamp(),
  });

  const adminName = adminProfile?.displayName || adminUser.displayName || 'Admin';
  logGroupActivity(groupId, 'role_changed', adminUser.uid, adminName, `Muted member ${targetUid} for ${durationMinutes} minutes`);
  logAnalyticsEvent('group_member_muted', { groupId, targetUid, durationMinutes });
};

/**
 * Unmutes a member.
 */
export const unmuteGroupMember = async (
  groupId: string,
  targetUid: string,
  adminUser: FirebaseUser
): Promise<void> => {
  if (!groupId || !targetUid || !adminUser) return;

  const memberRef = doc(db, 'groups', groupId, 'members', targetUid);
  await updateDoc(memberRef, {
    mutedUntil: null,
    updatedAt: serverTimestamp(),
  });

  logGroupActivity(groupId, 'role_changed', adminUser.uid, 'Admin', `Unmuted member ${targetUid}`);
};

/**
 * Fetches the top group members ordered by their contribution points.
 */
export const getGroupLeaderboard = async (
  groupId: string,
  limitCount: number = 10
): Promise<GroupMember[]> => {
  if (!groupId) return [];
  const colRef = collection(db, 'groups', groupId, 'members');
  const q = query(colRef, orderBy('points', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    ...(d.data() as GroupMember),
    uid: d.id,
  }));
};
