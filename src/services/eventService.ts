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
  Timestamp,
  collectionGroup,
  startAfter
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../lib/firebase';
import type { CampusEvent, User } from '../types';
import { logGroupActivityEvent } from './groupActivityService';

export interface CreateEventPayload {
  title: string;
  description: string;
  location: string;
  eventDate: string; // ISO date string from date picker input
  groupId?: string;
  visibility?: 'campus' | 'group' | 'private';
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
      ...(payload.groupId ? { groupId: payload.groupId } : {}),
      ...(payload.visibility ? { visibility: payload.visibility } : {}),
    };

    const docRef = await addDoc(eventsRef, newEventData);

    if (payload.groupId) {
      await logGroupActivityEvent(
        payload.groupId,
        'event',
        currentUser.uid,
        currentUser.displayName || 'Group Member',
        currentUser.photoURL || undefined,
        docRef.id,
        'event',
        `Created event: ${payload.title}`
      );
    }

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

export const getEventParticipantsPaginated = async (
  eventId: string,
  lastVisibleSnap: any = null,
  limitCount: number = 20
) => {
  try {
    const rsvpsRef = collection(db, 'events', eventId, 'rsvps');
    let q = query(rsvpsRef, limit(limitCount));
    if (lastVisibleSnap) {
      q = query(rsvpsRef, startAfter(lastVisibleSnap), limit(limitCount));
    }
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((docSnap) => ({
      userId: docSnap.id,
      userName: docSnap.data().userName || 'Student',
    }));
    return {
      participants: list,
      lastVisible: snapshot.docs[snapshot.docs.length - 1] || null,
    };
  } catch (error) {
    console.error('Error fetching event participants paginated:', error);
    return { participants: [], lastVisible: null };
  }
};

/**
 * Phase 29: Atomically updates RSVP status ('going' | 'interested' | 'maybe' | 'cancelled').
 * Enforces capacity server-side for 'going' status.
 */
export const toggleRsvpStatus = async (
  eventId: string,
  userId: string,
  newStatus: 'going' | 'interested' | 'maybe' | 'cancelled',
  userProfile?: User | null
): Promise<{ status: string; rsvpCount: number; interestedCount: number }> => {
  if (!eventId || !userId) throw new Error('Event ID and User ID required.');

  const eventRef = doc(db, 'events', eventId);
  const rsvpRef = doc(db, 'events', eventId, 'rsvps', userId);

  let updatedRsvpCount = 0;
  let updatedInterestedCount = 0;

  await runTransaction(db, async (transaction) => {
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists()) throw new Error('Event does not exist.');

    const eventData = eventSnap.data() as CampusEvent;
    if (eventData.status === 'cancelled' || eventData.isCancelled) {
      throw new Error('Cannot RSVP to a cancelled event.');
    }

    const currentRsvp = eventData.rsvpCount || 0;
    const currentInterested = eventData.interestedCount || 0;
    const capacity = eventData.capacity || 0;

    const rsvpSnap = await transaction.get(rsvpRef);
    const prevStatus = rsvpSnap.exists() ? rsvpSnap.data().status : null;

    if (newStatus === 'going' && capacity > 0 && prevStatus !== 'going' && currentRsvp >= capacity) {
      throw new Error(`Registration capacity (${capacity}) has been reached.`);
    }

    let deltaRsvp = 0;
    let deltaInterested = 0;

    // Remove previous status counts
    if (prevStatus === 'going') deltaRsvp -= 1;
    if (prevStatus === 'interested') deltaInterested -= 1;

    // Add new status counts
    if (newStatus === 'going') deltaRsvp += 1;
    if (newStatus === 'interested') deltaInterested += 1;

    updatedRsvpCount = Math.max(0, currentRsvp + deltaRsvp);
    updatedInterestedCount = Math.max(0, currentInterested + deltaInterested);

    if (newStatus === 'cancelled') {
      transaction.delete(rsvpRef);
    } else {
      transaction.set(rsvpRef, {
        userId,
        status: newStatus,
        userName: userProfile?.displayName || 'Student',
        updatedAt: serverTimestamp(),
      });
    }

    transaction.update(eventRef, {
      rsvpCount: updatedRsvpCount,
      interestedCount: updatedInterestedCount,
      updatedAt: serverTimestamp(),
    });
  });

  return {
    status: newStatus,
    rsvpCount: updatedRsvpCount,
    interestedCount: updatedInterestedCount,
  };
};

/**
 * Phase 29: Cancels an event (organizer or admin only).
 */
export const cancelEvent = async (
  eventId: string,
  reason: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!eventId || !currentUser) throw new Error('Event ID and User required.');

  const eventRef = doc(db, 'events', eventId);
  const snap = await getDoc(eventRef);
  if (!snap.exists()) throw new Error('Event not found.');

  const data = snap.data() as CampusEvent;
  if (data.createdBy !== currentUser.uid) {
    throw new Error('Unauthorized to cancel this event.');
  }

  await runTransaction(db, async (transaction) => {
    transaction.update(eventRef, {
      status: 'cancelled',
      isCancelled: true,
      cancellationReason: reason.trim().slice(0, 300),
      updatedAt: serverTimestamp(),
    });
  });
};

