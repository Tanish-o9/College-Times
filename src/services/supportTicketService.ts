import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createNotification } from './notificationService';

export type TicketCategory =
  | 'Academics'
  | 'Hostel'
  | 'Transport'
  | 'Facilities'
  | 'IT'
  | 'Library'
  | 'Administration'
  | 'Other';

export type TicketStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_USER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REJECTED';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface SupportTicket {
  id?: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  creatorId: string;
  creatorName: string;
  assignedAdminId?: string;
  assignedAdminName?: string;
  createdAt: any;
  updatedAt: any;
}

export interface TicketReply {
  id?: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'support' | 'admin';
  createdAt: any;
}

export const createSupportTicket = async (
  userId: string,
  userName: string,
  ticket: { title: string; description: string; category: TicketCategory; priority: TicketPriority }
): Promise<string> => {
  const colRef = collection(db, 'supportTickets');
  const docRef = await addDoc(colRef, {
    ...ticket,
    status: 'SUBMITTED',
    creatorId: userId,
    creatorName: userName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getUserSupportTickets = async (userId: string): Promise<SupportTicket[]> => {
  try {
    const colRef = collection(db, 'supportTickets');
    const q = query(colRef, where('creatorId', '==', userId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupportTicket));
  } catch (err) {
    console.error('Error fetching user support tickets:', err);
    return [];
  }
};

export const getAllSupportTickets = async (): Promise<SupportTicket[]> => {
  try {
    const colRef = collection(db, 'supportTickets');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupportTicket));
  } catch (err) {
    console.error('Error fetching all support tickets:', err);
    return [];
  }
};

export const assignSupportTicket = async (
  ticketId: string,
  adminId: string,
  adminName: string
): Promise<void> => {
  const docRef = doc(db, 'supportTickets', ticketId);
  await updateDoc(docRef, {
    assignedAdminId: adminId,
    assignedAdminName: adminName,
    status: 'ASSIGNED',
    updatedAt: serverTimestamp(),
  });
};

export const updateSupportTicketStatus = async (
  ticketId: string,
  status: TicketStatus,
  recipientId: string // Send notification to creator
): Promise<void> => {
  const docRef = doc(db, 'supportTickets', ticketId);
  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp(),
  });

  createNotification({
    recipientId,
    senderId: 'system_support',
    message: `Your support ticket status has been updated to "${status}".`,
    deepLink: `/support`,
  });
};

export const addSupportTicketReply = async (
  ticketId: string,
  text: string,
  senderId: string,
  senderName: string,
  senderRole: 'user' | 'support' | 'admin',
  notifyRecipientId?: string // If support replies, notify user; if user replies, notify assigned admin
): Promise<string> => {
  const colRef = collection(db, 'supportTickets', ticketId, 'replies');
  const docRef = await addDoc(colRef, {
    text: text.trim(),
    senderId,
    senderName,
    senderRole,
    createdAt: serverTimestamp(),
  });

  // Update ticket modified timestamp
  await updateDoc(doc(db, 'supportTickets', ticketId), {
    updatedAt: serverTimestamp(),
  });

  if (notifyRecipientId) {
    createNotification({
      recipientId: notifyRecipientId,
      senderId,
      senderName,
      message: `replied to support ticket: "${text.slice(0, 40)}..."`,
      deepLink: `/support`,
    });
  }

  return docRef.id;
};

export const getSupportTicketReplies = async (ticketId: string): Promise<TicketReply[]> => {
  try {
    const colRef = collection(db, 'supportTickets', ticketId, 'replies');
    const q = query(colRef, orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TicketReply));
  } catch {
    return [];
  }
};
