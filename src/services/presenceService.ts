import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { rtdb } from '../lib/firebase';

export interface PresenceState {
  state: 'online' | 'offline';
  lastChanged: number | object;
}

// In-Memory Presence Cache
const presenceCacheMap = new Map<string, boolean>();

/**
 * Centralized User Presence Manager (Firebase Realtime Database)
 * 1. Monitors .info/connected
 * 2. Registers onDisconnect hook for automatic offline status when tab closes or network drops
 * 3. Sets state: 'online' when connected
 */
export const initUserPresence = (uid: string): (() => void) => {
  if (!uid) return () => {};

  const connectedRef = ref(rtdb, '.info/connected');
  const userPresenceRef = ref(rtdb, `presence/${uid}`);

  const unsubscribeConnected = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      // Register automatic server-side disconnect handler
      onDisconnect(userPresenceRef)
        .set({
          state: 'offline',
          lastChanged: serverTimestamp(),
        })
        .then(() => {
          // Set current user online
          set(userPresenceRef, {
            state: 'online',
            lastChanged: serverTimestamp(),
          });
        })
        .catch(() => {
          // Fallback set
          set(userPresenceRef, {
            state: 'online',
            lastChanged: serverTimestamp(),
          });
        });
    }
  });

  return () => {
    unsubscribeConnected();
    // Attempt explicit offline set on clean logout/unmount
    set(userPresenceRef, {
      state: 'offline',
      lastChanged: serverTimestamp(),
    }).catch(() => {});
  };
};

/**
 * Bounded Member Presence Subscription
 * STRICT SCALE RULE:
 * 1. Never creates an unbounded presence listener across all 10,000 users.
 * 2. Only subscribes to the provided bounded set of UIDs (max 30).
 * 3. Serves presence state from shared in-memory cache map.
 */
export const subscribeToMemberPresence = (
  memberUids: string[],
  onUpdate: (presenceMap: Record<string, boolean>) => void
): (() => void) => {
  if (!memberUids || memberUids.length === 0) {
    onUpdate({});
    return () => {};
  }

  // Deduplicate and cap at 30 max
  const boundedUids = Array.from(new Set(memberUids)).filter(Boolean).slice(0, 30);
  const unsubs: Array<() => void> = [];

  boundedUids.forEach((uid) => {
    const userPresenceRef = ref(rtdb, `presence/${uid}`);
    const unsub = onValue(userPresenceRef, (snapshot) => {
      const data = snapshot.val() as PresenceState | null;
      const isOnline = data?.state === 'online';
      presenceCacheMap.set(uid, isOnline);

      // Construct current state map for bounded set
      const presenceMap: Record<string, boolean> = {};
      boundedUids.forEach((id) => {
        presenceMap[id] = presenceCacheMap.get(id) ?? false;
      });

      onUpdate(presenceMap);
    });

    unsubs.push(unsub);
  });

  return () => {
    unsubs.forEach((unsub) => unsub());
  };
};
