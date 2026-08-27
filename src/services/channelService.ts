import { 
  collection, 
  doc, 
  query, 
  getDocs, 
  getDoc, 
  orderBy, 
  runTransaction, 
  increment, 
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  limit
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { Channel, ChannelCategory, ChannelType, ChannelMember } from '../types/chat';
import type { User } from '../types';

export interface CreateChannelPayload {
  name: string;
  description: string;
  category: ChannelCategory;
  type: ChannelType;
  topic?: string;
}

/**
 * Fetches public channels ordered by memberCount descending.
 * Excludes admin-only announcement channels if requested for discovery.
 */
export const getPublicChannels = async (limitCount: number = 50): Promise<Channel[]> => {
  try {
    const channelsRef = collection(db, 'channels');
    const q = query(channelsRef, orderBy('memberCount', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);

    return snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Channel[];
  } catch (error) {
    console.error('Error fetching public channels:', error);
    throw error;
  }
};

/**
 * Fetches a single channel document by ID.
 */
export const getChannelById = async (channelId: string): Promise<Channel | null> => {
  try {
    const channelRef = doc(db, 'channels', channelId);
    const snap = await getDoc(channelRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Channel;
    }

    if (channelId.startsWith('group-')) {
      const groupId = channelId.replace('group-', '');
      const groupRef = doc(db, 'groups', groupId);
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        const groupData = groupSnap.data();
        return {
          id: channelId,
          name: `${groupData.name} Chat`,
          description: `Dedicated private group chat for ${groupData.name}.`,
          category: 'group',
          type: 'group',
          groupId,
          createdAt: groupData.createdAt,
          createdBy: groupData.createdBy,
          memberCount: groupData.memberCount || 1,
        } as Channel;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching channel ${channelId}:`, error);
    throw error;
  }
};

/**
 * Creates a new channel document (Admin only).
 */
export const createChannel = async (
  payload: CreateChannelPayload,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<Channel> => {
  if (userProfile?.role !== 'admin') {
    throw new Error('Only campus administrators can create new community channels.');
  }

  try {
    const channelsRef = collection(db, 'channels');
    const newChannelRef = doc(channelsRef);

    const channelData: Channel = {
      id: newChannelRef.id,
      name: payload.name.trim(),
      description: payload.description.trim(),
      category: payload.category,
      type: payload.type,
      topic: payload.topic?.trim() || '',
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid,
      memberCount: 1,
      isArchived: false,
    };

    const memberRef = doc(db, 'channels', newChannelRef.id, 'members', currentUser.uid);
    const userRef = doc(db, 'users', currentUser.uid);

    await runTransaction(db, async (transaction) => {
      transaction.set(newChannelRef, channelData);
      transaction.set(memberRef, {
        channelId: newChannelRef.id,
        userId: currentUser.uid,
        role: 'admin',
        joinedAt: serverTimestamp(),
        lastReadAt: serverTimestamp(),
        muted: false,
      });
      transaction.update(userRef, {
        joinedChannelIds: arrayUnion(newChannelRef.id),
      });
    });

    return {
      ...channelData,
      createdAt: new Date(),
    };
  } catch (error: any) {
    console.error('Error creating channel:', error);
    throw new Error(error.message || 'Failed to create community channel.');
  }
};

/**
 * Transactionally joins a user to a channel.
 * Verifies channel exists, verifies membership does not already exist,
 * creates member doc, increments memberCount, and updates user's joinedChannelIds.
 */
export const joinChannel = async (channelId: string, userId: string): Promise<void> => {
  if (!channelId || !userId) return;

  const channelRef = doc(db, 'channels', channelId);
  const memberRef = doc(db, 'channels', channelId, 'members', userId);
  const userRef = doc(db, 'users', userId);

  await runTransaction(db, async (transaction) => {
    const channelSnap = await transaction.get(channelRef);
    if (!channelSnap.exists()) {
      throw new Error(`Channel ${channelId} does not exist.`);
    }

    const memberSnap = await transaction.get(memberRef);
    if (memberSnap.exists()) return; // Idempotent: already joined

    transaction.set(memberRef, {
      channelId,
      userId,
      role: 'member',
      joinedAt: serverTimestamp(),
      lastReadAt: serverTimestamp(),
      muted: false,
    });

    transaction.update(channelRef, {
      memberCount: increment(1),
    });

    transaction.update(userRef, {
      joinedChannelIds: arrayUnion(channelId),
    });
  });

  logAnalyticsEvent('channel_joined', { channelId });
};

/**
 * Transactionally leaves a channel.
 * Verifies membership exists, prevents students from leaving admin-announcements,
 * deletes member doc, decrements memberCount, and removes channelId from user's joinedChannelIds.
 */
export const leaveChannel = async (
  channelId: string, 
  userId: string, 
  userRole: string = 'student'
): Promise<void> => {
  if (!channelId || !userId) return;

  if ((channelId === 'admin-announcements' || channelId.includes('announcement')) && userRole !== 'admin') {
    throw new Error('Students cannot leave official campus announcement channels.');
  }

  const channelRef = doc(db, 'channels', channelId);
  const memberRef = doc(db, 'channels', channelId, 'members', userId);
  const userRef = doc(db, 'users', userId);

  await runTransaction(db, async (transaction) => {
    const memberSnap = await transaction.get(memberRef);
    if (!memberSnap.exists()) return; // Idempotent: not a member

    const channelSnap = await transaction.get(channelRef);
    const currentCount = channelSnap.exists() ? (channelSnap.data().memberCount || 0) : 0;
    const newCount = Math.max(0, currentCount - 1);

    transaction.delete(memberRef);

    if (channelSnap.exists()) {
      transaction.update(channelRef, {
        memberCount: newCount,
      });
    }

    transaction.update(userRef, {
      joinedChannelIds: arrayRemove(channelId),
    });
  });
};

/**
 * Fetches user's joined channels by resolving joinedChannelIds array from users/{uid}.
 * STRICT SCALE RULE: Does NOT use collectionGroup("members").
 */
export const getMyChannels = async (userId: string): Promise<Channel[]> => {
  if (!userId) return [];

  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return [];

    const joinedChannelIds: string[] = userSnap.data().joinedChannelIds || [];
    if (joinedChannelIds.length === 0) return [];

    // Resolve channel documents individually (max 100 channels)
    const channelSnaps = await Promise.all(
      joinedChannelIds.map((cId) => getDoc(doc(db, 'channels', cId)))
    );

    return channelSnaps
      .filter((snap) => snap.exists())
      .map((snap) => ({
        id: snap.id,
        ...snap.data(),
      })) as Channel[];
  } catch (error) {
    console.error('Error fetching joined channels:', error);
    throw error;
  }
};

/**
 * Fetches user's membership documents for joined channels to get lastReadAt timestamps.
 */
export const getMyMemberships = async (userId: string, channelIds: string[]): Promise<Record<string, ChannelMember>> => {
  if (!userId || channelIds.length === 0) return {};

  try {
    const memberSnaps = await Promise.all(
      channelIds.map((cId) => getDoc(doc(db, 'channels', cId, 'members', userId)))
    );

    const membershipMap: Record<string, ChannelMember> = {};
    memberSnaps.forEach((snap, idx) => {
      if (snap.exists()) {
        membershipMap[channelIds[idx]] = snap.data() as ChannelMember;
      }
    });

    return membershipMap;
  } catch (error) {
    console.error('Error fetching channel memberships:', error);
    return {};
  }
};
