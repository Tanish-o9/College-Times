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
  getDocs,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction,
  startAfter,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, storage, logAnalyticsEvent } from '../lib/firebase';
import type { User } from '../types/models';
import type { GroupInstant, GroupInstantMedia, GroupInstantComment } from '../types/group';
import { isUserGroupChatMember } from './groupChatService';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export interface UploadedInstantMedia {
  downloadUrl: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Uploads a single media item for a group instant.
 */
export const uploadInstantMediaFile = async (
  groupId: string,
  instantId: string,
  file: File,
  currentUser: FirebaseUser
): Promise<UploadedInstantMedia> => {
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

  return new Promise<UploadedInstantMedia>((resolve) => {
    let isDone = false;
    const timeoutTimer = setTimeout(async () => {
      if (!isDone) {
        isDone = true;
        console.warn(`Storage upload timed out for instant media ${file.name}, using local Data URL fallback.`);
        try {
          const dataUrl = await readFileAsDataUrl(file);
          resolve({ downloadUrl: dataUrl, storagePath, fileSize: file.size, mimeType: file.type });
        } catch {
          resolve({ downloadUrl: '', storagePath, fileSize: file.size, mimeType: file.type });
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
            resolve({ downloadUrl: dataUrl, storagePath, fileSize: file.size, mimeType: file.type });
          } catch {
            resolve({ downloadUrl: '', storagePath, fileSize: file.size, mimeType: file.type });
          }
        }
      },
      async () => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeoutTimer);
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({ downloadUrl: url, storagePath, fileSize: file.size, mimeType: file.type });
          } catch {
            const dataUrl = await readFileAsDataUrl(file);
            resolve({ downloadUrl: dataUrl, storagePath, fileSize: file.size, mimeType: file.type });
          }
        }
      }
    );
  });
};

/**
 * Creates a permanent Group Instant moment with unlimited photos (stored in subcollection).
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

  const instantsRef = collection(db, 'groups', groupId, 'instants');
  const tempInstantId = `inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Upload images concurrently in batches of 4
  const uploadedMedia: UploadedInstantMedia[] = [];
  const BATCH_SIZE = 4;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((file) => uploadInstantMediaFile(groupId, tempInstantId, file, currentUser))
    );
    batchResults.forEach((res) => {
      if (res.downloadUrl) uploadedMedia.push(res);
    });
  }

  const instantData: Omit<GroupInstant, 'id'> = {
    groupId,
    senderId: currentUser.uid,
    senderName: userProfile?.displayName || currentUser.displayName || 'Campus Student',
    ...(userProfile?.photoURL ? { senderAvatar: userProfile.photoURL } : {}),
    type: uploadedMedia.length > 0 ? 'image' : 'text',
    media: uploadedMedia.map((m) => m.downloadUrl).slice(0, 5), // Legacy fallback array
    mediaCount: uploadedMedia.length,
    ...(caption.trim() ? { caption: caption.trim().slice(0, 500) } : {}),
    createdAt: serverTimestamp(),
    status: 'active',
    reactionCounts: {},
    replyCount: 0,
  };

  const newDoc = await addDoc(instantsRef, instantData);

  // Write scalable subcollection media docs
  const mediaSubRef = collection(db, 'groups', groupId, 'instants', newDoc.id, 'media');
  for (let i = 0; i < uploadedMedia.length; i++) {
    const m = uploadedMedia[i];
    const mediaId = `m_${i}_${Date.now()}`;
    const mediaDocRef = doc(mediaSubRef, mediaId);
    await setDoc(mediaDocRef, {
      mediaId,
      instantId: newDoc.id,
      groupId,
      ownerId: currentUser.uid,
      storagePath: m.storagePath,
      downloadUrl: m.downloadUrl,
      mimeType: m.mimeType,
      fileSize: m.fileSize,
      order: i,
      createdAt: serverTimestamp(),
    });
  }

  logAnalyticsEvent('instant_created', { groupId, mediaCount: uploadedMedia.length });

  return {
    id: newDoc.id,
    ...instantData,
    createdAt: new Date(),
  } as GroupInstant;
};

/**
 * Fetches media items from an Instant's media subcollection.
 */
export const getGroupInstantMedia = async (
  groupId: string,
  instantId: string,
  limitCount: number = 50
): Promise<GroupInstantMedia[]> => {
  if (!groupId || !instantId) return [];

  const mediaRef = collection(db, 'groups', groupId, 'instants', instantId, 'media');
  const q = query(mediaRef, orderBy('order', 'asc'), limit(limitCount));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as GroupInstantMedia[];
};

