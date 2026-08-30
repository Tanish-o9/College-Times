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
  startAfter,
  updateDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../lib/firebase';
import type { CampusEvent, User } from '../types';
import { logGroupActivityEvent } from './groupActivityService';
import { awardReputation } from './reputationService';
import { trackChallengeAction } from './challengeService';
import { logCampusActivity } from './activityCenterService';

export interface CreateEventPayload {
  title: string;
  description: string;
  location: string;
  eventDate: string; // ISO or datetime-local string
  endAt?: string;
  category?: 'Cultural' | 'Technical' | 'Sports' | 'Workshop' | 'Seminar' | 'Placement' | 'Club' | 'Academic' | 'Fest' | 'Competition' | 'Social' | 'Other';
  groupId?: string;
  groupName?: string;
  visibility?: 'campus' | 'group' | 'private';
  capacity?: number;
  coverImage?: string;
  externalUrl?: string;
}

export interface EventParticipant {
  userId: string;
  rsvpdAt: any;
}

/**
 * Parses any date format (Timestamp, Date, string, number) into Unix ms.
 */
export const parseEventDateMs = (eventDate: any): number => {
  if (!eventDate) return 0;
  if (typeof eventDate.toMillis === 'function') return eventDate.toMillis();
  if (typeof eventDate.toDate === 'function') return eventDate.toDate().getTime();
  if (eventDate instanceof Date) return eventDate.getTime();
  if (typeof eventDate === 'number') return eventDate;
  const parsed = new Date(eventDate).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Checks if user is a member of a group.
 */
export const isGroupMember = async (groupId: string, userId: string): Promise<boolean> => {
  if (!groupId || !userId) return false;
  try {
    const memberRef = doc(db, 'groups', groupId, 'members', userId);
    const snap = await getDoc(memberRef);
    return snap.exists();
  } catch (err) {
    console.error('Error checking group membership:', err);
    return false;
  }
};

/**
 * Retrieves list of joined group IDs for a user.
 */
export const getUserJoinedGroupIds = async (userId: string): Promise<string[]> => {
  if (!userId) return [];
  try {
    const userMembershipsRef = collection(db, 'users', userId, 'groupMemberships');
    const snap = await getDocs(userMembershipsRef);
    return snap.docs.map((d) => d.id);
  } catch (err) {
    console.error('Error fetching user joined groups:', err);
    return [];
  }
};

/**
 * Fetches upcoming campus events ordered by eventDate ascending.
 */
export const getUpcomingEvents = async (): Promise<CampusEvent[]> => {
  try {
    const eventsRef = collection(db, 'events');
    const querySnapshot = await getDocs(eventsRef);
    const startOfTodayMs = new Date().setHours(0, 0, 0, 0);

    const list = querySnapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as CampusEvent))
      .filter((evt) => parseEventDateMs(evt.eventDate) >= startOfTodayMs)
      .sort((a, b) => parseEventDateMs(a.eventDate) - parseEventDateMs(b.eventDate));

    return list;
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
    const querySnapshot = await getDocs(eventsRef);
    const startOfTodayMs = new Date().setHours(0, 0, 0, 0);

    const list = querySnapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as CampusEvent))
      .filter((evt) => parseEventDateMs(evt.eventDate) < startOfTodayMs)
      .sort((a, b) => parseEventDateMs(b.eventDate) - parseEventDateMs(a.eventDate));

    return list;
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
 * Creates a new campus event for any authenticated user.
 * Converts date string into a Firestore Timestamp object.
 */
