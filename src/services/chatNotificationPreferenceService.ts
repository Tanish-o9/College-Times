import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { ChatNotificationPreferences } from '../types/chat';
import { DEFAULT_CHAT_NOTIFICATION_PREFERENCES } from '../types/chat';

/**
 * Fetches notification preferences for a specific channel.
 * Returns default preferences if no preference document exists yet.
 */
export const getChannelNotificationPreferences = async (
  uid: string,
  channelId: string
): Promise<ChatNotificationPreferences> => {
  if (!uid || !channelId) {
    return {
      channelId,
      ...DEFAULT_CHAT_NOTIFICATION_PREFERENCES,
    };
  }

  try {
    const prefRef = doc(db, 'users', uid, 'chatNotificationPreferences', channelId);
    const snap = await getDoc(prefRef);

    if (!snap.exists()) {
      return {
        channelId,
        ...DEFAULT_CHAT_NOTIFICATION_PREFERENCES,
      };
    }

    const data = snap.data() as ChatNotificationPreferences;

    // Check if temporary mute has expired
    if (data.muted && data.muteUntil) {
      const muteUntilMs = data.muteUntil.toMillis ? data.muteUntil.toMillis() : 0;
      if (muteUntilMs > 0 && Date.now() > muteUntilMs) {
        return {
          ...data,
          muted: false,
          muteUntil: undefined,
        };
      }
    }

    return {
      channelId,
      muted: data.muted ?? false,
      notifyMessages: data.notifyMessages ?? true,
      notifyMentions: data.notifyMentions ?? true,
      notifyReplies: data.notifyReplies ?? true,
      notifyReactions: data.notifyReactions ?? false,
      muteUntil: data.muteUntil,
    };
  } catch (err) {
    return {
      channelId,
      ...DEFAULT_CHAT_NOTIFICATION_PREFERENCES,
    };
  }
};

/**
 * Updates channel notification preferences for the authenticated owner.
 */
export const setChannelNotificationPreferences = async (
  uid: string,
  channelId: string,
  prefs: Partial<ChatNotificationPreferences>
): Promise<void> => {
  if (!uid || !channelId) return;

  try {
    const prefRef = doc(db, 'users', uid, 'chatNotificationPreferences', channelId);
    const current = await getChannelNotificationPreferences(uid, channelId);

    const updated: ChatNotificationPreferences = {
      ...current,
      ...prefs,
      channelId,
      updatedAt: serverTimestamp(),
    };

    await setDoc(prefRef, updated, { merge: true });

    logAnalyticsEvent('chat_notification_preference_changed', {
      channelId,
      setting: Object.keys(prefs).join(','),
    });
  } catch (err: any) {
    console.error('Error saving notification preferences:', err);
    throw new Error(err.message || 'Failed to update notification preferences.');
  }
};

/**
 * Temporarily or permanently mutes notifications for a channel.
 * Does NOT alter Phase 11 channelReadState or unread message badges.
 */
export const toggleChannelMute = async (
  uid: string,
  channelId: string,
  durationHours?: number
): Promise<void> => {
  if (!uid || !channelId) return;

  const now = Date.now();
  const muteUntil = durationHours
    ? Timestamp.fromMillis(now + durationHours * 3600 * 1000)
    : null;

  try {
    await setChannelNotificationPreferences(uid, channelId, {
      muted: true,
      ...(muteUntil ? { muteUntil } : {}),
    });

    logAnalyticsEvent('chat_channel_muted', {
      channelId,
      duration: durationHours ? `${durationHours}h` : 'permanent',
    });
  } catch (err: any) {
    console.error('Error muting channel:', err);
    throw new Error(err.message || 'Failed to mute channel notifications.');
  }
};

/**
 * Unmutes notifications for a channel.
 */
export const unmuteChannel = async (uid: string, channelId: string): Promise<void> => {
  if (!uid || !channelId) return;

  try {
    const prefRef = doc(db, 'users', uid, 'chatNotificationPreferences', channelId);
    await setDoc(
      prefRef,
      {
        channelId,
        muted: false,
        muteUntil: null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    logAnalyticsEvent('chat_channel_unmuted', { channelId });
  } catch (err: any) {
    console.error('Error unmuting channel:', err);
    throw new Error(err.message || 'Failed to unmute channel notifications.');
  }
};

/**
 * Fetches all custom notification preferences for the user (bounded query, max 100).
 */
export const getUserNotificationPreferencesMap = async (
  uid: string
): Promise<Map<string, ChatNotificationPreferences>> => {
  const map = new Map<string, ChatNotificationPreferences>();
  if (!uid) return map;

  try {
    const colRef = collection(db, 'users', uid, 'chatNotificationPreferences');
    const snap = await getDocs(query(colRef, limit(100)));
    const now = Date.now();

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data() as ChatNotificationPreferences;
      const muteUntilMs = data.muteUntil?.toMillis ? data.muteUntil.toMillis() : 0;
      const isMuteActive = data.muted && (!muteUntilMs || now < muteUntilMs);

      map.set(docSnap.id, {
        ...data,
        channelId: docSnap.id,
        muted: isMuteActive,
      });
    });

    return map;
  } catch (err) {
    return map;
  }
};

/**
 * Returns a set of channel IDs that are currently muted by the user.
 */
export const getMutedChannels = async (uid: string): Promise<Set<string>> => {
  const map = await getUserNotificationPreferencesMap(uid);
  const mutedSet = new Set<string>();

  map.forEach((pref, channelId) => {
    if (pref.muted) {
      mutedSet.add(channelId);
    }
  });

  return mutedSet;
};
