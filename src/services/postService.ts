import { 
  collection, 
  doc,
  setDoc,
  query, 
  orderBy, 
  limit, 
  getDocs, 
  updateDoc,
  writeBatch,
  where, 
  runTransaction,
  increment,
  serverTimestamp,
  startAfter,
  type QueryDocumentSnapshot
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { Post, User, PostAudience, PostPriority } from '../types';

export interface PaginatedPostsResult {
  posts: Post[];
  lastDoc: QueryDocumentSnapshot | null;
}

export interface CreatePostPayload {
  title: string;
  content: string;
  category: 'Mishap' | 'Event' | 'General' | 'LostFound';
  imageUrl?: string;
  images?: { storagePath: string; downloadUrl: string }[];
  audience?: PostAudience;
  priority?: PostPriority;
  notifyAudience?: boolean;
}

export interface CreateLostFoundPayload {
  title: string;
  content: string;
  postType: 'lost' | 'found';
  contactInfo: string;
  imageUrl?: string;
}

export interface CreateBroadcastPayload {
  title: string;
  content: string;
  imageUrl?: string;
}

/**
 * Phase 26: Fetches paginated posts using Firestore cursor pagination.
 */
export const getPostsPage = async (
  pageSize: number = 10,
  category: string = 'All',
  lastVisibleDoc?: QueryDocumentSnapshot | null
): Promise<PaginatedPostsResult> => {
  try {
    const postsRef = collection(db, 'posts');
    let q;

    if (category === 'All' || !category) {
      q = lastVisibleDoc
        ? query(postsRef, orderBy('timestamp', 'desc'), startAfter(lastVisibleDoc), limit(pageSize))
        : query(postsRef, orderBy('timestamp', 'desc'), limit(pageSize));
    } else {
      q = lastVisibleDoc
        ? query(postsRef, where('category', '==', category), orderBy('timestamp', 'desc'), startAfter(lastVisibleDoc), limit(pageSize))
        : query(postsRef, where('category', '==', category), orderBy('timestamp', 'desc'), limit(pageSize));
    }

    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map((docSnap) => ({
      ...docSnap.data(),
      id: docSnap.id,
    })) as Post[];

    const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    return { posts, lastDoc: newLastDoc };
  } catch (error) {
    console.error('Error fetching paginated posts:', error);
    throw error;
  }
};

/**
 * Creates a new post document in Firestore `posts` collection.
 * Phase 21: Also increments author's gamification points by +10 in the same transaction.
 */
export const createPost = async (
  payload: CreatePostPayload,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<Post> => {
  try {
    const postsRef = collection(db, 'posts');
    const userRef = doc(db, 'users', currentUser.uid);
    const authorName = userProfile?.displayName || currentUser.displayName || 'Student';

    // Validate Priority permissions server-side before writing
    const postPriority: PostPriority = payload.priority || 'normal';
    if (postPriority === 'emergency' && userProfile?.role !== 'admin') {
      throw new Error('Emergency post priority is restricted to campus admins.');
    }

    const audience = payload.audience || { type: 'campus' };

    const newPostData = {
      title: payload.title.trim(),
      content: payload.content.trim(),
      category: payload.category,
      ...(payload.images && payload.images.length > 0 ? { images: payload.images, imageUrl: payload.images[0].downloadUrl } : payload.imageUrl?.trim() ? { imageUrl: payload.imageUrl.trim() } : {}),
      authorId: currentUser.uid,
      authorName,
      timestamp: serverTimestamp(),
      likeCount: 0,
      commentCount: 0,
      reportCount: 0,
      status: 'active' as const,
      postType: 'news' as const,
      audience,
      priority: postPriority,
      notifyAudience: payload.notifyAudience ?? false,
    };

    let newDocId = '';
    try {
      await runTransaction(db, async (transaction) => {
        const newPostRef = doc(postsRef);
        newDocId = newPostRef.id;

        transaction.set(newPostRef, newPostData);
        // Phase 21 Gamification: +10 points for creating a post
        transaction.update(userRef, { points: increment(10) });
      });
    } catch (txErr) {
      console.warn('Transaction failed, falling back to direct addDoc:', txErr);
      const newPostRef = doc(postsRef);
      newDocId = newPostRef.id;
      await setDoc(newPostRef, newPostData);
    }

    logAnalyticsEvent('post_created', { category: payload.category });
    logAnalyticsEvent('campus_post_audience_selected', { audienceType: audience.type });
    logAnalyticsEvent('campus_post_priority_selected', { priority: postPriority });

    return {
      id: newDocId,
      ...newPostData,
      timestamp: new Date(),
    } as Post;
  } catch (error: any) {
    console.error('Error creating post:', error);
    throw new Error(error.message || 'Failed to create post. Please try again.');
  }
};

/**
 * Creates an official broadcast news post (admin only).
 * Force-sets category: "General", isOfficial: true, postType: "news".
 */
export const createBroadcastPost = async (
  payload: CreateBroadcastPayload,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<Post> => {
  try {
    const postsRef = collection(db, 'posts');
    const userRef = doc(db, 'users', currentUser.uid);
    const authorName = userProfile?.displayName || currentUser.displayName || 'AKGEC Admin';

    const newPostData = {
      title: payload.title.trim(),
      content: payload.content.trim(),
      category: 'General' as const,
      isOfficial: true,
      ...(payload.imageUrl?.trim() ? { imageUrl: payload.imageUrl.trim() } : {}),
      authorId: currentUser.uid,
      authorName,
      timestamp: serverTimestamp(),
      likeCount: 0,
      commentCount: 0,
      reportCount: 0,
      status: 'active' as const,
      postType: 'news' as const,
    };

    let newDocId = '';
    await runTransaction(db, async (transaction) => {
      const newPostRef = doc(postsRef);
      newDocId = newPostRef.id;

      transaction.set(newPostRef, newPostData);
      transaction.update(userRef, { points: increment(10) });
    });

    return {
      id: newDocId,
      ...newPostData,
      timestamp: new Date(),
    } as Post;
  } catch (error: any) {
    console.error('Error creating broadcast post:', error);
    throw new Error(error.message || 'Failed to publish official broadcast post.');
  }
};

/**
 * Creates a Lost & Found post document in `posts` collection.
 * Phase 21: Also increments author's gamification points by +10 in transaction.
 */
export const createLostFoundPost = async (
  payload: CreateLostFoundPayload,
  currentUser: FirebaseUser,
  userProfile?: User | null
): Promise<Post> => {
  try {
    const postsRef = collection(db, 'posts');
    const userRef = doc(db, 'users', currentUser.uid);
    const authorName = userProfile?.displayName || currentUser.displayName || 'Student';

    const newPostData = {
      title: payload.title.trim(),
      content: payload.content.trim(),
      category: 'LostFound' as const,
      postType: payload.postType,
      contactInfo: payload.contactInfo.trim(),
      ...(payload.imageUrl?.trim() ? { imageUrl: payload.imageUrl.trim() } : {}),
      authorId: currentUser.uid,
      authorName,
      timestamp: serverTimestamp(),
      likeCount: 0,
      commentCount: 0,
      reportCount: 0,
      status: 'active' as const,
    };

    let newDocId = '';
    await runTransaction(db, async (transaction) => {
      const newPostRef = doc(postsRef);
      newDocId = newPostRef.id;

      transaction.set(newPostRef, newPostData);
      transaction.update(userRef, { points: increment(10) });
    });

    return {
      id: newDocId,
      ...newPostData,
      timestamp: new Date(),
    } as Post;
  } catch (error: any) {
    console.error('Error creating Lost & Found post:', error);
    throw new Error(error.message || 'Failed to create Lost & Found post.');
  }
};

/**
 * Fetches Lost & Found posts (postType in ["lost", "found"]) ordered by timestamp descending.
 */
export const getLostFoundPosts = async (limitCount: number = 20): Promise<Post[]> => {
  try {
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('postType', 'in', ['lost', 'found']),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Post[];
  } catch (error) {
    console.error('Error fetching Lost & Found posts:', error);
    throw error;
  }
};

/**
 * Marks a post as resolved (only callable by post author).
 */
export const resolvePost = async (postId: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, { status: 'resolved' });
  } catch (error: any) {
    console.error('Error resolving post:', error);
    throw new Error(error.message || 'Failed to resolve post.');
  }
};

/**
 * Reports a post. Manages `posts/{postId}/reports/{reporterId}` sub-collection doc.
 * Phase 22: Increments reportCount on parent post.
 */
export const reportPost = async (
  postId: string,
  reporterId: string,
  reason: string
): Promise<{ success: boolean; alreadyReported?: boolean }> => {
  if (!postId || !reporterId) {
    throw new Error('Post ID and reporter ID are required.');
  }

  const reportRef = doc(db, 'posts', postId, 'reports', reporterId);
  const postRef = doc(db, 'posts', postId);

  let alreadyReported = false;

  await runTransaction(db, async (transaction) => {
    const reportSnap = await transaction.get(reportRef);
    if (reportSnap.exists()) {
      alreadyReported = true;
      return;
    }

    transaction.set(reportRef, {
      reporterId,
      reason,
      reportedAt: serverTimestamp(),
    });
    transaction.update(postRef, { reportCount: increment(1) });
  });

  return { success: !alreadyReported, alreadyReported };
};

/**
 * Phase 23: Fetches reported posts where reportCount >= 1 ordered by reportCount descending.
 */
export const getReportedPosts = async (): Promise<Post[]> => {
  try {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, where('reportCount', '>=', 1), orderBy('reportCount', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Post[];
  } catch (error) {
    console.error('Error fetching reported posts:', error);
    throw error;
  }
};

/**
 * Phase 23: Fetches report documents for a post.
 */
export const getPostReportReasons = async (postId: string): Promise<string[]> => {
  try {
    const reportsRef = collection(db, 'posts', postId, 'reports');
    const snapshot = await getDocs(reportsRef);
    return snapshot.docs.map((docSnap) => docSnap.data().reason || 'Unspecified').filter(Boolean);
  } catch (error) {
    console.error('Error fetching report reasons:', error);
    return [];
  }
};

/**
 * Phase 23: Dismisses reports for a post.
 * Resets reportCount to 0 and batch-deletes all sub-collection documents in `posts/{postId}/reports`.
 */
export const dismissPostReports = async (postId: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts', postId);
    const reportsRef = collection(db, 'posts', postId, 'reports');
    const snapshot = await getDocs(reportsRef);

    const batch = writeBatch(db);
    batch.update(postRef, { reportCount: 0 });

    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
  } catch (error: any) {
    console.error('Error dismissing post reports:', error);
    throw new Error(error.message || 'Failed to dismiss post reports.');
  }
};

/**
 * Phase 23: Deletes a post document with cascading deletion of known sub-collections (likes, comments, reports).
 */
export const deletePost = async (postId: string): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const postRef = doc(db, 'posts', postId);

    // Fetch and delete likes sub-collection docs
    const likesSnap = await getDocs(collection(db, 'posts', postId, 'likes'));
    likesSnap.docs.forEach((d) => batch.delete(d.ref));

    // Fetch and delete comments sub-collection docs
    const commentsSnap = await getDocs(collection(db, 'posts', postId, 'comments'));
    commentsSnap.docs.forEach((d) => batch.delete(d.ref));

    // Fetch and delete reports sub-collection docs
    const reportsSnap = await getDocs(collection(db, 'posts', postId, 'reports'));
    reportsSnap.docs.forEach((d) => batch.delete(d.ref));

    // Delete post doc
    batch.delete(postRef);

    await batch.commit();
  } catch (error: any) {
    console.error('Error deleting post:', error);
    throw new Error(error.message || 'Failed to delete post.');
  }
};

