import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';

export const checkPostIsSaved = async (postId: string, userId: string): Promise<boolean> => {
  if (!postId || !userId) return false;
  try {
    const saveRef = doc(db, 'users', userId, 'savedPosts', postId);
    const snap = await getDoc(saveRef);
    return snap.exists();
  } catch (err) {
    return false;
  }
};

export const toggleSavePost = async (
  postId: string,
  currentUser: FirebaseUser,
  postTitle?: string
): Promise<boolean> => {
  if (!currentUser || !postId) {
    throw new Error('Authentication required to save posts.');
  }

  const saveRef = doc(db, 'users', currentUser.uid, 'savedPosts', postId);
  const snap = await getDoc(saveRef);

  if (snap.exists()) {
    await deleteDoc(saveRef);
    logAnalyticsEvent('post_unsaved', { postId });
    return false;
  } else {
    await setDoc(saveRef, {
      postId,
      savedAt: serverTimestamp(),
      title: (postTitle || 'Saved Post').slice(0, 100),
    });
    logAnalyticsEvent('post_saved', { postId });
    return true;
  }
};

export const getUserSavedPosts = async (userId: string): Promise<string[]> => {
  if (!userId) return [];
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const colRef = collection(db, 'users', userId, 'savedPosts');
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => d.id);
  } catch (err) {
    return [];
  }
};
