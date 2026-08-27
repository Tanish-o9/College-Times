import {
  doc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  runTransaction,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import { logGroupActivity } from './groupManagementService';

export interface GroupBannedMember {
  userId: string;
  bannedBy: string;
  reason: string;
  createdAt: any;
}

/**
 * Checks if a user is banned from a campus group.
 */
export const isUserBannedFromGroup = async (groupId: string, userId: string): Promise<boolean> => {
  if (!groupId || !userId) return false;

  try {
    const banRef = doc(db, 'groups', groupId, 'bannedMembers', userId);
    const snap = await getDoc(banRef);
    return snap.exists();
  } catch (err) {
    console.error(`Error checking ban status for user ${userId} in group ${groupId}:`, err);
    return false;
  }
};

/**
 * Bans a user from a group and revokes membership, group chat, instant, and invite pass access.
 */
export const banMemberFromGroup = async (
  groupId: string,
  targetUid: string,
  reason: string,
  adminUser: FirebaseUser,
  adminProfile?: User | null
): Promise<void> => {
  if (!groupId || !targetUid || !adminUser) return;

  const banRef = doc(db, 'groups', groupId, 'bannedMembers', targetUid);
  const memberRef = doc(db, 'groups', groupId, 'members', targetUid);
  const userMembershipRef = doc(db, 'users', targetUid, 'groupMemberships', groupId);
  const groupRef = doc(db, 'groups', groupId);

  await runTransaction(db, async (tx) => {
    tx.set(banRef, {
      userId: targetUid,
      bannedBy: adminUser.uid,
      reason: reason || 'Violation of community rules',
      createdAt: serverTimestamp(),
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
 * Unbans a previously banned user.
 */
export const unbanMemberFromGroup = async (
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
