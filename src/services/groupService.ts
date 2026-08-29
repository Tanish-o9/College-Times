import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  serverTimestamp,
  increment,
  setDoc,
  updateDoc,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import type { CampusGroup, CampusGroupType, GroupMember, UserGroupMembership } from '../types/group';
import { createInviteCodeForGroup } from './groupInviteService';
import { awardReputation } from './reputationService';
import { trackChallengeAction } from './challengeService';
import { logGroupActivityEvent } from './groupActivityService';

export interface PaginatedGroupsResult {
  groups: CampusGroup[];
  lastDoc: QueryDocumentSnapshot | null;
}

export interface PaginatedMembersResult {
  members: GroupMember[];
  lastDoc: QueryDocumentSnapshot | null;
}

const MAX_GROUP_CAPACITY = 10000;

/**
 * Fetches all active public campus groups (bounded up to 50).
 */
export const getPublicGroups = async (): Promise<CampusGroup[]> => {
  try {
    const colRef = collection(db, 'groups');
    const q = query(colRef, where('active', '==', true), limit(50));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      ...(d.data() as CampusGroup),
      id: d.id,
    }));
  } catch (err) {
    console.error('Error fetching public groups:', err);
    return [];
  }
};

/**
 * Cursor-paginated fetching of active public campus groups.
 */
export const getPublicGroupsPage = async (
  pageSize: number = 20,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<PaginatedGroupsResult> => {
  const boundedSize = Math.min(50, Math.max(1, pageSize));
  try {
    const colRef = collection(db, 'groups');
    // Order by createdAt DESC only to avoid composite index requirements
    let q = query(colRef, orderBy('createdAt', 'desc'), limit(boundedSize));

    if (lastDoc) {
      q = query(colRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(boundedSize));
    }

    const snap = await getDocs(q);
    const groups: CampusGroup[] = snap.docs
      .map((d) => ({
        ...(d.data() as CampusGroup),
        id: d.id,
      }))
      .filter((g) => g.active !== false);

    const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    return { groups, lastDoc: newLastDoc };
  } catch (err) {
    console.error('Error fetching paginated public groups:', err);
    return { groups: [], lastDoc: null };
  }
};

/**
 * Fetches a single group by ID.
 */
export const getGroupById = async (groupId: string): Promise<CampusGroup | null> => {
  if (!groupId) return null;
  try {
    const docRef = doc(db, 'groups', groupId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return {
        ...(snap.data() as CampusGroup),
        id: snap.id,
      };
    }
    // Fallback: Query by slug if groupId was passed as slug
    const colRef = collection(db, 'groups');
    const q = query(colRef, where('slug', '==', groupId), limit(1));
    const slugSnap = await getDocs(q);
    if (!slugSnap.empty) {
      const d = slugSnap.docs[0];
      return {
        ...(d.data() as CampusGroup),
        id: d.id,
      };
    }
    return null;
  } catch (err) {
    console.error(`Error fetching group ${groupId}:`, err);
    return null;
  }
};

/**
 * Fetches active groups filtered by type (campus, department, batch, community).
 */
export const getGroupsByType = async (type: CampusGroupType): Promise<CampusGroup[]> => {
  try {
    const colRef = collection(db, 'groups');
    const q = query(colRef, where('type', '==', type), where('active', '==', true), limit(50));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      ...(d.data() as CampusGroup),
      id: d.id,
    }));
  } catch (err) {
    console.error(`Error fetching groups by type ${type}:`, err);
    return [];
  }
};

/**
 * Bounded group search supporting search by name, category, department, batch, or community.
 */
