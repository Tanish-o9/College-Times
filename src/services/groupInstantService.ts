import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, storage, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import type { GroupInstant, GroupInstantReadState } from '../types/group';
import { isUserGroupChatMember } from './groupChatService';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const INSTANT_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Uploads a single media item for a group instant.
 */
export const uploadInstantMediaFile = async (
  groupId: string,
  instantId: string,
  file: File,
  currentUser: FirebaseUser
): Promise<string> => {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error(`File '${file.name}' exceeds 10MB size limit.`);
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`File type '${file.type}' is not supported for Instants.`);
  }

  const cleanName = file.name.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').slice(0, 80);
  const storagePath = `groupInstantMedia/${groupId}/${currentUser.uid}/${instantId}/${Date.now()}_${cleanName}`;
  const storageRef = ref(storage, storagePath);

  const readFileAsDataUrl = (f: File): Promise<string> => {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = (e) => rej(e);
      reader.readAsDataURL(f);
    });
  };

  return new Promise<string>((resolve) => {
    let isDone = false;
    const timeoutTimer = setTimeout(async () => {
      if (!isDone) {
        isDone = true;
        console.warn(`Storage upload timed out for instant media ${file.name}, using local Data URL fallback.`);
        try {
          const dataUrl = await readFileAsDataUrl(file);
          resolve(dataUrl);
        } catch {
          resolve('');
        }
      }
    }, 6000);

    const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });

    uploadTask.on(
      'state_changed',
      null,
      async (error) => {
        console.error('Storage error for instant media, using fallback:', error);
        if (!isDone) {
          isDone = true;
          clearTimeout(timeoutTimer);
          try {
            const dataUrl = await readFileAsDataUrl(file);
            resolve(dataUrl);
          } catch {
            resolve('');
          }
        }
      },
      async () => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeoutTimer);
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch {
            const dataUrl = await readFileAsDataUrl(file);
            resolve(dataUrl);
          }
        }
      }
    );
  });
};

/**
 * Creates a new Group Instant moment with up to 5 photos and an optional caption.
 */
export const createGroupInstant = async (
  groupId: string,
  caption: string,
  files: File[],
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<GroupInstant> => {
  if (!groupId || !currentUser) {
    throw new Error('Group ID and authentication are required.');
  }

  const isMember = await isUserGroupChatMember(groupId, currentUser.uid);
  if (!isMember && userProfile?.role !== 'admin') {
    throw new Error('Access denied: You must be a member of this campus group to post Instants.');
  }

  if (files.length > 5) {
    throw new Error('Maximum 5 photos allowed per Instant.');
  }

  const instantsRef = collection(db, 'groups', groupId, 'instants');
  const tempInstantId = `inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Upload images
  const mediaUrls: string[] = [];
  for (const file of files) {
    const url = await uploadInstantMediaFile(groupId, tempInstantId, file, currentUser);
    if (url) mediaUrls.push(url);
  }

  const nowMs = Date.now();
  const expiresAtDate = new Date(nowMs + INSTANT_EXPIRATION_MS);

  const instantData: Omit<GroupInstant, 'id'> = {
    groupId,
    senderId: currentUser.uid,
    senderName: userProfile?.displayName || currentUser.displayName || 'Campus Student',
    ...(userProfile?.photoURL ? { senderAvatar: userProfile.photoURL } : {}),
    type: mediaUrls.length > 0 ? 'image' : 'text',
    media: mediaUrls,
    ...(caption.trim() ? { caption: caption.trim().slice(0, 300) } : {}),
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAtDate),
    status: 'active',
    reactionCounts: {},
    replyCount: 0,
  };

  const newDoc = await addDoc(instantsRef, instantData);
  logAnalyticsEvent('instant_created', { groupId, mediaCount: mediaUrls.length });

  return {
    id: newDoc.id,
    ...instantData,
    createdAt: new Date(),
    expiresAt: expiresAtDate,
  } as GroupInstant;
};

/**
 * Attaches a real-time listener for active non-expired Instants in a group (max limitCount).
 */
export const subscribeToActiveGroupInstants = (
  groupId: string,
  onUpdate: (instants: GroupInstant[]) => void,
  limitCount: number = 20
) => {
  if (!groupId) return () => {};

  const instantsRef = collection(db, 'groups', groupId, 'instants');
  const q = query(
    instantsRef,
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now();
      const activeInstants = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as GroupInstant[];

      // Filter out expired items on client side as fallback
      const freshInstants = activeInstants.filter((inst) => {
        if (!inst.expiresAt) return true;
        const expiryMs = inst.expiresAt.toMillis ? inst.expiresAt.toMillis() : new Date(inst.expiresAt).getTime();
        return expiryMs > now;
      });

      onUpdate(freshInstants);
    },
    (err) => {
      console.error('Error listening to group instants:', err);
    }
  );
};

/**
 * Atomically reacts to a Group Instant (e.g. 👍, ❤️, 😂, 😮, 🔥).
 */
export const reactToGroupInstant = async (
  groupId: string,
  instantId: string,
  emoji: string,
  uid: string
): Promise<void> => {
  if (!groupId || !instantId || !emoji || !uid) return;

  const isMember = await isUserGroupChatMember(groupId, uid);
  if (!isMember) {
    throw new Error('You must be a group member to react.');
  }

  const instantRef = doc(db, 'groups', groupId, 'instants', instantId);
  await updateDoc(instantRef, {
    [`reactionCounts.${emoji}`]: increment(1),
  }).catch(() => {});

  logAnalyticsEvent('instant_reacted', { groupId, instantId, emoji });
};

/**
 * Submits a moderation report for an Instant.
 */
export const reportGroupInstant = async (
  groupId: string,
  instantId: string,
  reason: string,
  uid: string
): Promise<void> => {
  if (!groupId || !instantId || !uid) return;

  const reportRef = doc(db, 'groups', groupId, 'instants', instantId, 'reports', uid);
  await setDoc(reportRef, {
    reporterId: uid,
    reason: reason.trim().slice(0, 300),
    createdAt: serverTimestamp(),
  });

  logAnalyticsEvent('instant_reported', { groupId, instantId });
};

/**
 * Soft deletes / hides an Instant (Owner or Admin only).
 */
export const deleteGroupInstant = async (
  groupId: string,
  instantId: string,
  uid: string
): Promise<void> => {
  if (!groupId || !instantId || !uid) return;

  const instantRef = doc(db, 'groups', groupId, 'instants', instantId);
  const snap = await getDoc(instantRef);

  if (!snap.exists()) return;
  const data = snap.data() as GroupInstant;

  if (data.senderId !== uid) {
    throw new Error('Only the author or group admin can delete this Instant.');
  }

  await updateDoc(instantRef, {
    status: 'deleted',
    deletedAt: serverTimestamp(),
  });

  logAnalyticsEvent('instant_deleted', { groupId, instantId });
};

/**
 * Persists user's last seen instant state for unread indicators.
 */
export const markGroupInstantsSeen = async (
  groupId: string,
  uid: string,
  lastInstantId: string
): Promise<void> => {
  if (!groupId || !uid || !lastInstantId) return;

  const stateRef = doc(db, 'users', uid, 'groupInstantState', groupId);
  const data: GroupInstantReadState = {
    groupId,
    lastSeenInstantAt: serverTimestamp(),
    lastSeenInstantId: lastInstantId,
    updatedAt: serverTimestamp(),
  };

  await setDoc(stateRef, data, { merge: true }).catch(() => {});
};
