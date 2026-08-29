import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ActivitySignal {
  signalType: 'post_view' | 'post_like' | 'post_comment' | 'post_save' | 'group_view' | 'group_join' | 'event_view' | 'event_rsvp' | 'profile_view' | 'search';
  entityId: string;
  timestamp: any;
  metadata?: any;
}

// Client-side in-memory queue to batch writes
let signalQueue: { userId: string; signal: ActivitySignal }[] = [];
let flushTimeout: any = null;

const FLUSH_INTERVAL_MS = 10000; // 10 seconds
const MAX_QUEUE_SIZE = 5;

/**
 * Flush signal queue to Firestore using writeBatch.
 */
const flushQueue = async () => {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  if (signalQueue.length === 0) return;

  const currentBatchQueue = [...signalQueue];
  signalQueue = [];

  try {
    const batch = writeBatch(db);
    currentBatchQueue.forEach(({ userId, signal }) => {
      const colRef = collection(db, 'users', userId, 'activitySignals');
      const docRef = doc(colRef);
      batch.set(docRef, {
        ...signal,
        timestamp: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (err) {
    console.error('Failed to flush activity signals:', err);
  }
};

/**
 * Records an activity signal with batched database writes.
 */
export const recordActivitySignal = (
  userId: string,
  signalType: ActivitySignal['signalType'],
  entityId: string,
  metadata?: any
): void => {
  if (!userId || !entityId) return;

  const signal: ActivitySignal = {
    signalType,
    entityId,
    timestamp: null, // set serverTimestamp in flush
    metadata: metadata || null,
  };

  signalQueue.push({ userId, signal });

  if (signalQueue.length >= MAX_QUEUE_SIZE) {
    flushQueue();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(flushQueue, FLUSH_INTERVAL_MS);
  }
};