export const searchGroups = async (
  searchQuery: string,
  categoryFilter: string = 'all',
  pageSize: number = 20
): Promise<CampusGroup[]> => {
  const boundedSize = Math.min(50, Math.max(1, pageSize));
  try {
    const colRef = collection(db, 'groups');
    let q = query(colRef, where('active', '==', true), limit(50));

    if (categoryFilter !== 'all') {
      if (['campus', 'department', 'batch', 'community'].includes(categoryFilter)) {
        q = query(colRef, where('type', '==', categoryFilter), where('active', '==', true), limit(50));
      }
    }

    const snap = await getDocs(q);
    let items = snap.docs.map((d) => ({
      ...(d.data() as CampusGroup),
      id: d.id,
    }));

    if (categoryFilter !== 'all' && !['campus', 'department', 'batch', 'community'].includes(categoryFilter)) {
      items = items.filter((g) => g.category?.toLowerCase() === categoryFilter.toLowerCase());
    }

    if (searchQuery.trim()) {
      const term = searchQuery.trim().toLowerCase();
      items = items.filter(
        (g) =>
          g.name.toLowerCase().includes(term) ||
          (g.description && g.description.toLowerCase().includes(term)) ||
          (g.category && g.category.toLowerCase().includes(term)) ||
          (g.departmentId && g.departmentId.toLowerCase().includes(term)) ||
          (g.batchYear && String(g.batchYear).includes(term))
      );
    }

    logAnalyticsEvent('group_search', { queryLength: searchQuery.length, categoryFilter });

    return items.slice(0, boundedSize);
  } catch (err) {
    console.error('Error searching groups:', err);
    return [];
  }
};

/**
 * Utility to hash a string to SHA-256 for secure passcode comparison.
 */
