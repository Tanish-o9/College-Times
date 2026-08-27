import {
  doc,
  updateDoc,
  serverTimestamp,
  increment,
  runTransaction,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import type { GroupRole } from '../types/group';
import { logGroupActivity } from './groupManagementService';

/**
 * Changes a group member's role with role permissions checks.
 */
export const changeMemberRole = async (
  groupId: string,
  targetUid: string,
  newRole: GroupRole,
  adminUser: FirebaseUser,
  adminProfile?: User | null
): Promise<void> => {
  if (!groupId || !targetUid || !adminUser) {
    throw new Error('Group ID, target user, and admin authentication are required.');
  }

  if (targetUid === adminUser.uid) {
    throw new Error('You cannot change your own role.');
  }

  const memberRef = doc(db, 'groups', groupId, 'members', targetUid);
  await updateDoc(memberRef, {
    role: newRole,
    updatedAt: serverTimestamp(),
  });

  const adminName = adminProfile?.displayName || adminUser.displayName || 'Admin';
  logGroupActivity(groupId, 'role_changed', adminUser.uid, adminName, `Changed role of ${targetUid} to ${newRole}`);
  logAnalyticsEvent('group_member_promoted', { groupId, targetUid, newRole });
};

/**
 * Transactional Group Ownership Transfer.
 * Only the current group owner can transfer ownership to another active member.
 */
export const transferOwnership = async (
  groupId: string,
  newOwnerUid: string,
  currentOwnerUser: FirebaseUser,
  currentOwnerProfile?: User | null
): Promise<void> => {
  if (!groupId || !newOwnerUid || !currentOwnerUser) {
    throw new Error('Group ID, new owner UID, and current owner authentication are required.');
  }

  if (newOwnerUid === currentOwnerUser.uid) {
    throw new Error('You are already the owner of this group.');
  }

  const groupRef = doc(db, 'groups', groupId);
  const currentOwnerMemberRef = doc(db, 'groups', groupId, 'members', currentOwnerUser.uid);
  const newOwnerMemberRef = doc(db, 'groups', groupId, 'members', newOwnerUid);

  await runTransaction(db, async (tx) => {
    const currentOwnerSnap = await tx.get(currentOwnerMemberRef);
    if (!currentOwnerSnap.exists() || currentOwnerSnap.data().role !== 'owner') {
      throw new Error('Access denied: Only the current group owner can transfer ownership.');
    }

    const newOwnerSnap = await tx.get(newOwnerMemberRef);
    if (!newOwnerSnap.exists() || newOwnerSnap.data().status === 'banned') {
      throw new Error('Target user must be an active member of the group to receive ownership.');
    }

    tx.update(groupRef, {
      createdBy: newOwnerUid,
      updatedAt: serverTimestamp(),
    });

    tx.update(currentOwnerMemberRef, {
      role: 'admin',
      updatedAt: serverTimestamp(),
    });

    tx.update(newOwnerMemberRef, {
      role: 'owner',
      status: 'active',
      updatedAt: serverTimestamp(),
    });
  });

  const ownerName = currentOwnerProfile?.displayName || currentOwnerUser.displayName || 'Owner';
  logGroupActivity(
    groupId,
    'ownership_transferred',
    currentOwnerUser.uid,
    ownerName,
    `Transferred group ownership to user ${newOwnerUid}`
  );
  logAnalyticsEvent('group_ownership_transferred', { groupId, newOwnerUid });
};

/**
 * Removes a member from a group atomically.
 */
export const removeMember = async (
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
