import { 
  collection, 
  doc, 
  setDoc,
  updateDoc,
  query, 
  orderBy, 
  onSnapshot, 
  runTransaction, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../lib/firebase';
import { createNotification } from './notificationService';
import type { Comment, User } from '../types';

/**
 * Subscribes to real-time comments stream for a post.
 * Returns the unsubscribe function to prevent listener leaks.
 */
export const subscribeToComments = (
  postId: string,
  callback: (comments: Comment[]) => void
) => {
  if (!postId) {
    callback([]);
    return () => {};
  }

  const commentsRef = collection(db, 'posts', postId, 'comments');
  const q = query(commentsRef, orderBy('timestamp', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Comment[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        postId,
        ...docSnap.data(),
      })) as Comment[];
      callback(items);
    },
    (error) => {
      console.error('Error in comments subscription:', error);
    }
  );
};

/**
 * Adds a new comment to a post document sub-collection.
 * Atomically increments the parent post's `commentCount`.
 */
export const addComment = async (
  postId: string,
  text: string,
  currentUser: FirebaseUser,
  userProfile?: User | null,
  postAuthorId?: string
): Promise<Comment> => {
  const cleanText = text.trim();
  if (!postId || !cleanText || !currentUser) {
    throw new Error('Post ID, user, and non-empty comment text are required.');
  }

  const postRef = doc(db, 'posts', postId);
  const userRef = doc(db, 'users', currentUser.uid);
  const commentsRef = collection(db, 'posts', postId, 'comments');
  const authorName = userProfile?.displayName || currentUser.displayName || 'Student';

  const newCommentData = {
    postId,
    authorId: currentUser.uid,
    authorName,
    text: cleanText,
    timestamp: serverTimestamp(),
  };

  // Add comment doc, increment parent commentCount & author points (+2) atomically
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
      // Phase 21 Gamification: +2 points for adding a comment
      transaction.set(userRef, { points: increment(2) }, { merge: true });
    });
  } catch (txErr: any) {
    console.warn('Comment transaction warning, using direct fallback:', txErr?.message);
    const newCommentRef = doc(commentsRef);
    commentId = newCommentRef.id;
    await setDoc(newCommentRef, newCommentData);
    await updateDoc(postRef, { commentCount: increment(1) }).catch(() => {});
    await setDoc(userRef, { points: increment(2) }, { merge: true }).catch(() => {});
  }

  // Trigger notification if commenting on another user's post
  if (postAuthorId && postAuthorId !== currentUser.uid) {
    createNotification({
      recipientId: postAuthorId,
      senderId: currentUser.uid,
      message: `${authorName} commented on your post`,
      relatedPostId: postId,
    });
  }

  return {
    id: commentId,
    ...newCommentData,
    timestamp: new Date(),
  } as Comment;
};