export const createEvent = async (
  payload: CreateEventPayload,
  currentUser: FirebaseUser
): Promise<CampusEvent> => {
  try {
    const startDateObj = new Date(payload.eventDate);
    if (isNaN(startDateObj.getTime())) {
      throw new Error('Please select a valid start date and time.');
    }
    const eventDateTimestamp = Timestamp.fromDate(startDateObj);

    let endAtTimestamp: Timestamp | null = null;
    if (payload.endAt) {
      const endDateObj = new Date(payload.endAt);
      if (!isNaN(endDateObj.getTime())) {
        endAtTimestamp = Timestamp.fromDate(endDateObj);
      }
    }

    const eventsRef = collection(db, 'events');

    const newEventData: Record<string, any> = {
      title: payload.title.trim(),
      description: payload.description.trim(),
      location: payload.location.trim(),
      eventDate: eventDateTimestamp,
      createdBy: currentUser.uid,
      creatorName: currentUser.displayName || 'Campus Student',
      organizerName: currentUser.displayName || 'Campus Student',
      rsvpCount: 0,
      interestedCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      category: payload.category || 'Other',
      visibility: payload.visibility || (payload.groupId ? 'group' : 'campus'),
    };

    if (endAtTimestamp) newEventData.endAt = endAtTimestamp;
    if (payload.groupId) newEventData.groupId = payload.groupId;
    if (payload.groupName) newEventData.groupName = payload.groupName;
    if (payload.capacity && payload.capacity > 0) newEventData.capacity = Number(payload.capacity);
    if (payload.coverImage) newEventData.coverImage = payload.coverImage;
    if (payload.externalUrl?.trim()) {
      let rawUrl = payload.externalUrl.trim();
      if (!/^https?:\/\//i.test(rawUrl)) {
        rawUrl = `https://${rawUrl}`;
      }
      newEventData.externalUrl = rawUrl;
    }

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

    // Award reputation and track challenge
    awardReputation(currentUser.uid, docRef.id, 'create_event', 20, `Created event: ${payload.title}`).catch((e) => console.warn(e));
    trackChallengeAction(currentUser.uid, 'events', 1).catch((e) => console.warn(e));

    // Log campus activity only if PUBLIC / CAMPUS event
    if (newEventData.visibility !== 'group' && newEventData.visibility !== 'private') {
      logCampusActivity({
        type: 'event',
        action: 'created a new campus event',
        actorId: currentUser.uid,
        actorName: currentUser.displayName || 'Campus Organizer',
        actorAvatar: currentUser.photoURL || undefined,
        targetId: docRef.id,
        targetTitle: payload.title,
        previewText: payload.description?.slice(0, 150),
      });
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
      const userAvatar = userProfile?.photoURL || '';
      transaction.set(rsvpRef, {
        userId,
        userName,
        userAvatar,
        rsvpdAt: serverTimestamp(),
      });
      updatedCount = currentCount + 1;
      transaction.update(eventRef, { rsvpCount: increment(1) });
      isNowRsvpd = true;
    }
  });

  if (isNowRsvpd) {
    logCampusActivity(
      {
        type: 'event',
        action: "RSVP'd to an event",
        actorId: userId,
        actorName: userProfile?.displayName || 'Student',
        actorAvatar: userProfile?.photoURL || undefined,
        targetId: eventId,
      },
      `rsvp_${eventId}_${userId}`
    );
  }

  return { rsvpd: isNowRsvpd, newRsvpCount: updatedCount };
};

/**
 * Fetches RSVP participants for an event.
 */
export const getEventParticipants = async (
  eventId: string,
  limitCount: number = 20
): Promise<{ userId: string; userName: string; userAvatar?: string }[]> => {
  try {
    const rsvpsRef = collection(db, 'events', eventId, 'rsvps');
    const q = query(rsvpsRef, limit(limitCount));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      userId: docSnap.id,
      userName: docSnap.data().userName || 'Student',
      userAvatar: docSnap.data().userAvatar || '',
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
): Promise<{ status: string; rsvpCount: number; interestedCount: number; waitlisted?: boolean }> => {
  if (!eventId || !userId) throw new Error('Event ID and User ID required.');

  const eventRef = doc(db, 'events', eventId);
  const rsvpRef = doc(db, 'events', eventId, 'rsvps', userId);
  const waitlistUserRef = doc(db, 'events', eventId, 'waitlist', userId);

  // Fetch next waitlist candidate outside transaction
  const waitlistRef = collection(db, 'events', eventId, 'waitlist');
  const waitlistSnap = await getDocs(query(waitlistRef, orderBy('joinedAt', 'asc'), limit(1)));
  let nextWaitlistUid: string | null = null;
  let nextWaitlistData: any = null;
  if (!waitlistSnap.empty) {
    nextWaitlistUid = waitlistSnap.docs[0].id;
    nextWaitlistData = waitlistSnap.docs[0].data();
  }

  let updatedRsvpCount = 0;
  let updatedInterestedCount = 0;
  let waitlisted = false;

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

    // Handle joining waitlist if going is requested but capacity is reached
    if (newStatus === 'going' && capacity > 0 && prevStatus !== 'going' && currentRsvp >= capacity) {
      // Add to waitlist instead of RSVPing
      transaction.set(waitlistUserRef, {
        userId,
        userName: userProfile?.displayName || 'Student',
        joinedAt: serverTimestamp(),
      });
      waitlisted = true;
      updatedRsvpCount = currentRsvp;
      updatedInterestedCount = currentInterested;
      return;
    }

    let deltaRsvp = 0;
    let deltaInterested = 0;

    // Remove previous status counts
    if (prevStatus === 'going') deltaRsvp -= 1;
    if (prevStatus === 'interested') deltaInterested -= 1;

    // Add new status counts
    if (newStatus === 'going') deltaRsvp += 1;
    if (newStatus === 'interested') deltaInterested += 1;

    // If a going seat is vacated and there is someone in the waitlist, promote them!
    if (prevStatus === 'going' && newStatus !== 'going' && nextWaitlistUid) {
      const nextPersonRef = doc(db, 'events', eventId, 'waitlist', nextWaitlistUid);
      transaction.delete(nextPersonRef);

      const nextRsvpRef = doc(db, 'events', eventId, 'rsvps', nextWaitlistUid);
      transaction.set(nextRsvpRef, {
        userId: nextWaitlistUid,
        status: 'going',
        userName: nextWaitlistData.userName || 'Student',
        updatedAt: serverTimestamp(),
      });
      
      // Because we vacant one (deltaRsvp -= 1) and promote one (deltaRsvp += 1), net deltaRsvp is 0
      deltaRsvp += 1; 
    }

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

    // Remove from waitlist if changing to non-going status
    if (newStatus !== 'going') {
      transaction.delete(waitlistUserRef);
    }

    transaction.update(eventRef, {
      rsvpCount: updatedRsvpCount,
      interestedCount: updatedInterestedCount,
      updatedAt: serverTimestamp(),
    });
  });

  if (waitlisted) {
    return {
      status: 'waitlist',
      rsvpCount: updatedRsvpCount,
      interestedCount: updatedInterestedCount,
      waitlisted: true,
    };
  }

  if (newStatus === 'going') {
    awardReputation(userId, `rsvp_${eventId}`, 'attend_event', 10, 'RSVPed to event').catch((e) => console.warn(e));
    trackChallengeAction(userId, 'events', 1).catch((e) => console.warn(e));
  }

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
  tab: 'upcoming' | 'today' | 'this_week' | 'this_month' | 'my_events' | 'past';
  category?: string;
  searchQuery?: string;
}

