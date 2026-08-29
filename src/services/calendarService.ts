import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface PersonalReminder {
  id?: string;
  userId: string;
  title: string;
  description: string;
  scheduledFor: any; // Firestore Timestamp or string representation
  priority: 'low' | 'normal' | 'important' | 'critical';
  status: 'pending' | 'completed';
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Creates a personal reminder subdocument under users/{uid}/reminders
 */
export const createReminder = async (userId: string, reminder: Omit<PersonalReminder, 'id' | 'userId'>): Promise<string> => {
  if (!userId) throw new Error('User ID is required to create a reminder.');
  const remindersColl = collection(db, 'users', userId, 'reminders');
  const docRef = await addDoc(remindersColl, {
    ...reminder,
    userId,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Updates a personal reminder subdocument
 */
export const updateReminder = async (userId: string, reminderId: string, updates: Partial<PersonalReminder>): Promise<void> => {
  if (!userId || !reminderId) throw new Error('User ID and Reminder ID are required.');
  const reminderDoc = doc(db, 'users', userId, 'reminders', reminderId);
  await updateDoc(reminderDoc, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Deletes a personal reminder subdocument
 */
export const deleteReminder = async (userId: string, reminderId: string): Promise<void> => {
  if (!userId || !reminderId) throw new Error('User ID and Reminder ID are required.');
  const reminderDoc = doc(db, 'users', userId, 'reminders', reminderId);
  await deleteDoc(reminderDoc);
};

/**
 * Retrieves all personal reminders for a user sorted by scheduled time
 */
export const getUserReminders = async (userId: string): Promise<PersonalReminder[]> => {
  if (!userId) return [];
  try {
    const remindersColl = collection(db, 'users', userId, 'reminders');
    const q = query(remindersColl, orderBy('scheduledFor', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as PersonalReminder));
  } catch (err) {
    console.error('Failed to get reminders:', err);
    return [];
  }
};

export interface CalendarEventItem {
  id: string;
  title: string;
  description?: string;
  type: 'college_event' | 'group_event' | 'reminder' | 'deadline';
  date: Date;
  location?: string;
  priority?: 'low' | 'normal' | 'important' | 'critical';
  status?: string;
}

/**
 * Aggregates all user-specific calendar items:
 * 1. RSVP'd College and Group Events
 * 2. Personal reminders
 * 3. Opportunity deadlines
 */
export const getAggregatedCalendarItems = async (userId: string): Promise<CalendarEventItem[]> => {
  if (!userId) return [];

  const items: CalendarEventItem[] = [];

  try {
    // 1. Fetch personal reminders
    const reminders = await getUserReminders(userId);
    reminders.forEach((r) => {
      let dateObj = new Date();
      if (r.scheduledFor) {
        dateObj = r.scheduledFor.toDate ? r.scheduledFor.toDate() : new Date(r.scheduledFor);
      }
      items.push({
        id: r.id || '',
        title: r.title,
        description: r.description,
        type: 'reminder',
        date: dateObj,
        priority: r.priority,
        status: r.status,
      });
    });

    // 2. Fetch User RSVPs to events
    // We fetch user's rsvp collection-group documents
    const rsvpSnap = await getDocs(query(collection(db, 'events')));
    for (const docSnap of rsvpSnap.docs) {
      const eventData = docSnap.data();
      const rsvpCheck = await getDocs(query(collection(db, 'events', docSnap.id, 'rsvps'), where('userId', '==', userId)));
      
      if (!rsvpCheck.empty) {
        let dateObj = new Date();
        if (eventData.eventDate) {
          dateObj = eventData.eventDate.toDate ? eventData.eventDate.toDate() : new Date(eventData.eventDate);
        }
        items.push({
          id: docSnap.id,
          title: eventData.title,
          description: eventData.description,
          type: eventData.groupId ? 'group_event' : 'college_event',
          date: dateObj,
          location: eventData.location,
        });
      }
    }

    // 3. Fetch Job Opportunity deadlines user is interested in
    const appSnap = await getDocs(collection(db, 'users', userId, 'applications'));
    for (const appDoc of appSnap.docs) {
      const appData = appDoc.data();
      const oppSnap = await getDocs(query(collection(db, 'opportunities'), where('id', '==', appData.opportunityId)));
      if (!oppSnap.empty) {
        const oppData = oppSnap.docs[0].data();
        if (oppData.deadline) {
          const dateObj = oppData.deadline.toDate ? oppData.deadline.toDate() : new Date(oppData.deadline);
          items.push({
            id: appData.opportunityId,
            title: `Deadline: ${oppData.title}`,
            description: `Opportunity application deadline for ${oppData.organizationName || oppData.organization || 'Organization'}`,
            type: 'deadline',
            date: dateObj,
          });
        }
      }
    }

    // 4. Fetch Academic Assignments
    try {
      const { getUserAssignments } = await import('./academicService');
      const assignments = await getUserAssignments(userId);
      assignments.forEach((asm) => {
        if (asm.deadline) {
          items.push({
            id: asm.id || '',
            title: `Assignment: ${asm.title}`,
            description: `Checklist item for subject ${asm.subjectCode}`,
            type: 'deadline',
            date: new Date(asm.deadline),
            status: asm.status,
          });
        }
      });
    } catch (e) {
      console.warn('Failed to load assignments for calendar:', e);
    }

    // 5. Fetch Challenges
    try {
      const { getActiveChallenges } = await import('./challengeService');
      const challenges = await getActiveChallenges();
      challenges.forEach((ch) => {
        if (ch.endDate) {
          const dateObj = ch.endDate.toDate ? ch.endDate.toDate() : new Date(ch.endDate);
          items.push({
            id: ch.id || '',
            title: `Challenge End: ${ch.title}`,
            description: ch.description,
            type: 'deadline',
            date: dateObj,
          });
        }
      });
    } catch (e) {
      console.warn('Failed to load challenges for calendar:', e);
    }

    // 6. Fetch Support Tickets
    try {
      const { getUserSupportTickets } = await import('./supportTicketService');
      const tickets = await getUserSupportTickets(userId);
      tickets.forEach((t) => {
        const dateObj = t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
        const deadlineDate = new Date(dateObj.getTime() + 3 * 24 * 60 * 60 * 1000);
        items.push({
          id: t.id || '',
          title: `Support Ticket Due: ${t.title}`,
          description: `Category: ${t.category} • Status: ${t.status}`,
          type: 'deadline',
          date: deadlineDate,
          priority: t.priority === 'medium' ? 'normal' : (t.priority === 'high' ? 'important' : t.priority),
          status: t.status,
        });
      });
    } catch (e) {
      console.warn('Failed to load support tickets for calendar:', e);
    }
  } catch (err) {
    console.error('Error aggregating calendar events:', err);
  }

  return items;
};