/**
 * Phase 29: Edits an event (organizer or admin only).
 */
export const editEvent = async (
  eventId: string,
  updates: Partial<CampusEvent>,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!eventId || !currentUser) throw new Error('Event ID and User required.');

  const eventRef = doc(db, 'events', eventId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(eventRef);
    if (!snap.exists()) throw new Error('Event not found.');

    const data = snap.data() as CampusEvent;
    if (data.createdBy !== currentUser.uid) {
      throw new Error('Unauthorized to edit this event.');
    }

    const payload = {
      ...updates,
      updatedAt: serverTimestamp(),
    };
    delete payload.id;
    delete payload.createdBy;
    delete payload.rsvpCount;
    delete payload.createdAt;

    transaction.update(eventRef, payload);
  });
};

export interface EventFilters {
  tab: 'upcoming' | 'today' | 'this_week' | 'my_events' | 'past';
  category?: string;
  searchQuery?: string;
}

export const getEventsFiltered = async (
  filters: EventFilters,
  currentUser: FirebaseUser
): Promise<CampusEvent[]> => {
  if (!currentUser) return [];
  const eventsRef = collection(db, 'events');
  let q;

  const now = Timestamp.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);

  if (filters.tab === 'past') {
    q = query(eventsRef, where('eventDate', '<', now), orderBy('eventDate', 'desc'), limit(50));
  } else if (filters.tab === 'today') {
    q = query(
      eventsRef,
      where('eventDate', '>=', Timestamp.fromDate(todayStart)),
      where('eventDate', '<=', Timestamp.fromDate(todayEnd)),
      orderBy('eventDate', 'asc'),
      limit(50)
    );
  } else if (filters.tab === 'this_week') {
    q = query(
      eventsRef,
      where('eventDate', '>=', now),
      where('eventDate', '<=', Timestamp.fromDate(weekEnd)),
      orderBy('eventDate', 'asc'),
      limit(50)
    );
  } else if (filters.tab === 'my_events') {
    const rsvpsQuery = query(
      collectionGroup(db, 'rsvps'),
      where('userId', '==', currentUser.uid)
    );
    const rsvpsSnap = await getDocs(rsvpsQuery);
    const eventIds = rsvpsSnap.docs.map((d) => d.ref.parent.parent?.id).filter(Boolean) as string[];

    if (eventIds.length === 0) return [];

    const eventsList: CampusEvent[] = [];
    // Firestore limit in queries to maximum of 10
    for (let i = 0; i < eventIds.length; i += 10) {
      const batchIds = eventIds.slice(i, i + 10);
      const batchQuery = query(eventsRef, where('__name__', 'in', batchIds));
      const batchSnap = await getDocs(batchQuery);
      batchSnap.docs.forEach((docSnap) => {
        eventsList.push({ id: docSnap.id, ...docSnap.data() } as CampusEvent);
      });
    }
    return eventsList;
  } else {
    q = query(eventsRef, where('eventDate', '>=', now), orderBy('eventDate', 'asc'), limit(50));
  }

  const snap = await getDocs(q);
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CampusEvent[];

  if (filters.category && filters.category !== 'All') {
    list = list.filter((e) => e.category === filters.category);
  }
  if (filters.searchQuery) {
    const sLower = filters.searchQuery.toLowerCase();
    list = list.filter(
      (e) =>
        e.title.toLowerCase().includes(sLower) ||
        (e.description || '').toLowerCase().includes(sLower) ||
        (e.location || '').toLowerCase().includes(sLower)
    );
  }

  return list;
};

/**
 * Fetches upcoming group events.
 */
export const getUpcomingGroupEvents = async (groupId: string): Promise<CampusEvent[]> => {
  try {
    const eventsRef = collection(db, 'events');
    const now = Timestamp.now();
    const q = query(
      eventsRef,
      where('groupId', '==', groupId),
      where('eventDate', '>=', now),
      orderBy('eventDate', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as CampusEvent[];
  } catch (error) {
    console.error('Error fetching upcoming group events:', error);
    throw error;
  }
};

/**
 * Fetches past group events.
 */
export const getPastGroupEvents = async (groupId: string): Promise<CampusEvent[]> => {
  try {
    const eventsRef = collection(db, 'events');
    const now = Timestamp.now();
    const q = query(
      eventsRef,
      where('groupId', '==', groupId),
      where('eventDate', '<', now),
      orderBy('eventDate', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as CampusEvent[];
  } catch (error) {
    console.error('Error fetching past group events:', error);
    throw error;
  }
};
