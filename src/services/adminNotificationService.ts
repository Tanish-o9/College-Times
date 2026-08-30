import type { User as FirebaseUser } from 'firebase/auth';

export const PRIMARY_ADMIN_EMAIL = 'tanish25153162@akgec.ac.in';
export const ADMIN_EMAILS = [PRIMARY_ADMIN_EMAIL];

export interface AdminNotificationPayload {
  type: 'report' | 'moderation' | 'block' | 'confession_report' | 'event_report' | 'group_report';
  title: string;
  message: string;
  targetId?: string;
  targetUserId?: string;
}

/**
 * Checks whether an email belongs to a designated platform administrator.
 */
export const isEmailAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

/**
 * Dispatches an admin alert/notification pipeline payload for moderation incidents.
 */
export const sendAdminNotification = async (
  payload: AdminNotificationPayload,
  triggeredBy?: FirebaseUser | null
): Promise<void> => {
  try {
    console.log(`[ADMIN NOTIFICATION -> ${PRIMARY_ADMIN_EMAIL}]`, {
      ...payload,
      triggeredBy: triggeredBy?.email || triggeredBy?.uid || 'system',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error dispatching admin notification alert:', err);
  }
};
