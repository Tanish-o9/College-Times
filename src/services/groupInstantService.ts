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
import type {
  GroupInstant,
  GroupInstantMedia,
  GroupInstantComment,
  MomentSourceType,
  MomentCaptureMetadata,
} from '../types/group';
import { logGroupActivityEvent } from './groupActivityService';

export interface UploadedInstantMedia {
  downloadUrl: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
}

export interface CreateMomentOptions {
  sourceType?: MomentSourceType;
  captureMetadata?: MomentCaptureMetadata;
  expiresInHours?: number; // default: 24 hours
}

/**
 * Uploads a single photo or video media item for a group moment.
 * Fast fallback to local Data URL if Firebase Storage is unavailable or errors out.
 */
export const uploadInstantMediaFile = async (
  groupId: string,
  instantId: string,
  file: File,
  currentUser: FirebaseUser
): Promise<UploadedInstantMedia> => {
  const cleanGroupId = (groupId || '').replace(/^group-/, '');
  const rawType = file.type || 'image/jpeg';
  const baseMime = rawType.split(';')[0].trim().toLowerCase();
  const isVideo = baseMime.startsWith('video/');
  const maxBytes = isVideo ? 25 * 1024 * 1024 : 10 * 1024 * 1024;

  if (file.size > maxBytes) {
    throw new Error(`File '${file.name}' exceeds ${isVideo ? '25MB' : '10MB'} limit.`);
  }

  const cleanName = (file.name || `moment_${Date.now()}`)
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
  const storagePath = `groupInstantMedia/${cleanGroupId}/${currentUser.uid}/${instantId}/${Date.now()}_${cleanName}`;

  const readFileAsDataUrl = (f: File): Promise<string> => {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res((reader.result as string) || '');
      reader.onerror = (e) => rej(e);
      reader.readAsDataURL(f);
    });
  };

  // Convert to Data URL fallback immediately so data is never lost
  let dataUrl = '';
  try {
    dataUrl = await readFileAsDataUrl(file);
  } catch (err) {
    console.error('Data URL conversion error:', err);
  }

  // Attempt Storage upload if storage is initialized
  try {
    if (storage) {
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file, { contentType: rawType });

      const downloadUrl = await new Promise<string>((resolve) => {
        const timer = setTimeout(() => resolve(''), 3000);
        uploadTask.on(
          'state_changed',
          () => {},
          () => {
            clearTimeout(timer);
            resolve('');
          },
          async () => {
            clearTimeout(timer);
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url || '');
            } catch {
              resolve('');
            }
          }
        );
      });

      if (downloadUrl) {
        return {
          downloadUrl,
          storagePath,
          fileSize: file.size,
          mimeType: rawType,
        };
      }
    }
  } catch {
    // Fall back to Data URL
  }

  return {
    downloadUrl: dataUrl,
    storagePath,
    fileSize: file.size,
    mimeType: rawType,
  };
};

/**
 * Creates an Instagram-style Group Instant moment with explicit sourceType ('camera' | 'gallery'),
 * 24-hour expiration, and sanitized capture metadata.
 */