export const hashStringSHA256 = async (str: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Creates a new Campus Group.
 * Any authenticated student can create a group and becomes creator/admin.
 * Automatically generates a unique invite pass code (CT-XXXXXX).
 */
export const createGroup = async (
  payload: Partial<CampusGroup> & { passcode?: string },
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<CampusGroup> => {
  if (!currentUser) {
    throw new Error('Authentication is required to create a campus group.');
  }

  if (!payload.name || payload.name.trim().length === 0) {
    throw new Error('Group name is required.');
  }

  const cleanName = payload.name.trim().slice(0, 80);
  const slug = (payload.slug || cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')).slice(0, 80);
  const groupId = payload.id || `grp_${Date.now()}_${slug.slice(0, 30)}`;
  const groupRef = doc(db, 'groups', groupId);
  const memberRef = doc(db, 'groups', groupId, 'members', currentUser.uid);
  const userMembershipRef = doc(db, 'users', currentUser.uid, 'groupMemberships', groupId);

  const customPasscode = payload.passcode?.trim() || '';
  const hasPassword = customPasscode.length > 0;
  const passcodeHash = hasPassword ? await hashStringSHA256(customPasscode) : undefined;

  const newGroup: CampusGroup = {
    id: groupId,
    name: cleanName,
    slug,
    description: (payload.description || '').trim().slice(0, 500),
    type: payload.type || 'community',
    visibility: payload.visibility || 'public',
    category: payload.category || 'Clubs',
    ...(payload.rules ? { rules: payload.rules.trim().slice(0, 1000) } : {}),
    ...(payload.departmentId ? { departmentId: payload.departmentId } : {}),
    ...(payload.batchYear ? { batchYear: payload.batchYear } : {}),
    ...(payload.iconUrl ? { iconUrl: payload.iconUrl } : {}),
    memberCount: 1,
    active: true,
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    inviteEnabled: true,
    hasPassword,
    ...(passcodeHash ? { passcodeHash } : {}),
  };

  const initialMember: GroupMember = {
    uid: currentUser.uid,
    role: 'admin',
    joinedAt: serverTimestamp(),
    points: 0,
    ...(userProfile?.displayName ? { displayName: userProfile.displayName } : {}),
    ...(userProfile?.photoURL ? { photoURL: userProfile.photoURL } : {}),
  };

  const userLookupData: UserGroupMembership = {
    groupId,
    joinedAt: serverTimestamp(),
  };

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(groupRef);
    if (snap.exists()) {
      throw new Error(`Group with ID '${groupId}' already exists.`);
    }
    transaction.set(groupRef, newGroup);
    transaction.set(memberRef, initialMember);
    transaction.set(userMembershipRef, userLookupData);
  });

  // Generate initial unique invite pass code (CT-XXXXXX)
  try {
    const inviteCode = await createInviteCodeForGroup(groupId, currentUser.uid);
    newGroup.inviteCodePlaintext = inviteCode;
    newGroup.inviteCodeHash = inviteCode;
  } catch (err) {
    console.warn(`Initial invite code generation notice for group ${groupId}:`, err);
  }

  logAnalyticsEvent('group_created', { groupType: newGroup.type, visibility: newGroup.visibility });

  return {
    ...newGroup,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

/**
 * Updates an existing group document (owner/admin only).
 */
export const updateGroup = async (
  groupId: string,
  updates: Partial<CampusGroup>,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser) {
    throw new Error('Authentication required.');
  }

  const groupRef = doc(db, 'groups', groupId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(groupRef);
    if (!snap.exists()) {
      throw new Error(`Group '${groupId}' not found.`);
    }

    const groupData = snap.data() as CampusGroup;
    if (groupData.createdBy !== currentUser.uid && userProfile?.role !== 'admin') {
      throw new Error('Only group creators or campus admins can modify group settings.');
    }

    const cleanedUpdates = {
      ...updates,
      updatedAt: serverTimestamp(),
    };
    delete cleanedUpdates.id;
    delete cleanedUpdates.createdBy;
    delete cleanedUpdates.memberCount;

    transaction.update(groupRef, cleanedUpdates);
  });
};

/**
 * Deactivates a group (soft deletion).
 */
export const deactivateGroup = async (
  groupId: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  await updateGroup(groupId, { active: false }, currentUser, userProfile);
};

/**
 * Atomically joins a public group.
 * Enforces 10,000 max capacity check.
 */
export const joinGroup = async (
  groupId: string,
  currentUser: FirebaseUser,
  userProfile?: User | null,
  enteredPasscode?: string
): Promise<void> => {
  if (!groupId || !currentUser) return;

  const uid = currentUser.uid;
  const groupRef = doc(db, 'groups', groupId);
  const memberRef = doc(db, 'groups', groupId, 'members', uid);
  const userMembershipRef = doc(db, 'users', uid, 'groupMemberships', groupId);
  const banRef = doc(db, 'groups', groupId, 'bannedMembers', uid);

  const trimmedPasscode = enteredPasscode?.trim() || '';
  const enteredPasscodeHash = trimmedPasscode ? await hashStringSHA256(trimmedPasscode) : '';
  const enteredPasscodeHashLower = trimmedPasscode ? await hashStringSHA256(trimmedPasscode.toLowerCase()) : '';

  // 1. Fetch group metadata
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) {
    throw new Error('Group not found.');
  }

  const groupData = groupSnap.data() as CampusGroup;
  if (!groupData.active) {
    throw new Error('Group is currently unavailable for new members.');
  }

  const banSnap = await getDoc(banRef).catch(() => null);
  if (banSnap && banSnap.exists()) {
    throw new Error('Access denied: You are banned from joining this group.');
  }

  // 2. Verify passcode/password if enabled
  const hasGroupPassword = Boolean(groupData.hasPassword || groupData.passcodeHash || (groupData as any).passcode);
  if (hasGroupPassword) {
    if (!trimmedPasscode) {
      throw new Error('This group is password-protected. Please enter the passcode.');
    }
    const isPasscodeMatch =
      (groupData.passcodeHash && enteredPasscodeHash === groupData.passcodeHash) ||
      (groupData.passcodeHash && enteredPasscodeHashLower === groupData.passcodeHash) ||
      ((groupData as any).passcode && trimmedPasscode.toLowerCase() === String((groupData as any).passcode).trim().toLowerCase()) ||
      (groupData.inviteCodePlaintext && trimmedPasscode.toUpperCase() === groupData.inviteCodePlaintext.trim().toUpperCase()) ||
      (groupData.inviteCodeHash && trimmedPasscode.toUpperCase() === groupData.inviteCodeHash.trim().toUpperCase());

    if (!isPasscodeMatch) {
      throw new Error('Incorrect group passcode.');
    }
  } else if (groupData.visibility === 'private') {
    const isCodeMatch =
      !trimmedPasscode ||
      (groupData.inviteCodePlaintext && trimmedPasscode.toUpperCase() === groupData.inviteCodePlaintext.trim().toUpperCase()) ||
      (groupData.inviteCodeHash && trimmedPasscode.toUpperCase() === groupData.inviteCodeHash.trim().toUpperCase());

    if (!isCodeMatch) {
      throw new Error('This group is private. Please join using an invite pass code.');
    }
  }

  const currentCount = groupData.memberCount || 0;
  if (currentCount >= MAX_GROUP_CAPACITY) {
    throw new Error('Group has reached its maximum capacity of 10,000 members.');
  }

  // Check if already a member
  const memberSnap = await getDoc(memberRef).catch(() => null);
  if (memberSnap && memberSnap.exists()) {
    return;
  }

  // 3. Create group member document
  const memberData: GroupMember = {
    uid,
    role: 'member',
    joinedAt: serverTimestamp(),
    points: 0,
    ...(userProfile?.displayName ? { displayName: userProfile.displayName } : {}),
    ...(userProfile?.photoURL ? { photoURL: userProfile.photoURL } : {}),
  };

  const userLookupData: UserGroupMembership = {
    groupId,
    joinedAt: serverTimestamp(),
  };

  await setDoc(memberRef, memberData);

  // Background non-blocking updates
  setDoc(userMembershipRef, userLookupData).catch((err: any) => console.warn('userMembership write notice:', err));
  updateDoc(groupRef, {
    memberCount: increment(1),
    updatedAt: serverTimestamp(),
  }).catch((err: any) => console.warn('group memberCount update notice:', err));

  // 4. Non-critical secondary side-effects
  logGroupActivityEvent(
    groupId,
    'membership_change',
    currentUser.uid,
    userProfile?.displayName || currentUser.displayName || 'Student',
    userProfile?.photoURL || currentUser.photoURL || undefined,
    undefined,
    undefined,
    'joined the group'
  ).catch((e) => console.warn('Activity log notice:', e));

  awardReputation(currentUser.uid, groupId, 'join_group', 5, 'Joined a campus group').catch((e) => console.warn('Reputation notice:', e));
  trackChallengeAction(currentUser.uid, 'groups', 1).catch((e) => console.warn('Challenge notice:', e));
  logAnalyticsEvent('group_joined', { groupType: groupData.type, groupId });
};