export const getEventsFiltered = async (
  filters: EventFilters,
  currentUser: FirebaseUser
): Promise<CampusEvent[]> => {
  if (!currentUser) return [];

  try {
    const eventsRef = collection(db, 'events');
    const [snap, userJoinedGroups] = await Promise.all([
      getDocs(eventsRef),
      getUserJoinedGroupIds(currentUser.uid),
    ]);

    let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CampusEvent));

    // 1. Privacy / Visibility Gate: Keep event IF public/campus OR user is group member OR creator
    const joinedSet = new Set(userJoinedGroups);
    list = list.filter((e) => {
      if (!e.groupId) return true;
      if (!e.visibility || e.visibility === 'campus' || (e.visibility as any) === 'public') return true;
      if (joinedSet.has(e.groupId)) return true;
      if (e.createdBy === currentUser.uid) return true;
      return false;
    });

    // 2. Tab Filter by Date Range
    const startOfTodayMs = new Date().setHours(0, 0, 0, 0);
    const todayEndMs = new Date().setHours(23, 59, 59, 999);
    const weekEndMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const monthEndMs = Date.now() + 30 * 24 * 60 * 60 * 1000;

    if (filters.tab === 'past') {
      list = list.filter((e) => parseEventDateMs(e.eventDate) < startOfTodayMs);
      list.sort((a, b) => parseEventDateMs(b.eventDate) - parseEventDateMs(a.eventDate));
    } else if (filters.tab === 'today') {
      list = list.filter((e) => {
        const ms = parseEventDateMs(e.eventDate);
        return ms >= startOfTodayMs && ms <= todayEndMs;
      });
      list.sort((a, b) => parseEventDateMs(a.eventDate) - parseEventDateMs(b.eventDate));
    } else if (filters.tab === 'this_week') {
      list = list.filter((e) => {
        const ms = parseEventDateMs(e.eventDate);
        return ms >= startOfTodayMs && ms <= weekEndMs;
      });
      list.sort((a, b) => parseEventDateMs(a.eventDate) - parseEventDateMs(b.eventDate));
    } else if (filters.tab === 'this_month') {
      list = list.filter((e) => {
        const ms = parseEventDateMs(e.eventDate);
        return ms >= startOfTodayMs && ms <= monthEndMs;
      });
      list.sort((a, b) => parseEventDateMs(a.eventDate) - parseEventDateMs(b.eventDate));
    } else if (filters.tab === 'my_events') {
      try {
        const rsvpsQuery = query(
          collectionGroup(db, 'rsvps'),
          where('userId', '==', currentUser.uid)
        );
        const rsvpsSnap = await getDocs(rsvpsQuery);
        const rsvpdEventIds = new Set(
          rsvpsSnap.docs.map((d) => d.ref.parent.parent?.id).filter(Boolean) as string[]
        );
        list = list.filter((e) => e.id && (rsvpdEventIds.has(e.id) || e.createdBy === currentUser.uid));
      } catch {
        list = list.filter((e) => e.createdBy === currentUser.uid);
      }
      list.sort((a, b) => parseEventDateMs(a.eventDate) - parseEventDateMs(b.eventDate));
    } else {
      // 'upcoming' (default)
      list = list.filter((e) => parseEventDateMs(e.eventDate) >= startOfTodayMs);
      list.sort((a, b) => parseEventDateMs(a.eventDate) - parseEventDateMs(b.eventDate));
    }

    // 3. Category Filter
    if (filters.category && filters.category !== 'All') {
      list = list.filter((e) => e.category === filters.category);
    }

    // 4. Search Filter
    if (filters.searchQuery) {
      const sLower = filters.searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(sLower) ||
          (e.description || '').toLowerCase().includes(sLower) ||
          (e.location || '').toLowerCase().includes(sLower) ||
          (e.groupName || '').toLowerCase().includes(sLower)
      );
    }

    return list;
  } catch (error: any) {
    console.error('Error in getEventsFiltered:', error);
    throw new Error(error.message || 'Unable to load campus events.');
  }
};

