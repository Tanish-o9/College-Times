import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ChatFeatureFlag {
  enabled: boolean;
  rolloutPercentage: number;
  updatedAt?: any;
  updatedBy?: string;
}

const DEFAULT_FLAG: ChatFeatureFlag = {
  enabled: true,
  rolloutPercentage: 100, // Default to 100 for dev; controlled via Firestore featureFlags/chat
};

// In-memory cache to prevent fetching featureFlags/chat on every render
let cachedFlag: ChatFeatureFlag | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1-minute client cache

/**
 * Stable deterministic hashing of UID into a bucket (0–99).
 * Same UID always yields the exact same bucket integer.
 */
export const getUidBucket = (uid: string): number => {
  if (!uid) return 0;
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    const char = uid.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % 100;
};

/**
 * Determines whether Chat is enabled for a given user.
 * 1. Admin users always have access (Admin Bypass for monitoring/moderation).
 * 2. If feature flag disabled or rolloutPercentage == 0 -> returns false (Kill Switch).
 * 3. Returns true if user's deterministic UID bucket < rolloutPercentage.
 */
export const isChatEnabledForUser = (
  uid: string | undefined,
  userRole: string | undefined,
  flag: ChatFeatureFlag = DEFAULT_FLAG
): boolean => {
  // Admin Bypass
  if (userRole === 'admin') return true;

  // Kill Switch
  if (!flag.enabled || flag.rolloutPercentage <= 0) return false;

  // 100% Rollout
  if (flag.rolloutPercentage >= 100) return true;

  if (!uid) return false;

  const bucket = getUidBucket(uid);
  return bucket < flag.rolloutPercentage;
};

/**
 * Fetches featureFlags/chat with in-memory caching and fail-closed fallback on network failure.
 */
export const getChatFeatureFlag = async (): Promise<ChatFeatureFlag> => {
  const now = Date.now();
  if (cachedFlag && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedFlag;
  }

  try {
    const flagRef = doc(db, 'featureFlags', 'chat');
    const snap = await getDoc(flagRef);

    if (snap.exists()) {
      const data = snap.data();
      cachedFlag = {
        enabled: data.enabled !== false,
        rolloutPercentage: typeof data.rolloutPercentage === 'number' ? data.rolloutPercentage : 100,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      };
    } else {
      cachedFlag = DEFAULT_FLAG;
    }
    lastCacheTime = now;
    return cachedFlag;
  } catch (error) {
    console.error('Error fetching chat feature flag:', error);
    // Fail-closed for student safety on network error if no cache available
    return cachedFlag || { enabled: false, rolloutPercentage: 0 };
  }
};

/**
 * Admin action to update rolloutPercentage and enabled state in Firestore.
 */
export const updateChatRolloutFlag = async (
  rolloutPercentage: number,
  enabled: boolean,
  adminUid: string
): Promise<void> => {
  if (rolloutPercentage < 0 || rolloutPercentage > 100) {
    throw new Error('Rollout percentage must be an integer between 0 and 100.');
  }

  const flagRef = doc(db, 'featureFlags', 'chat');
  const payload: ChatFeatureFlag = {
    enabled,
    rolloutPercentage: Math.floor(rolloutPercentage),
    updatedAt: serverTimestamp(),
    updatedBy: adminUid,
  };

  await setDoc(flagRef, payload, { merge: true });
  cachedFlag = { ...payload, updatedAt: Date.now() };
  lastCacheTime = Date.now();
};
