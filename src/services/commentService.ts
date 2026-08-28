import { 
  collection, 
  doc, 
  setDoc,
  updateDoc,
  deleteDoc,
  query, 
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
      ? query(commentsRef, orderBy('timestamp', 'asc'), startAfter(lastVisibleDoc), limit(boundedSize))
      : query(commentsRef, orderBy('timestamp', 'asc'), limit(boundedSize));

    const snapshot = await getDocs(q);
    const comments = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      postId,
      ...docSnap.data(),
    })) as Comment[];

    const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    return { comments, lastDoc: newLastDoc };
  } catch (error) {
    console.error('Error fetching paginated comments:', error);
    throw error;
  }
};

/**
 * Adds a new comment to a post document sub-collection (supports replies using parentCommentId).
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

  if (postAuthorId && postAuthorId !== currentUser.uid) {
    createNotification({
      recipientId: postAuthorId,
      senderId: currentUser.uid,
      message: `${authorName} commented on your post`,
      relatedPostId: postId,
    });
  }

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

// Backward-compatible alias for real-time fallback
export const subscribeToComments = (
  postId: string,
  callback: (comments: Comment[]) => void
) => {
  getCommentsPage(postId, 50).then((res) => callback(res.comments)).catch(() => callback([]));
  return () => {};
};
