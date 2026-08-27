import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import { createNotification } from './notificationService';

export interface EventReminderRecord {
  userId: string;
  createdAt: any;
}

/**
 * Checks whether user has enabled reminder for specified event.
 */
export const hasUserReminder = async (eventId: string, userId: string): Promise<boolean> => {
  if (!eventId || !userId) return false;
  try {
    const reminderRef = doc(db, 'events', eventId, 'reminders', userId);
    const snap = await getDoc(reminderRef);
    return snap.exists();
  } catch (err) {
    return false;
  }
};

/**
 * Toggles event reminder status for user.
 */
export const toggleEventReminder = async (
  eventId: string,
  userId: string,
  eventTitle?: string
): Promise<boolean> => {
  if (!eventId || !userId) throw new Error('Event ID and User ID required.');

  const reminderRef = doc(db, 'events', eventId, 'reminders', userId);
  let isEnabled = false;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(reminderRef);
    if (snap.exists()) {
      transaction.delete(reminderRef);
      isEnabled = false;
    } else {
      transaction.set(reminderRef, {
        userId,
        createdAt: serverTimestamp(),
      });
      isEnabled = true;
    }
  });

  if (isEnabled) {
    createNotification({
      recipientId: userId,
      type: 'event_reminder',
      title: 'Event Reminder Enabled',
      message: `You will receive a notification reminder before "${eventTitle || 'Event'}" starts.`,
      deepLink: `/events/${eventId}`,
    }).catch(() => {});
  }

  logAnalyticsEvent('event_reminder_enabled', { eventId, isEnabled });
  return isEnabled;
};
