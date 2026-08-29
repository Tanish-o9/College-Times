import { collection, addDoc, serverTimestamp, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type AuditAction =
  | 'USER_RESTRICTED'
  | 'POST_REMOVED'
  | 'COMMENT_REMOVED'
  | 'REPORT_RESOLVED'
  | 'GROUP_ACTION'
  | 'MARKETPLACE_MODERATION'
  | 'OPPORTUNITY_MODERATION'
  | 'EVENT_MODERATION';

export interface AuditLog {
  id?: string;
  moderatorId: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  reason: string;
  timestamp: any;
}

/**
 * Creates an immutable audit log entry in auditLogs collection.
 */
export const createAuditLog = async (
  moderatorId: string,
  action: AuditAction,
  targetType: string,
  targetId: string,
  reason: string
): Promise<void> => {
  try {
    const colRef = collection(db, 'auditLogs');
    await addDoc(colRef, {
      moderatorId,
      action,
      targetType,
      targetId,
      reason: reason.trim(),
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
};

/**
 * Fetches recent audit logs. Admin only.
 */
export const getAuditLogs = async (limitCount: number = 50): Promise<AuditLog[]> => {
  try {
    const colRef = collection(db, 'auditLogs');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
  } catch (err) {
    console.error('Failed to fetch audit logs:', err);
    return [];
  }
};