/**
 * Fetches upcoming group events.
 */
export const getUpcomingGroupEvents = async (groupId: string): Promise<CampusEvent[]> => {
  if (!groupId) return [];
  try {
    const eventsRef = collection(db, 'events');
    const q = query(eventsRef, where('groupId', '==', groupId));
    const snap = await getDocs(q);
    const nowMs = Date.now();

    return snap.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as CampusEvent))
      .filter((evt) => parseEventDateMs(evt.eventDate) >= nowMs)
      .sort((a, b) => parseEventDateMs(a.eventDate) - parseEventDateMs(b.eventDate));
  } catch (error) {
    console.error('Error fetching upcoming group events:', error);
    return [];
  }
};

/**
 * Fetches past group events.
 */
export const getPastGroupEvents = async (groupId: string): Promise<CampusEvent[]> => {
  if (!groupId) return [];
  try {
    const eventsRef = collection(db, 'events');
    const q = query(eventsRef, where('groupId', '==', groupId));
    const snap = await getDocs(q);
    const nowMs = Date.now();

    return snap.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as CampusEvent))
      .filter((evt) => parseEventDateMs(evt.eventDate) < nowMs)
      .sort((a, b) => parseEventDateMs(b.eventDate) - parseEventDateMs(a.eventDate));
  } catch (error) {
    console.error('Error fetching past group events:', error);
    return [];
  }
};

/**
 * Pin or unpin an event in a group (admin/owner only).
 */
export const pinEvent = async (
  eventId: string,
  isPinned: boolean
): Promise<void> => {
  if (!eventId) return;
  const eventRef = doc(db, 'events', eventId);
  await updateDoc(eventRef, {
    pinned: isPinned,
    pinnedAt: isPinned ? serverTimestamp() : null,
  });
};

/**
 * Toggles saving/bookmarking an event for the current user.
 * Path: users/{uid}/savedEvents/{eventId}
 */
export const toggleSaveEvent = async (
  eventId: string,
  currentUser: FirebaseUser
): Promise<boolean> => {
  if (!currentUser || !eventId) throw new Error('Authentication required.');
  const uid = currentUser.uid;
  const saveRef = doc(db, 'users', uid, 'savedEvents', eventId);

  const snap = await getDoc(saveRef);
  if (snap.exists()) {
    await deleteDoc(saveRef);
    return false;
  } else {
    await setDoc(saveRef, {
      eventId,
      savedAt: serverTimestamp(),
    });
    return true;
  }
};

/**
 * Checks if user has bookmarked an event.
 */
export const checkEventIsSaved = async (eventId: string, uid: string): Promise<boolean> => {
  if (!eventId || !uid) return false;
  try {
    const saveRef = doc(db, 'users', uid, 'savedEvents', eventId);
    const snap = await getDoc(saveRef);
    return snap.exists();
  } catch {
    return false;
  }
};

/**
 * Fetches events saved/bookmarked by the current user.
 */
export const getSavedEvents = async (currentUser: FirebaseUser): Promise<CampusEvent[]> => {
  if (!currentUser) return [];
  try {
    const savesRef = collection(db, 'users', currentUser.uid, 'savedEvents');
    const snap = await getDocs(savesRef);
    const ids = snap.docs.map((d) => d.id);

    const results = await Promise.all(ids.map((id) => getEventById(id)));
    return results.filter((e): e is CampusEvent => e !== null);
  } catch (err) {
    console.error('Error fetching saved events:', err);
    return [];
  }
};