/**
 * Atomically leaves a group.
 */
export const leaveGroup = async (groupId: string, uid: string): Promise<void> => {
  if (!groupId || !uid) return;

  const groupRef = doc(db, 'groups', groupId);
  const memberRef = doc(db, 'groups', groupId, 'members', uid);
  const userMembershipRef = doc(db, 'users', uid, 'groupMemberships', groupId);

  let groupType: CampusGroupType = 'community';

  await runTransaction(db, async (transaction) => {
    const groupSnap = await transaction.get(groupRef);
    const memberSnap = await transaction.get(memberRef);

    if (!memberSnap.exists()) {
      // Not a member — idempotent return
      return;
    }

    if (groupSnap.exists()) {
      const groupData = groupSnap.data() as CampusGroup;
      groupType = groupData.type;
      const currentCount = groupData.memberCount || 0;
      const newCount = Math.max(0, currentCount - 1);

      transaction.update(groupRef, {
        memberCount: newCount,
        updatedAt: serverTimestamp(),
      });
    }

    transaction.delete(memberRef);
    transaction.delete(userMembershipRef);
  });

  await logGroupActivityEvent(
    groupId,
    'membership_change',
    uid,
    'Student',
    undefined,
    undefined,
    undefined,
    'left the group'
  );

  logAnalyticsEvent('group_left', { groupType, groupId });
};

/**
 * Checks if user is a member of specified group.
 */
export const isGroupMember = async (groupId: string, uid: string): Promise<boolean> => {
  if (!groupId || !uid) return false;
  try {
    const memberRef = doc(db, 'groups', groupId, 'members', uid);
    const snap = await getDoc(memberRef);
    return snap.exists();
  } catch (err) {
    return false;
  }
};

/**
 * Fetches cursor-paginated member list for a group (max 50 per page).
 */
