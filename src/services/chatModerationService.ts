import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  runTransaction, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ChatMessage } from '../types/chat';

export interface ChatReportPayload {
  channelId: string;
  messageId: string;
  reporterId: string;
  reason: 'Spam' | 'Abuse' | 'Harassment' | 'Misinformation' | 'Other';
}

export interface ReportedChatMessageItem {
  message: ChatMessage;
  reports: Array<{ reporterId: string; reason: string; createdAt: any }>;
}

/**
 * Transactional message reporting (1 report per user per message).
 * Atomically increments reportCount and sets message status: 'hidden' if reportCount >= 3.
 */
export const reportChatMessage = async ({
  channelId,
  messageId,
  reporterId,
  reason,
}: ChatReportPayload): Promise<void> => {
  if (!channelId || !messageId || !reporterId) return;

  const reportDocRef = doc(db, 'channels', channelId, 'messages', messageId, 'reports', reporterId);
  const messageRef = doc(db, 'channels', channelId, 'messages', messageId);

  await runTransaction(db, async (transaction) => {
    const reportSnap = await transaction.get(reportDocRef);
    if (reportSnap.exists()) {
      throw new Error('You have already reported this message.');
    }

    const messageSnap = await transaction.get(messageRef);
    if (!messageSnap.exists()) {
      throw new Error('Target message no longer exists.');
    }

    const messageData = messageSnap.data();
    const currentReportCount = messageData.reportCount || 0;
    const newReportCount = currentReportCount + 1;
    const isAutoHidden = newReportCount >= 3;

    // 1. Create report sub-document
    transaction.set(reportDocRef, {
      reporterId,
      reason,
      createdAt: serverTimestamp(),
    });

    // 2. Update parent message report count & auto-hide status
    transaction.update(messageRef, {
      reportCount: newReportCount,
      ...(isAutoHidden ? { status: 'hidden' } : {}),
    });

    // 3. Index report entry in top-level chatReports for efficient admin queries
    const adminIndexRef = doc(db, 'chatReports', `${messageId}_${reporterId}`);
    transaction.set(adminIndexRef, {
      channelId,
      messageId,
      reporterId,
      reason,
      createdAt: serverTimestamp(),
    });
  });
};

/**
 * Checks if a user is muted in a specific channel.
 */
export const checkUserMutedStatus = async (channelId: string, userId: string): Promise<boolean> => {
  if (!channelId || !userId) return false;
  try {
    const memberRef = doc(db, 'channels', channelId, 'members', userId);
    const snap = await getDoc(memberRef);
    return snap.exists() && snap.data()?.muted === true;
  } catch {
    return false;
  }
};

/**
 * Mutes a user in a specific channel.
 */
export const muteChannelUser = async (
  channelId: string, 
  targetUid: string, 
  adminUid: string
): Promise<void> => {
  const memberRef = doc(db, 'channels', channelId, 'members', targetUid);
  await setDoc(
    memberRef,
    {
      channelId,
      userId: targetUid,
      muted: true,
      mutedAt: serverTimestamp(),
      mutedBy: adminUid,
    },
    { merge: true }
  );
};

/**
 * Unmutes a user in a specific channel.
 */
export const unmuteChannelUser = async (channelId: string, targetUid: string): Promise<void> => {
  const memberRef = doc(db, 'channels', channelId, 'members', targetUid);
  await updateDoc(memberRef, {
    muted: false,
  });
};

/**
 * Soft deletes a chat message (Moderator Action).
 */
export const softDeleteChatMessage = async (channelId: string, messageId: string): Promise<void> => {
  const messageRef = doc(db, 'channels', channelId, 'messages', messageId);
  await updateDoc(messageRef, {
    status: 'deleted',
    content: 'Message deleted by moderator',
    updatedAt: serverTimestamp(),
  });
};

/**
 * Dismisses all reports on a chat message.
 */
export const dismissChatMessageReports = async (channelId: string, messageId: string): Promise<void> => {
  const messageRef = doc(db, 'channels', channelId, 'messages', messageId);
  await updateDoc(messageRef, {
    reportCount: 0,
    status: 'active',
  });
};

/**
 * Fetches reported chat messages for Admin Moderation Tab.
 */
export const getReportedChatMessages = async (): Promise<ReportedChatMessageItem[]> => {
  try {
    const reportsRef = collection(db, 'chatReports');
    const reportsSnap = await getDocs(reportsRef);

    const itemsMap = new Map<string, ReportedChatMessageItem>();

    for (const docSnap of reportsSnap.docs) {
      const data = docSnap.data();
      const { channelId, messageId, reporterId, reason, createdAt } = data;

      if (!channelId || !messageId) continue;

      const key = `${channelId}_${messageId}`;
      if (!itemsMap.has(key)) {
        const msgRef = doc(db, 'channels', channelId, 'messages', messageId);
        const msgSnap = await getDoc(msgRef);

        if (msgSnap.exists()) {
          itemsMap.set(key, {
            message: { id: msgSnap.id, ...msgSnap.data() } as ChatMessage,
            reports: [],
          });
        }
      }

      const item = itemsMap.get(key);
      if (item) {
        item.reports.push({ reporterId, reason, createdAt });
      }
    }

    return Array.from(itemsMap.values());
  } catch (error) {
    console.error('Error fetching reported chat messages:', error);
    return [];
  }
};
