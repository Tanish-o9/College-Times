import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import { createNotification } from './notificationService';

/**
 * Checks if user has enabled reminder for an opportunity.
 */
export const hasUserOpportunityReminder = async (opportunityId: string, uid: string): Promise<boolean> => {
  if (!opportunityId || !uid) return false;
  try {
    const remRef = doc(db, 'opportunities', opportunityId, 'reminders', uid);
    const snap = await getDoc(remRef);
    return snap.exists();
  } catch (err) {
    return false;
  }
};

/**
 * Toggles opportunity deadline reminder status.
 * Path: opportunities/{opportunityId}/reminders/{uid}
 */
export const toggleOpportunityReminder = async (
  opportunityId: string,
  currentUser: FirebaseUser,
  opportunityTitle?: string
): Promise<boolean> => {
  if (!currentUser || !opportunityId) throw new Error('Authentication required.');
  const uid = currentUser.uid;

  const remRef = doc(db, 'opportunities', opportunityId, 'reminders', uid);
  let isEnabled = false;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(remRef);
    if (snap.exists()) {
      transaction.delete(remRef);
      isEnabled = false;
    } else {
      transaction.set(remRef, {
        userId: uid,
        createdAt: serverTimestamp(),
      });
      isEnabled = true;
    }
  });

  if (isEnabled) {
    createNotification({
      recipientId: uid,
      type: 'opportunity_deadline_reminder',
      title: 'Opportunity Reminder Enabled 🎯',
      message: `You will receive a notification reminder before "${opportunityTitle || 'Opportunity'}" deadline closes.`,
      deepLink: `/opportunities/${opportunityId}`,
    }).catch(() => {});
  }

  logAnalyticsEvent('opportunity_reminder_enabled', { opportunityId, isEnabled });
  return isEnabled;
};
