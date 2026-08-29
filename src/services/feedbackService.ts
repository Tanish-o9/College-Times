import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type FeedbackCategory =
  | 'Facility Suggestion'
  | 'Facility Complaint'
  | 'Platform Feedback'
  | 'Community Suggestion'
  | 'Other';

export type FeedbackStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'REJECTED';

export type FeedbackPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CampusFeedback {
  id?: string;
  authorId: string;
  authorName: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  adminResponse?: string;
  createdAt: any;
  updatedAt: any;
}

/**
 * Submits a new feedback or suggestion.
 */
export const submitFeedback = async (
  userId: string,
  userName: string,
  category: FeedbackCategory,
  title: string,
  description: string,
  priority: FeedbackPriority = 'normal'
): Promise<string> => {
  if (!userId || !title || !description) {
    throw new Error('Title and description are required.');
  }

  const colRef = collection(db, 'feedback');
  const docRef = await addDoc(colRef, {
    authorId: userId,
    authorName: userName,
    category,
    title: title.trim().slice(0, 100),
    description: description.trim().slice(0, 1000),
    status: 'SUBMITTED',
    priority,
    adminResponse: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
};

/**
 * Fetches all feedback submissions for a specific user.
 */
export const getUserFeedback = async (userId: string): Promise<CampusFeedback[]> => {
  if (!userId) return [];
  try {
    const colRef = collection(db, 'feedback');
    const q = query(colRef, where('authorId', '==', userId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as CampusFeedback));
  } catch (err) {
    console.error('Failed to get user feedback:', err);
    return [];
  }
};

/**
 * Fetches all feedback submissions across the campus (Admin only).
 */
export const getAllFeedback = async (
  categoryFilter?: FeedbackCategory | 'All',
  statusFilter?: FeedbackStatus | 'All'
): Promise<CampusFeedback[]> => {
  try {
    const colRef = collection(db, 'feedback');
    let q = query(colRef, orderBy('createdAt', 'desc'));

    const snap = await getDocs(q);
    let list = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as CampusFeedback));

    if (categoryFilter && categoryFilter !== 'All') {
      list = list.filter((f) => f.category === categoryFilter);
    }
    if (statusFilter && statusFilter !== 'All') {
      list = list.filter((f) => f.status === statusFilter);
    }

    return list;
  } catch (err) {
    console.error('Failed to get all feedback submissions:', err);
    return [];
  }
};

/**
 * Updates status and responses to a feedback submission (Admin only).
 */
export const updateFeedbackStatus = async (
  feedbackId: string,
  status: FeedbackStatus,
  adminResponse: string,
  adminId: string
): Promise<void> => {
  if (!feedbackId || !status) throw new Error('Feedback ID and status are required.');

  const docRef = doc(db, 'feedback', feedbackId);
  await updateDoc(docRef, {
    status,
    adminResponse: adminResponse.trim(),
    adminId,
    updatedAt: serverTimestamp(),
  });
};