export const createGroupInstant = async (
  groupId: string,
  caption: string,
  files: File[],
  currentUser: FirebaseUser,
  userProfile?: User | null,
  options?: CreateMomentOptions
): Promise<GroupInstant> => {
  if (!groupId || !currentUser) {
    throw new Error('Group ID and authentication are required.');
  }

  const cleanGroupId = (groupId || '').replace(/^group-/, '');
  const instantsRef = collection(db, 'groups', cleanGroupId, 'instants');
  const tempInstantId = `inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Upload media items
  const uploadedMedia: UploadedInstantMedia[] = [];
  const BATCH_SIZE = 4;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((file) => uploadInstantMediaFile(cleanGroupId, tempInstantId, file, currentUser))
    );
    batchResults.forEach((res) => {
      if (res.downloadUrl) uploadedMedia.push(res);
    });
  }

  const sourceType: MomentSourceType = options?.sourceType || 'gallery';
  const hasVideo = uploadedMedia.some((m) => (m.mimeType || '').startsWith('video/'));

  // Calculate 24-hour expiration date
  const nowMs = Date.now();
  const expireHours = options?.expiresInHours || 24;
  const expiresAt = new Date(nowMs + expireHours * 60 * 60 * 1000);

  // Build clean document without any undefined properties
  const cleanInstantData: Record<string, any> = {
    groupId: cleanGroupId,
    senderId: currentUser.uid,
    senderName: userProfile?.displayName || currentUser.displayName || 'Campus Student',
    type: hasVideo ? 'video' : uploadedMedia.length > 0 ? 'image' : 'text',
    sourceType,
    media: uploadedMedia.map((m) => m.downloadUrl).slice(0, 5),
    mediaCount: uploadedMedia.length,
    createdAt: serverTimestamp(),
    expiresAt,
    status: 'active',
    reactionCounts: {},
    replyCount: 0,
    viewCount: 0,
  };

  if (userProfile?.photoURL || currentUser.photoURL) {
    cleanInstantData.senderAvatar = userProfile?.photoURL || currentUser.photoURL;
  }
  if (caption && caption.trim()) {
    cleanInstantData.caption = caption.trim().slice(0, 300);
  }

  // Construct sanitized metadata object
  const meta: Record<string, any> = { source: sourceType };
  if (options?.captureMetadata?.mimeType || (files[0] && files[0].type)) {
    meta.mimeType = options?.captureMetadata?.mimeType || files[0].type || 'image/jpeg';
  }
  if (typeof options?.captureMetadata?.width === 'number') {
    meta.width = options.captureMetadata.width;
  }
  if (typeof options?.captureMetadata?.height === 'number') {
    meta.height = options.captureMetadata.height;
  }
  cleanInstantData.captureMetadata = meta;

  const newDoc = await addDoc(instantsRef, cleanInstantData);

  // Write subcollection media docs safely
  const mediaSubRef = collection(db, 'groups', cleanGroupId, 'instants', newDoc.id, 'media');
  for (let i = 0; i < uploadedMedia.length; i++) {
    const m = uploadedMedia[i];
    const mediaId = `m_${i}_${Date.now()}`;
    const mediaDocRef = doc(mediaSubRef, mediaId);
    const mediaDocData: Record<string, any> = {
      mediaId,
      instantId: newDoc.id,
      groupId: cleanGroupId,
      ownerId: currentUser.uid,
      storagePath: m.storagePath || '',
      downloadUrl: m.downloadUrl || '',
      mimeType: m.mimeType || 'image/jpeg',
      fileSize: m.fileSize || 0,
      order: i,
      createdAt: serverTimestamp(),
    };
    await setDoc(mediaDocRef, mediaDocData);
  }

  await logGroupActivityEvent(
    cleanGroupId,
    'moment',
    currentUser.uid,
    userProfile?.displayName || currentUser.displayName || 'Campus Student',
    userProfile?.photoURL || currentUser.photoURL || undefined,
    newDoc.id,
    'moment',
    caption && caption.trim() ? `Shared a moment: ${caption}` : 'Shared a group moment'
  );

  logAnalyticsEvent('instant_created', { groupId: cleanGroupId, mediaCount: uploadedMedia.length, sourceType });

  return {
    id: newDoc.id,
    ...cleanInstantData,
    createdAt: new Date(),
  } as GroupInstant;
};

/**
 * Transactionally records a Moment view (1 view per user) and increments viewCount.
 */
export const recordMomentView = async (
  groupId: string,
  instantId: string,
  userId: string
): Promise<void> => {
  if (!groupId || !instantId || !userId) return;
  const cleanGroupId = (groupId || '').replace(/^group-/, '');

  const viewRef = doc(db, 'groups', cleanGroupId, 'instants', instantId, 'views', userId);
  const instantRef = doc(db, 'groups', cleanGroupId, 'instants', instantId);

  try {
    await runTransaction(db, async (tx) => {
      const viewSnap = await tx.get(viewRef);
      if (!viewSnap.exists()) {
        tx.set(viewRef, {
          userId,
          viewedAt: serverTimestamp(),
        });
        tx.update(instantRef, {
          viewCount: increment(1),
        });
      }
    });
  } catch (err) {
    // Fail silently for view tracking
  }
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
  const cleanGroupId = (groupId || '').replace(/^group-/, '');

  const mediaRef = collection(db, 'groups', cleanGroupId, 'instants', instantId, 'media');
  const q = query(mediaRef, limit(limitCount));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as GroupInstantMedia[];
};

/**
 * Attaches a real-time listener for active Instants in a group.
 * Queries collection directly without requiring composite indexes and sorts in memory.
 */
export const subscribeToActiveGroupInstants = (
  groupId: string,
  onUpdate: (instants: GroupInstant[]) => void,
  limitCount: number = 30
) => {
  if (!groupId) return () => {};
  const cleanGroupId = (groupId || '').replace(/^group-/, '');

  const instantsRef = collection(db, 'groups', cleanGroupId, 'instants');
  const q = query(instantsRef, limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const nowMs = Date.now();
      const activeInstants = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((inst: any) => {
          if (inst.status === 'deleted' || inst.status === 'hidden') return false;
          if (inst.expiresAt) {
            let expMs = 0;
            if (typeof inst.expiresAt.toMillis === 'function') expMs = inst.expiresAt.toMillis();
            else if (typeof inst.expiresAt.toDate === 'function') expMs = inst.expiresAt.toDate().getTime();
            else if (inst.expiresAt?.seconds) expMs = inst.expiresAt.seconds * 1000;
            else expMs = new Date(inst.expiresAt).getTime();

            if (!isNaN(expMs) && expMs > 0 && nowMs > expMs) return false;
          }
          return true;
        })
        .sort((a: any, b: any) => {
          const aTime = a.createdAt?.toMillis
            ? a.createdAt.toMillis()
            : a.createdAt?.seconds
            ? a.createdAt.seconds * 1000
            : Date.now();
          const bTime = b.createdAt?.toMillis
            ? b.createdAt.toMillis()
            : b.createdAt?.seconds
            ? b.createdAt.seconds * 1000
            : Date.now();
          return bTime - aTime;
        })
        .slice(0, limitCount) as GroupInstant[];

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

  const q = query(instantsRef, orderBy('createdAt', 'desc'), limit(boundedLimit * 3));

  const snap = await getDocs(q);
  let moments = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as GroupInstant))
    .filter((m) => m.status === 'active');

  if (filter === 'mine' && userId) {
    moments = moments.filter((m) => m.senderId === userId);
  }

  if (filter === 'top') {
    // Client-side top sorting by reaction + comment counts (bounded candidate set <= 50)
    moments = moments.sort((a, b) => {
      const scoreA = (a.commentCount || 0) + Object.values(a.reactionCounts || {}).reduce((s, c) => s + c, 0);
      const scoreB = (b.commentCount || 0) + Object.values(b.reactionCounts || {}).reduce((s, c) => s + c, 0);
      return scoreB - scoreA;
    });
  }

  return moments.slice(0, boundedLimit);
};