/**
 * Attaches a real-time listener for active permanent Instants in a group (max limitCount).
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
      const activeInstants = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as GroupInstant[];

      onUpdate(activeInstants);
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

  const instantRef = doc(db, 'groups', groupId, 'instants', instantId);
  const safeEmojiField = `reactionCounts.${emoji}`;

  await updateDoc(instantRef, {
    [safeEmojiField]: increment(1),
  });

  logAnalyticsEvent('instant_reacted', { groupId, instantId, emoji });
};

/**
 * Soft deletes a Group Instant (Author or Admin/Owner only).
 */
export const deleteGroupInstant = async (
  groupId: string,
  instantId: string,
  user: FirebaseUser,
  userProfile?: User | null
): Promise<void> => {
  if (!groupId || !instantId || !user) return;

  const instantRef = doc(db, 'groups', groupId, 'instants', instantId);
  const snap = await getDoc(instantRef);

  if (!snap.exists()) return;

  const data = snap.data();
  const isAuthor = data.senderId === user.uid;
  const isAdmin = userProfile?.role === 'admin';

  if (!isAuthor && !isAdmin) {
    throw new Error('Access denied: You can only delete your own Instants.');
  }

  await updateDoc(instantRef, {
    status: 'deleted',
    updatedAt: serverTimestamp(),
  });

  logAnalyticsEvent('instant_deleted', { groupId, instantId });
};

/**
 * Reports an inappropriate Group Instant.
 */
export const reportGroupInstant = async (
  groupId: string,
  instantId: string,
  reason: string,
  reporter: FirebaseUser
): Promise<void> => {
  if (!groupId || !instantId || !reporter) return;

  const reportsRef = collection(db, 'groups', groupId, 'instants', instantId, 'reports');
  await setDoc(doc(reportsRef, reporter.uid), {
    reporterId: reporter.uid,
    reason: reason || 'Inappropriate content',
    createdAt: serverTimestamp(),
  });

  logAnalyticsEvent('instant_reported', { groupId, instantId, reason });
};

/**
 * Marks Group Instants as read for the current user.
 */