export const getGroupMembersPage = async (
  groupId: string,
  pageSize: number = 20,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<PaginatedMembersResult> => {
  const boundedSize = Math.min(50, Math.max(1, pageSize));
  try {
    const colRef = collection(db, 'groups', groupId, 'members');
    let q = query(colRef, orderBy('joinedAt', 'desc'), limit(boundedSize));

    if (lastDoc) {
      q = query(colRef, orderBy('joinedAt', 'desc'), startAfter(lastDoc), limit(boundedSize));
    }

    const snap = await getDocs(q);
    const members: GroupMember[] = snap.docs.map((d) => ({
      ...(d.data() as GroupMember),
      uid: d.id,
    }));

    const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    return { members, lastDoc: newLastDoc };
  } catch (err) {
    console.error(`Error fetching members for group ${groupId}:`, err);
    return { members: [], lastDoc: null };
  }
};

/**
 * Reads user group lookup index users/{uid}/groupMemberships (bounded query).
 * Returns array of group IDs joined by the user.
 */
export const getUserGroupIds = async (uid: string): Promise<string[]> => {
  if (!uid) return [];
  try {
    const colRef = collection(db, 'users', uid, 'groupMemberships');
    const snap = await getDocs(query(colRef, limit(100)));
    return snap.docs.map((d) => d.id);
  } catch (err) {
    console.error(`Error fetching user group IDs for ${uid}:`, err);
    return [];
  }
};

/**
 * Seeds standard campus groups (CSE, ECE, IT, AIML, ME, CE, Batch 2026-2029) if not present.
 */
export const seedStandardCampusGroups = async (
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser) return;

  const defaultGroups: Partial<CampusGroup>[] = [
    { id: 'all-campus', name: 'All Campus Students', slug: 'all-campus', type: 'campus', category: 'Campus Life', description: 'Campus-wide official group for all students.' },
    { id: 'cse', name: 'Computer Science & Engineering', slug: 'cse', type: 'department', category: 'Department', departmentId: 'cse', description: 'Official CSE department group.' },
    { id: 'ece', name: 'Electronics & Communication', slug: 'ece', type: 'department', category: 'Department', departmentId: 'ece', description: 'Official ECE department group.' },
    { id: 'it', name: 'Information Technology', slug: 'it', type: 'department', category: 'Department', departmentId: 'it', description: 'Official IT department group.' },
    { id: 'aiml', name: 'AI & Machine Learning', slug: 'aiml', type: 'department', category: 'Department', departmentId: 'aiml', description: 'Official AIML department group.' },
    { id: 'batch-2026', name: 'Batch 2026', slug: 'batch-2026', type: 'batch', category: 'Batch', batchYear: 2026, description: 'Students graduating in 2026.' },
    { id: 'batch-2027', name: 'Batch 2027', slug: 'batch-2027', type: 'batch', category: 'Batch', batchYear: 2027, description: 'Students graduating in 2027.' },
    { id: 'batch-2028', name: 'Batch 2028', slug: 'batch-2028', type: 'batch', category: 'Batch', batchYear: 2028, description: 'Students graduating in 2028.' },
    { id: 'batch-2029', name: 'Batch 2029', slug: 'batch-2029', type: 'batch', category: 'Batch', batchYear: 2029, description: 'Students graduating in 2029.' },
  ];

  for (const g of defaultGroups) {
    try {
      await createGroup(g, currentUser, userProfile);
    } catch (e) {
      // Group may already exist — skip
    }
  }
};

export interface GroupWelcomeConfig {
  welcomeMessage: string;
  checklistItems: string[];
}

/**
 * Fetches the welcome onboarding configuration for a group.
 */
export const getGroupWelcomeConfig = async (groupId: string): Promise<GroupWelcomeConfig | null> => {
  try {
    const docRef = doc(db, 'groups', groupId, 'settings', 'welcome');
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as GroupWelcomeConfig;
  } catch {
    return null;
  }
};

/**
 * Saves or updates the welcome onboarding configuration for a group.
 */
export const saveGroupWelcomeConfig = async (
  groupId: string,
  config: GroupWelcomeConfig
): Promise<void> => {
  const docRef = doc(db, 'groups', groupId, 'settings', 'welcome');
  await setDoc(docRef, config, { merge: true });
};