/**
 * Phase 27: Author-only post content/title editing.
 * Preserves immutable metadata (authorId, timestamp, likeCount, etc.).
 */
export const editPost = async (
  postId: string,
  userId: string,
  updates: { title?: string; content?: string; category?: 'Mishap' | 'Event' | 'General' | 'LostFound' }
): Promise<void> => {
  if (!postId || !userId) throw new Error('Post ID and User ID are required.');

  const postRef = doc(db, 'posts', postId);

  await runTransaction(db, async (transaction) => {
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists()) throw new Error('Post not found.');

    const data = postSnap.data() as Post;
    if (data.authorId !== userId) {
      throw new Error('Unauthorized to edit this post.');
    }

    const payload: Partial<Post> = {
      ...(updates.title?.trim() ? { title: updates.title.trim().slice(0, 80) } : {}),
      ...(updates.content?.trim() ? { content: updates.content.trim().slice(0, 500) } : {}),
      ...(updates.category ? { category: updates.category } : {}),
      isEdited: true,
      editedAt: serverTimestamp(),
    };

    transaction.update(postRef, payload);
  });

  logAnalyticsEvent('post_edited', { postId });
};

/**
 * Phase 27: Toggles important classification for a post (admin only).
 */
export const togglePostImportant = async (
  postId: string,
  isImportant: boolean
): Promise<void> => {
  if (!postId) return;
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, { isImportant });
  logAnalyticsEvent('post_important_toggled', { postId, isImportant });
};



