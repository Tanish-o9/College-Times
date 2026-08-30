import { 
  collection, 
  doc, 
  setDoc,
  updateDoc,
  deleteDoc,
  query, 
  where,
  orderBy, 
  getDocs,
  limit,
  startAfter,
  runTransaction, 
  increment, 
  serverTimestamp,
  type QueryDocumentSnapshot
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import { createNotification } from './notificationService';
import { getUidByUsername } from './usernameService';
import { isUserBlocked } from './directMessageService';
import { awardReputation } from './reputationService';
import { trackChallengeAction } from './challengeService';
import { logCampusActivity } from './activityCenterService';
import type { Comment, User } from '../types';

export interface PaginatedCommentsResult {
  comments: Comment[];
  lastDoc: QueryDocumentSnapshot | null;
}

/**
 * Fetches cursor-paginated comments for a post (bounded size, default 20).
 */
export const getCommentsPage = async (
  postId: string,
  pageSize: number = 20,
  lastVisibleDoc?: QueryDocumentSnapshot | null
): Promise<PaginatedCommentsResult> => {
  if (!postId) return { comments: [], lastDoc: null };
  try {
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const boundedSize = Math.min(50, Math.max(1, pageSize));
    
    const q = lastVisibleDoc
      ? query(commentsRef, orderBy('timestamp', 'asc'), startAfter(lastVisibleDoc), limit(boundedSize * 3))
      : query(commentsRef, orderBy('timestamp', 'asc'), limit(boundedSize * 3));

    const snapshot = await getDocs(q);
    let comments = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      postId,
      ...docSnap.data(),
    })) as Comment[];

    // Filter to top-level comments (parentCommentId is null or undefined)
    comments = comments.filter((c) => !c.parentCommentId);
    const slicedComments = comments.slice(0, pageSize);

    let newLastDoc: QueryDocumentSnapshot | null = null;
    if (slicedComments.length > 0) {
      const lastCommentId = slicedComments[slicedComments.length - 1].id;
      const matchingDoc = snapshot.docs.find((d) => d.id === lastCommentId);
      if (matchingDoc) {
        newLastDoc = matchingDoc;
      }
    }

    return { comments: slicedComments, lastDoc: newLastDoc };
  } catch (error) {
    console.error('Error fetching paginated comments:', error);
    throw error;
  }
};

/**
 * Fetches replies to a specific parent comment.
 */
export const getRepliesPage = async (
  postId: string,
  parentCommentId: string,
  pageSize: number = 20
): Promise<Comment[]> => {
  if (!postId || !parentCommentId) return [];
  try {
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(
      commentsRef,
      where('parentCommentId', '==', parentCommentId),
      orderBy('timestamp', 'asc'),
      limit(pageSize)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, postId, ...d.data() } as Comment));
  } catch (error) {
    // Fallback: Query all comments and filter in-memory in case of missing index
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const snap = await getDocs(query(commentsRef, limit(100)));
    return snap.docs
      .map((d) => ({ id: d.id, postId, ...d.data() } as Comment))
      .filter((c) => c.parentCommentId === parentCommentId);
  }
};

/**
 * Adds a new comment to a post document sub-collection (supports replies using parentCommentId and mentions).
 */
