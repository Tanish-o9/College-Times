import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  runTransaction, 
  increment, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../lib/firebase';
import type { CampusEvent, User } from '../types';

export interface CreateEventPayload {
  title: string;
  description: string;
  location: string;
  eventDate: string; // ISO date string from date picker input
}

export interface EventParticipant {
  userId: string;
  rsvpdAt: any;
}

/**
 * Fetches upcoming campus events ordered by eventDate ascending.
 */
export const getUpcomingEvents = async (): Promise<CampusEvent[]> => {
  try {
    const eventsRef = collection(db, 'events');
    const now = Timestamp.now();
    const q = query(
      eventsRef,
      where('eventDate', '>=', now),
      orderBy('eventDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as CampusEvent[];
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    throw error;
  }
};

/**
 * Fetches past campus events ordered by eventDate descending.
 */
export const getPastEvents = async (): Promise<CampusEvent[]> => {
  try {
    const eventsRef = collection(db, 'events');
    const now = Timestamp.now();
    const q = query(
      eventsRef,
      where('eventDate', '<', now),
      orderBy('eventDate', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as CampusEvent[];
  } catch (error) {
    console.error('Error fetching past events:', error);
    throw error;
  }
};

/**
 * Fetches a single event document by ID.
 */
export const getEventById = async (eventId: string): Promise<CampusEvent | null> => {
  try {
    const eventRef = doc(db, 'events', eventId);
    const snap = await getDoc(eventRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as CampusEvent;
  } catch (error) {
    console.error('Error fetching event by ID:', error);
    return null;
  }
};

/**
 * Creates a new campus event (admin only).
 * Converts date string into a Firestore Timestamp object.
 */
export const createEvent = async (
  payload: CreateEventPayload,
  currentUser: FirebaseUser
): Promise<CampusEvent> => {
  try {
    const eventsRef = collection(db, 'events');
    const eventDateTimestamp = Timestamp.fromDate(new Date(payload.eventDate));

    const newEventData = {
      title: payload.title.trim(),
      description: payload.description.trim(),
      location: payload.location.trim(),
      eventDate: eventDateTimestamp,
      createdBy: currentUser.uid,
      rsvpCount: 0,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(eventsRef, newEventData);

    return {
      id: docRef.id,
      ...newEventData,
    } as CampusEvent;
  } catch (error: any) {
    console.error('Error creating event:', error);
    throw new Error(error.message || 'Failed to create campus event.');
  }
};

/**
 * Checks whether a user has RSVP'd to an event.
 */
export const hasUserRsvpd = async (eventId: string, userId: string): Promise<boolean> => {
  if (!eventId || !userId) return false;
  try {
    const rsvpRef = doc(db, 'events', eventId, 'rsvps', userId);
    const snap = await getDoc(rsvpRef);
    return snap.exists();
  } catch (error) {
    console.error('Error checking RSVP status:', error);
    return false;
  }
};

/**
 * Atomically toggles an RSVP for an event.
 * Manages `events/{eventId}/rsvps/{userId}` and parent `rsvpCount` in a transaction.
 */
export const toggleRsvp = async (
  eventId: string,
  userId: string,
  userProfile?: User | null
): Promise<{ rsvpd: boolean; newRsvpCount: number }> => {
  if (!eventId || !userId) {
    throw new Error('Event ID and User ID are required to toggle RSVP.');
  }

  const rsvpRef = doc(db, 'events', eventId, 'rsvps', userId);
  const eventRef = doc(db, 'events', eventId);

  let isNowRsvpd = false;
  let updatedCount = 0;

  await runTransaction(db, async (transaction) => {
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists()) {
      throw new Error('Event does not exist');
    }

    const rsvpSnap = await transaction.get(rsvpRef);
    const currentCount = eventSnap.data().rsvpCount ?? 0;

    if (rsvpSnap.exists()) {
      // Remove RSVP
      transaction.delete(rsvpRef);
      updatedCount = Math.max(0, currentCount - 1);
      transaction.update(eventRef, { rsvpCount: increment(-1) });
      isNowRsvpd = false;
    } else {
      // Add RSVP
      const userName = userProfile?.displayName || 'Student';
      transaction.set(rsvpRef, {
        userId,
        userName,
        rsvpdAt: serverTimestamp(),
      });
      updatedCount = currentCount + 1;
      transaction.update(eventRef, { rsvpCount: increment(1) });
      isNowRsvpd = true;
    }
  });

  return { rsvpd: isNowRsvpd, newRsvpCount: updatedCount };
};

/**
 * Fetches RSVP participants for an event.
 */
export const getEventParticipants = async (
  eventId: string,
  limitCount: number = 20
): Promise<{ userId: string; userName: string }[]> => {
  try {
    const rsvpsRef = collection(db, 'events', eventId, 'rsvps');
    const q = query(rsvpsRef, limit(limitCount));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      userId: docSnap.id,
      userName: docSnap.data().userName || 'Student',
    }));
  } catch (error) {
    console.error('Error fetching event participants:', error);
    return [];
  }
};