export const markGroupInstantsAsRead = async (
  groupId: string,
  userId: string,
  lastInstantId: string
): Promise<void> => {
  if (!groupId || !userId) return;

  const readStateRef = doc(db, 'users', userId, 'groupInstantReadStates', groupId);
  await setDoc(
    readStateRef,
    {
      groupId,
      lastSeenInstantId: lastInstantId,
      lastSeenInstantAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

/**
 * Adds a lightweight comment to a Group Moment.
 * Triggers a targeted notification to the Moment author (if not self).
 */
export const addMomentComment = async (
  groupId: string,
  instantId: string,
  text: string,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<GroupInstantComment> => {
  if (!groupId || !instantId || !currentUser) {
    throw new Error('Authentication and Moment details required.');
  }

  const cleanText = text.trim().slice(0, 500);
  if (!cleanText) {
    throw new Error('Comment text cannot be empty.');
  }

  const instantRef = doc(db, 'groups', groupId, 'instants', instantId);
  const commentsColRef = collection(db, 'groups', groupId, 'instants', instantId, 'comments');
  const commentDocRef = doc(commentsColRef);

  const commentData: Omit<GroupInstantComment, 'id'> = {
    commentId: commentDocRef.id,
    instantId,
    groupId,
    authorId: currentUser.uid,
    authorName: userProfile?.displayName || currentUser.displayName || 'Group Member',
    authorAvatar: userProfile?.photoURL || currentUser.photoURL || undefined,
    text: cleanText,
    createdAt: serverTimestamp(),
    status: 'active',
  };

  await runTransaction(db, async (tx) => {
    tx.set(commentDocRef, commentData);
    tx.update(instantRef, {
      commentCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  });

  logAnalyticsEvent('moment_commented', { groupId, instantId });

  return {
    id: commentDocRef.id,
    ...commentData,
    createdAt: new Date(),
  } as GroupInstantComment;
};

/**
 * Fetches cursor-paginated comments for a Group Moment.
 */
export const getMomentComments = async (
  groupId: string,
  instantId: string,
  pageSize: number = 20,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<{ comments: GroupInstantComment[]; lastDoc: QueryDocumentSnapshot | null }> => {
  if (!groupId || !instantId) return { comments: [], lastDoc: null };

  const boundedSize = Math.min(50, Math.max(1, pageSize));
  const commentsRef = collection(db, 'groups', groupId, 'instants', instantId, 'comments');

  let q = query(commentsRef, where('status', '==', 'active'), orderBy('createdAt', 'asc'), limit(boundedSize));
  if (lastDoc) {
    q = query(commentsRef, where('status', '==', 'active'), orderBy('createdAt', 'asc'), startAfter(lastDoc), limit(boundedSize));
  }

  const snap = await getDocs(q);
  const comments = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as GroupInstantComment),
  }));

  const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { comments, lastDoc: newLastDoc };
};

/**
 * Soft deletes a Moment comment.
 */
export const deleteMomentComment = async (
  groupId: string,
  instantId: string,
  commentId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!groupId || !instantId || !commentId || !currentUser) return;

  const instantRef = doc(db, 'groups', groupId, 'instants', instantId);
  const commentRef = doc(db, 'groups', groupId, 'instants', instantId, 'comments', commentId);

  await runTransaction(db, async (tx) => {
    tx.update(commentRef, {
      status: 'deleted',
      updatedAt: serverTimestamp(),
    });
    tx.update(instantRef, {
      commentCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  });

  logAnalyticsEvent('moment_comment_deleted', { groupId, instantId, commentId });
};

/**
 * Saves a Group Moment privately for the user.
 */
export const saveGroupMoment = async (
  instantId: string,
  groupId: string,
  userId: string
): Promise<void> => {
  if (!instantId || !groupId || !userId) return;

  const saveRef = doc(db, 'users', userId, 'savedGroupMoments', instantId);
  const instantRef = doc(db, 'groups', groupId, 'instants', instantId);

  await runTransaction(db, async (tx) => {
    tx.set(saveRef, {
      instantId,
      groupId,
      savedAt: serverTimestamp(),
    });
    tx.update(instantRef, {
      saveCount: increment(1),
    });
  });

  logAnalyticsEvent('moment_saved', { groupId, instantId });
};

/**
 * Unsaves a previously saved Group Moment.
 */
export const unsaveGroupMoment = async (
  instantId: string,
  groupId: string,
  userId: string
): Promise<void> => {
  if (!instantId || !groupId || !userId) return;

  const saveRef = doc(db, 'users', userId, 'savedGroupMoments', instantId);
  const instantRef = doc(db, 'groups', groupId, 'instants', instantId);

  await runTransaction(db, async (tx) => {
    tx.delete(saveRef);
    tx.update(instantRef, {
      saveCount: increment(-1),
    });
  });

  logAnalyticsEvent('moment_unsaved', { groupId, instantId });
};

/**
 * Checks if a Moment is saved by the current user.
 */
export const isMomentSaved = async (instantId: string, userId: string): Promise<boolean> => {
  if (!instantId || !userId) return false;

  try {
    const saveRef = doc(db, 'users', userId, 'savedGroupMoments', instantId);
    const snap = await getDoc(saveRef);
    return snap.exists();
  } catch (err) {
    return false;
  }
};

/**
 * Fetches Group Moments for the group Moments discovery tab with bounded queries.
 */
export const getGroupMomentsByFilter = async (
  groupId: string,
  filter: 'latest' | 'top' | 'mine' = 'latest',
  userId?: string,
  limitCount: number = 20
): Promise<GroupInstant[]> => {
  if (!groupId) return [];

  const boundedLimit = Math.min(50, Math.max(1, limitCount));
  const instantsRef = collection(db, 'groups', groupId, 'instants');

  let q;
  if (filter === 'mine' && userId) {
    q = query(instantsRef, where('status', '==', 'active'), where('senderId', '==', userId), orderBy('createdAt', 'desc'), limit(boundedLimit));
  } else {
    q = query(instantsRef, where('status', '==', 'active'), orderBy('createdAt', 'desc'), limit(boundedLimit));
  }

  const snap = await getDocs(q);
  let moments = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as GroupInstant[];

  if (filter === 'top') {
    // Client-side top sorting by reaction + comment counts (bounded candidate set <= 50)
    moments = moments.sort((a, b) => {
      const scoreA = (a.commentCount || 0) + Object.values(a.reactionCounts || {}).reduce((s, c) => s + c, 0);
      const scoreB = (b.commentCount || 0) + Object.values(b.reactionCounts || {}).reduce((s, c) => s + c, 0);
      return scoreB - scoreA;
    });
  }

  return moments;
};