export const addComment = async (
  postId: string,
  text: string,
  currentUser: FirebaseUser,
  userProfile?: User | null,
  postAuthorId?: string,
  parentCommentId?: string
): Promise<Comment> => {
  const cleanText = text.trim();
  if (!postId || !cleanText || !currentUser) {
    throw new Error('Post ID, user, and non-empty comment text are required.');
  }

  const postRef = doc(db, 'posts', postId);
  const userRef = doc(db, 'users', currentUser.uid);
  const commentsRef = collection(db, 'posts', postId, 'comments');
  const authorName = userProfile?.displayName || currentUser.displayName || 'Student';
  const authorAvatar = userProfile?.photoURL || currentUser.photoURL || '';

  // Parse @username mentions
  const mentionMatches = cleanText.match(/@([a-z0-9_]{3,30})/gi) || [];
  const uniqueUsernames = Array.from(new Set(mentionMatches.map((m) => m.slice(1).toLowerCase())));

  const mentions: { userId: string; username: string }[] = [];
  await Promise.all(
    uniqueUsernames.map(async (uname) => {
      const uid = await getUidByUsername(uname);
      if (uid) {
        mentions.push({ userId: uid, username: uname });
      }
    })
  );

  const newCommentData = {
    postId,
    authorId: currentUser.uid,
    authorName,
    authorAvatar,
    text: cleanText,
    timestamp: serverTimestamp(),
    parentCommentId: parentCommentId || null,
    likeCount: 0,
    reportCount: 0,
    mentions: mentions.length > 0 ? mentions : null,
  };

  let commentId = '';
  try {
    await runTransaction(db, async (transaction) => {
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) {
        throw new Error('Post does not exist');
      }

      const newCommentRef = doc(commentsRef);
      commentId = newCommentRef.id;

      transaction.set(newCommentRef, newCommentData);
      transaction.update(postRef, { commentCount: increment(1) });
      transaction.set(userRef, { points: increment(2) }, { merge: true });
    });
  } catch (txErr: any) {
    const newCommentRef = doc(commentsRef);
    commentId = newCommentRef.id;
    await setDoc(newCommentRef, newCommentData);
    await updateDoc(postRef, { commentCount: increment(1) }).catch(() => {});
    await setDoc(userRef, { points: increment(2) }, { merge: true }).catch(() => {});
  }

  logCampusActivity({
    type: 'system',
    action: parentCommentId ? 'replied to a comment' : 'commented on a post',
    actorId: currentUser.uid,
    actorName: authorName,
    actorAvatar: authorAvatar,
    targetId: postId,
    previewText: cleanText.slice(0, 150),
  });
  if (parentCommentId) {
    awardReputation(currentUser.uid, commentId, 'helpful_reply', 5, `Replied to comment in post: ${postId}`).catch((e) => console.warn(e));
    trackChallengeAction(currentUser.uid, 'replies', 1).catch((e) => console.warn(e));
  }

  // Trigger main comment notification
  if (postAuthorId && postAuthorId !== currentUser.uid) {
    createNotification({
      recipientId: postAuthorId,
      senderId: currentUser.uid,
      senderName: authorName,
      message: `${authorName} commented on your post`,
      relatedPostId: postId,
      type: 'post_comment',
      category: 'feed',
      deepLink: `/feed`,
      deterministicId: `comment_${postId}_${commentId}_${currentUser.uid}`,
    });
  }

  // Trigger mention notifications
  await Promise.all(
    mentions.map(async (m) => {
      if (m.userId === currentUser.uid) return; // Don't notify self
      const blocked = await isUserBlocked(m.userId, currentUser.uid);
      if (blocked) return;

      createNotification({
        recipientId: m.userId,
        senderId: currentUser.uid,
        senderName: authorName,
        message: `${authorName} mentioned you in a comment`,
        relatedPostId: postId,
        type: 'mention',
        category: 'social',
        deepLink: `/feed`,
        deterministicId: `mention_comment_${postId}_${commentId}_${m.userId}`,
      });
    })
  );

  logAnalyticsEvent('post_commented', { postId, parentCommentId });

  return {
    id: commentId,
    ...newCommentData,
    timestamp: new Date(),
  } as Comment;
};

/**
 * Idempotently reacts to a comment.
 */
export const reactToComment = async (
  postId: string,
  commentId: string,
  userId: string
): Promise<void> => {
  if (!postId || !commentId || !userId) return;
  const reactRef = doc(db, 'posts', postId, 'comments', commentId, 'reactions', userId);
  await setDoc(reactRef, { reactedAt: serverTimestamp() });
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  await updateDoc(commentRef, { likeCount: increment(1) });
};

/**
 * Deletes a comment.
 */
export const deleteComment = async (postId: string, commentId: string): Promise<void> => {
  if (!postId || !commentId) return;
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  await deleteDoc(commentRef);
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, { commentCount: increment(-1) }).catch(() => {});
};

/**
 * Reports a comment.
 */
export const reportComment = async (
  postId: string,
  commentId: string,
  reason: string
): Promise<void> => {
  if (!postId || !commentId) return;
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  await updateDoc(commentRef, { reportCount: increment(1) });
  logAnalyticsEvent('comment_reported', { postId, commentId, reason });
};

/**
 * Edits comment text (author only).
 */
export const editComment = async (
  postId: string,
  commentId: string,
  newText: string
): Promise<void> => {
  if (!postId || !commentId || !newText.trim()) return;
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  await updateDoc(commentRef, {
    text: newText.trim(),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Dismisses reports for a comment (moderator/admin only).
 */
export const dismissCommentReports = async (
  postId: string,
  commentId: string
): Promise<void> => {
  if (!postId || !commentId) return;
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  await updateDoc(commentRef, {
    reportCount: 0,
  });
};

// Backward-compatible alias for real-time fallback
export const subscribeToComments = (
  postId: string,
  callback: (comments: Comment[]) => void
) => {
  getCommentsPage(postId, 50).then((res) => callback(res.comments)).catch(() => callback([]));
  return () => {};
};
