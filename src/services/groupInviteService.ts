import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import type { CampusGroup, GroupMember, UserGroupMembership, GroupInviteCodeDoc } from '../types/group';

const MAX_GROUP_CAPACITY = 10000;

/**
 * Generates a random alphanumeric code of specified length.
 */
const generateRandomCode = (length: number = 6): string => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude visually ambiguous chars (0, O, 1, I)
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
};

/**
 * Generates a cryptographically random unique group invite pass code (e.g. CT-7K4P9X).
 */
export const generateUniqueInviteCode = async (): Promise<string> => {
  let attempts = 0;
  while (attempts < 10) {
    attempts++;
    const code = `CT-${generateRandomCode(6)}`;
    const codeRef = doc(db, 'groupInviteCodes', code);
    const snap = await getDoc(codeRef);
    if (!snap.exists()) {
      return code;
    }
  }
  // Fallback with timestamp suffix if collisions occur
  return `CT-${generateRandomCode(4)}${Date.now().toString(36).slice(-2).toUpperCase()}`;
};

/**
 * Creates and registers a new invite code for a group.
 */
export const createInviteCodeForGroup = async (
  groupId: string,
  currentUserUid: string
): Promise<string> => {
  const code = await generateUniqueInviteCode();
  const codeRef = doc(db, 'groupInviteCodes', code);
  const groupRef = doc(db, 'groups', groupId);

  const inviteDoc: GroupInviteCodeDoc = {
    code,
    groupId,
    active: true,
    createdAt: serverTimestamp(),
    createdBy: currentUserUid,
  };

  await setDoc(codeRef, inviteDoc);
  await updateDoc(groupRef, {
    inviteCodePlaintext: code,
    inviteCodeHash: code, // Lookup token
    inviteCodeVersion: increment(1),
    inviteEnabled: true,
    updatedAt: serverTimestamp(),
  }).catch(() => {});

  return code;
};

/**
 * Resolves a normalized pass code to its target group ID.
 * Returns null for invalid or inactive codes.
 */
export const resolveGroupInviteCode = async (
  passCode: string
): Promise<{ groupId: string; active: boolean } | null> => {
  if (!passCode) return null;
  const normalized = passCode.trim().toUpperCase();

  try {
    const codeRef = doc(db, 'groupInviteCodes', normalized);
    const snap = await getDoc(codeRef);
    if (!snap.exists()) return null;

    const data = snap.data() as GroupInviteCodeDoc;
    if (!data.active) return null;

    return { groupId: data.groupId, active: data.active };
  } catch (err) {
    console.error('Error resolving group invite code:', err);
    return null;
  }
};

/**
 * Atomic transaction to join a group using a pass code.
 * Validates group status, capacity (10,000 max), and invitation validity.
 */
export const joinGroupWithPassCode = async (
  passCode: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<{ groupId: string; groupName: string }> => {
  if (!passCode || !currentUser) {
    throw new Error('Invalid or expired group code.');
  }

  const resolved = await resolveGroupInviteCode(passCode);
  if (!resolved || !resolved.active) {
    throw new Error('Invalid or expired group code.');
  }

  const { groupId } = resolved;
  const uid = currentUser.uid;
  const groupRef = doc(db, 'groups', groupId);
  const memberRef = doc(db, 'groups', groupId, 'members', uid);
  const userMembershipRef = doc(db, 'users', uid, 'groupMemberships', groupId);

  let groupName = 'Campus Group';

  await runTransaction(db, async (transaction) => {
    const groupSnap = await transaction.get(groupRef);
    if (!groupSnap.exists()) {
      throw new Error('Invalid or expired group code.');
    }

    const banRef = doc(db, 'groups', groupId, 'bannedMembers', uid);
    const banSnap = await transaction.get(banRef);
    if (banSnap.exists()) {
      throw new Error('Access denied: You are banned from joining this campus group.');
    }

    const groupData = groupSnap.data() as CampusGroup;
    if (!groupData.active || groupData.inviteEnabled === false) {
      throw new Error('Invalid or expired group code.');
    }

    groupName = groupData.name;

    const currentCount = groupData.memberCount || 0;
    if (currentCount >= MAX_GROUP_CAPACITY) {
      throw new Error('Group has reached its maximum capacity of 10,000 members.');
    }

    const memberSnap = await transaction.get(memberRef);
    if (memberSnap.exists()) {
      // User is already a member
      return;
    }

    const memberData: GroupMember = {
      uid,
      role: 'member',
      joinedAt: serverTimestamp(),
      ...(userProfile?.displayName ? { displayName: userProfile.displayName } : {}),
      ...(userProfile?.photoURL ? { photoURL: userProfile.photoURL } : {}),
    };

    const userLookupData: UserGroupMembership = {
      groupId,
      joinedAt: serverTimestamp(),
    };

    transaction.set(memberRef, memberData);
    transaction.set(userMembershipRef, userLookupData);
    transaction.update(groupRef, {
      memberCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  });

  logAnalyticsEvent('group_invite_code_used', { groupId });
  logAnalyticsEvent('group_joined', { groupId });

  return { groupId, groupName };
};

/**
 * Regenerates the invite pass code for a group (owner/admin only).
 * Deactivates the previous invite code immediately.
 */
export const regenerateGroupInviteCode = async (
  groupId: string,
  currentUser: FirebaseUser
): Promise<string> => {
  if (!groupId || !currentUser) {
    throw new Error('Unauthorized');
  }

  const groupRef = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) {
    throw new Error('Group not found');
  }

  const groupData = groupSnap.data() as CampusGroup;
  if (groupData.createdBy !== currentUser.uid) {
    throw new Error('Only the group creator can regenerate invite codes.');
  }

  // Deactivate old code if present
  if (groupData.inviteCodePlaintext) {
    const oldCodeRef = doc(db, 'groupInviteCodes', groupData.inviteCodePlaintext);
    await updateDoc(oldCodeRef, { active: false }).catch(() => {});
  }

  const newCode = await createInviteCodeForGroup(groupId, currentUser.uid);

  logAnalyticsEvent('group_invite_regenerated', { groupId });

  return newCode;
};

/**
 * Toggles whether invite code joining is enabled for a group.
 */
export const toggleGroupInviteEnabled = async (
  groupId: string,
  enabled: boolean,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!groupId || !currentUser) return;

  const groupRef = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) return;

  const groupData = groupSnap.data() as CampusGroup;
  if (groupData.createdBy !== currentUser.uid) {
    throw new Error('Only group creators can update invite settings.');
  }

  await updateDoc(groupRef, {
    inviteEnabled: enabled,
    updatedAt: serverTimestamp(),
  });

  logAnalyticsEvent(enabled ? 'group_invite_enabled' : 'group_invite_disabled', { groupId });
};
