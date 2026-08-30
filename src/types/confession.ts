import type { Timestamp } from 'firebase/firestore';

export type ConfessionStatus = 'PUBLISHED' | 'HIDDEN' | 'REMOVED';
export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Public document stored in `confessions/{confessionId}`.
 * CRITICAL PRIVACY REQUIREMENT: Must NOT contain any author identity fields
 * (authorId, uid, email, displayName, photoURL, department, batch, etc.).
 */
export interface Confession {
  id: string;
  text: string;
  createdAt: Timestamp | Date | any;
  updatedAt?: Timestamp | Date | any;
  likesCount: number;
  commentsCount: number;
  reportsCount: number;
  status: ConfessionStatus;
  moderationStatus: ModerationStatus;
  isActive: boolean;
}

/**
 * Privileged metadata stored in `confessionPrivateMetadata/{confessionId}`.
 * Accessible ONLY to admins/moderators for abuse investigation.
 */
export interface PrivateConfessionMetadata {
  confessionId: string;
  authorId: string;
  createdAt: Timestamp | Date | any;
}

export interface ConfessionComment {
  id: string;
  confessionId: string;
  text: string;
  createdAt: Timestamp | Date | any;
  status: ConfessionStatus;
}

export interface ConfessionReport {
  id: string;
  confessionId: string;
  reporterId: string;
  reason: string;
  createdAt: Timestamp | Date | any;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
}
