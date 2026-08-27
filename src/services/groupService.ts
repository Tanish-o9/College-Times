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
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import type { CampusGroup, CampusGroupType, GroupMember, UserGroupMembership } from '../types/group';

export interface PaginatedMembersResult {
  members: GroupMember[];
  lastDoc: QueryDocumentSnapshot | null;
}

/**
 * Fetches all active public campus groups.
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
 * Fetches a single group by ID.
 */
export const getGroupById = async (groupId: string): Promise<CampusGroup | null> => {
  if (!groupId) return null;
  try {
    const docRef = doc(db, 'groups', groupId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return {
      ...(snap.data() as CampusGroup),
      id: snap.id,
    };
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
 * Admin-only: Creates a new Campus Group.
 */
export const createGroup = async (
  payload: Partial<CampusGroup>,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<CampusGroup> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Group creation is restricted to campus administrators.');
  }

  if (!payload.name || payload.name.trim().length === 0) {
    throw new Error('Group name is required.');
  }

  const slug = (payload.slug || payload.name.toLowerCase().replace(/[^a-z0-9]/g, '-')).slice(0, 80);
  const groupId = payload.id || slug;
  const groupRef = doc(db, 'groups', groupId);

  const newGroup: CampusGroup = {
    id: groupId,
    name: payload.name.trim().slice(0, 80),
    slug,
    description: (payload.description || '').trim().slice(0, 500),
    type: payload.type || 'community',
    visibility: payload.visibility || 'public',
    ...(payload.departmentId ? { departmentId: payload.departmentId } : {}),
    ...(payload.batchYear ? { batchYear: payload.batchYear } : {}),
    ...(payload.iconUrl ? { iconUrl: payload.iconUrl } : {}),
    memberCount: 0,
    active: true,
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(groupRef);
    if (snap.exists()) {
      throw new Error(`Group with ID or slug '${groupId}' already exists.`);
    }
    transaction.set(groupRef, newGroup);
  });

  logAnalyticsEvent('group_created', { groupType: newGroup.type });

  return {
    ...newGroup,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

/**
 * Admin-only: Updates an existing group document.
 */
export const updateGroup = async (
  groupId: string,
  updates: Partial<CampusGroup>,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!currentUser || userProfile?.role !== 'admin') {
    throw new Error('Group mutation is restricted to campus administrators.');
  }

  const groupRef = doc(db, 'groups', groupId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(groupRef);
    if (!snap.exists()) {
      throw new Error(`Group '${groupId}' not found.`);
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
 * Admin-only: Deactivates a group (soft deletion).
 */
export const deactivateGroup = async (
  groupId: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  await updateGroup(groupId, { active: false }, currentUser, userProfile);
};

/**
 * Atomically joins a group.
 * Canonical membership document: groups/{groupId}/members/{uid}
 * Denormalized user lookup index: users/{uid}/groupMemberships/{groupId}
 */
export const joinGroup = async (
  groupId: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!groupId || !currentUser) return;

  const uid = currentUser.uid;
  const groupRef = doc(db, 'groups', groupId);
  const memberRef = doc(db, 'groups', groupId, 'members', uid);
  const userMembershipRef = doc(db, 'users', uid, 'groupMemberships', groupId);

  let groupType: CampusGroupType = 'community';

  await runTransaction(db, async (transaction) => {
    const groupSnap = await transaction.get(groupRef);
    if (!groupSnap.exists()) {
      throw new Error('Group does not exist.');
    }

    const groupData = groupSnap.data() as CampusGroup;
    if (!groupData.active) {
      throw new Error('Cannot join an inactive group.');
    }
    groupType = groupData.type;

    const memberSnap = await transaction.get(memberRef);
    if (memberSnap.exists()) {
      // Already a member — return safely without double-incrementing counter
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

  logAnalyticsEvent('group_joined', { groupType });
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

  logAnalyticsEvent('group_left', { groupType });
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
  if (!currentUser || userProfile?.role !== 'admin') return;

  const defaultGroups: Partial<CampusGroup>[] = [
    { id: 'all-campus', name: 'All Campus Students', slug: 'all-campus', type: 'campus', description: 'Campus-wide official group for all students.' },
    { id: 'cse', name: 'Computer Science & Engineering', slug: 'cse', type: 'department', departmentId: 'cse', description: 'Official CSE department group.' },
    { id: 'ece', name: 'Electronics & Communication', slug: 'ece', type: 'department', departmentId: 'ece', description: 'Official ECE department group.' },
    { id: 'it', name: 'Information Technology', slug: 'it', type: 'department', departmentId: 'it', description: 'Official IT department group.' },
    { id: 'aiml', name: 'AI & Machine Learning', slug: 'aiml', type: 'department', departmentId: 'aiml', description: 'Official AIML department group.' },
    { id: 'batch-2026', name: 'Batch 2026', slug: 'batch-2026', type: 'batch', batchYear: 2026, description: 'Students graduating in 2026.' },
    { id: 'batch-2027', name: 'Batch 2027', slug: 'batch-2027', type: 'batch', batchYear: 2027, description: 'Students graduating in 2027.' },
    { id: 'batch-2028', name: 'Batch 2028', slug: 'batch-2028', type: 'batch', batchYear: 2028, description: 'Students graduating in 2028.' },
    { id: 'batch-2029', name: 'Batch 2029', slug: 'batch-2029', type: 'batch', batchYear: 2029, description: 'Students graduating in 2029.' },
  ];

  for (const g of defaultGroups) {
    try {
      await createGroup(g, currentUser, userProfile);
    } catch (e) {
      // Group may already exist — skip
    }
  }
};
