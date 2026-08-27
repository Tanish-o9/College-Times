const MAX_MENTIONS_PER_MESSAGE = 20;
const POINT_COOLDOWN_MS = 60 * 1000;
const CHAT_BLOCKED_TERMS = ['spam', 'scam', 'abuse', 'hate', 'nsfw', 'vulgar', 'offensive', 'harass'];

const isBlockedContent = (text?: string): boolean => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CHAT_BLOCKED_TERMS.some((term) => lower.includes(term));
};

export interface FirestoreMessageData {
  senderId?: string;
  senderName?: string;
  content?: string;
  status?: string;
  mentionedUids?: string[];
  replyToMessageId?: string;
  createdAt?: any;
}

/**
 * Checks recipient channel notification preferences in Firestore.
 */
const shouldDeliverNotification = async (
  db: any,
  recipientId: string,
  channelId: string,
  type: 'mention' | 'reply' | 'reaction'
): Promise<boolean> => {
  try {
    const prefRef = db
      .collection('users')
      .doc(recipientId)
      .collection('chatNotificationPreferences')
      .doc(channelId);
    const snap = await prefRef.get();

    if (!snap.exists) {
      // Default policy: Mentions & Replies ON, Reactions OFF
      if (type === 'reaction') return false;
      return true;
    }

    const data = snap.data();
    const now = Date.now();

    // Mute Check
    if (data.muted) {
      if (!data.muteUntil) return false; // Muted until manually unmuted
      const muteUntilMs = data.muteUntil.toMillis ? data.muteUntil.toMillis() : 0;
      if (muteUntilMs > 0 && now < muteUntilMs) return false; // Mute still active
    }

    if (type === 'mention') return data.notifyMentions !== false;
    if (type === 'reply') return data.notifyReplies !== false;
    if (type === 'reaction') return data.notifyReactions === true;

    return true;
  } catch (err) {
    return true; // Fallback to delivery on error
  }
};

/**
 * Cloud Function triggered on new message creation in channels/{channelId}/messages/{messageId}.
 * 1. Validates status and denylist — rejects blocked or deleted/hidden messages.
 * 2. Delivers server-side @mention and reply notifications after checking recipient preferences.
 * 3. Idempotent: Uses deterministic doc IDs (mention_{messageId}_{recipientId}, reply_{messageId}_{recipientId}).
 * 4. Enforces server-side 60s cooldown for +1 chat participation point.
 * 5. Broadcast channels (#general, #admin-announcements) NEVER fan out to all members.
 */
export const onMessageCreateHandler = async (
  db: any,
  admin: any,
  channelId: string,
  messageId: string,
  messageData: FirestoreMessageData
) => {
  if (!messageData) return null;

  const { senderId, senderName, content, status, mentionedUids = [], replyToMessageId } = messageData;

  // Re-validate moderation status & blocked content server-side
  if (status === 'deleted' || status === 'hidden' || isBlockedContent(content)) {
    console.log(`Skipping notifications & points for moderated message ${messageId}.`);
    return null;
  }

  try {
    // Step 1: Resolve Channel Metadata for Notification Title
    const channelRef = db.collection('channels').doc(channelId);
    const channelSnap = await channelRef.get();
    const channelName = channelSnap.exists ? channelSnap.data()?.name || channelId : channelId;

    const batch = db.batch();
    let notificationCount = 0;

    // Step 2: Handle Reply Notifications
    if (replyToMessageId) {
      try {
        const origRef = db.collection('channels').doc(channelId).collection('messages').doc(replyToMessageId);
        const origSnap = await origRef.get();

        if (origSnap.exists) {
          const origData = origSnap.data();
          const targetRecipientId = origData?.senderId;

          if (targetRecipientId && targetRecipientId !== senderId) {
            const canDeliver = await shouldDeliverNotification(db, targetRecipientId, channelId, 'reply');
            if (canDeliver) {
              const replyNotifRef = db.collection('notifications').doc(`reply_${messageId}_${targetRecipientId}`);
              batch.set(
                replyNotifRef,
                {
                  recipientId: targetRecipientId,
                  message: `${senderName || 'Student'} replied to your message in #${channelName}`,
                  type: 'reply',
                  channelId,
                  messageId,
                  actorName: senderName || 'Student',
                  read: false,
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
              notificationCount++;
            }
          }
        }
      } catch (err) {
        console.error(`Error resolving reply target ${replyToMessageId}:`, err);
      }
    }

    // Step 3: Filter & Deduplicate Mentioned UIDs (Capped at MAX_MENTIONS_PER_MESSAGE = 20)
    if (Array.isArray(mentionedUids) && mentionedUids.length > 0) {
      const uniqueRecipients = Array.from(new Set(mentionedUids))
        .filter((uid): uid is string => !!uid && typeof uid === 'string' && uid !== senderId)
        .slice(0, MAX_MENTIONS_PER_MESSAGE);

      for (const recipientId of uniqueRecipients) {
        const canDeliver = await shouldDeliverNotification(db, recipientId, channelId, 'mention');
        if (canDeliver) {
          const notifRef = db.collection('notifications').doc(`mention_${messageId}_${recipientId}`);
          batch.set(
            notifRef,
            {
              recipientId,
              message: `${senderName || 'Student'} mentioned you in #${channelName}`,
              type: 'mention',
              channelId,
              messageId,
              actorName: senderName || 'Student',
              read: false,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          notificationCount++;
        }
      }
    }

    if (notificationCount > 0) {
      await batch.commit();
      console.log(`Delivered ${notificationCount} targeted notifications for message ${messageId} in #${channelName}.`);
    }

    // Step 4: Server-Side Gamification & Spam Cooldown (+1 Point)
    if (senderId) {
      const userRef = db.collection('users').doc(senderId);
      await db.runTransaction(async (transaction: any) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) return;

        const userData = userSnap.data();
        const lastPointTime = userData?.lastPointedMessageAt
          ? userData.lastPointedMessageAt.toMillis()
          : 0;

        const now = Date.now();
        if (now - lastPointTime >= POINT_COOLDOWN_MS) {
          transaction.update(userRef, {
            points: admin.firestore.FieldValue.increment(1),
            lastPointedMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`Awarded +1 chat participation point to user ${senderId}.`);
        }
      });
    }

    return true;
  } catch (error) {
    console.error(`Error in onMessageCreate for message ${messageId}:`, error);
    return null;
  }
};

export interface FirestorePostData {
  title?: string;
  content?: string;
  authorId?: string;
  authorName?: string;
  priority?: 'normal' | 'important' | 'emergency';
  notifyAudience?: boolean;
  audience?: {
    type: 'campus' | 'department' | 'batch' | 'community' | 'channel';
    departmentId?: string;
    batchId?: string;
    audienceId?: string;
    channelId?: string;
  };
  status?: string;
}

/**
 * Cloud Function triggered on new post creation in posts/{postId}.
 * 1. Checks notifyAudience flag and moderation status.
 * 2. Idempotency: Reads notificationsDelivery/{postId} to prevent duplicate FCM publishes on retries.
 * 3. Resolves 1 target FCM topic (campus_all, department_*, batch_*, group_*, channel_*).
 * 4. Dispatches single FCM topic notification to up to 10,000 members (0 bulk Firestore writes).
 */
export const onPostCreateHandler = async (
  db: any,
  admin: any,
  postId: string,
  postData: FirestorePostData
) => {
  if (!postData) return null;

  const { title, content, status, priority = 'normal', notifyAudience = false, audience = { type: 'campus' } } = postData;

  // Moderation check
  if (!notifyAudience || status === 'deleted' || status === 'hidden' || isBlockedContent(title) || isBlockedContent(content)) {
    console.log(`Skipping FCM alert for post ${postId}.`);
    return null;
  }

  // Idempotency Check in notificationsDelivery/{postId}
  const deliveryRef = db.collection('notificationsDelivery').doc(postId);
  const deliverySnap = await deliveryRef.get();

  if (deliverySnap.exists && deliverySnap.data()?.status === 'sent') {
    console.log(`FCM alert for post ${postId} was already sent. Skipping retry.`);
    return null;
  }

  // Target Topic Resolution
  let topic = 'campus_all';
  if (audience.type === 'department' && audience.departmentId) {
    topic = `department_${audience.departmentId.toLowerCase()}`;
  } else if (audience.type === 'batch' && audience.batchId) {
    topic = `batch_${audience.batchId.replace('batch-', '')}`;
  } else if (audience.type === 'community' && audience.audienceId) {
    topic = `group_${audience.audienceId}`;
  } else if (audience.type === 'channel' && audience.channelId) {
    topic = `channel_${audience.channelId}`;
  }

  try {
    // Record pending delivery doc
    await deliveryRef.set(
      {
        postId,
        topic,
        priority,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const titlePrefix =
      priority === 'emergency'
        ? '🚨 Urgent Campus Alert'
        : priority === 'important'
        ? '📢 Important Campus Update'
        : 'New Campus Post';

    const payload = {
      notification: {
        title: titlePrefix,
        body: (title || content || 'New campus update').slice(0, 120),
      },
      data: {
        postId,
        priority,
        audienceType: audience.type,
      },
    };

    // Single FCM topic dispatch across 10,000 members
    if (admin.messaging) {
      await admin.messaging().sendToTopic(topic, payload);
      console.log(`Successfully dispatched FCM topic notification to '${topic}' for post ${postId}.`);
    }

    // Mark delivery status sent
    await deliveryRef.update({
      status: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Phase 20: Create activeAlerts/{postId} index document for in-app real-time banner
    const activeAlertRef = db.collection('activeAlerts').doc(postId);
    await activeAlertRef.set(
      {
        postId,
        audienceType: audience.type,
        audienceId: audience.departmentId || audience.batchId || audience.audienceId || audience.channelId,
        priority,
        title: (title || content || 'Campus Update').slice(0, 100),
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(
          Date.now() + (priority === 'emergency' ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)
        ),
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.error(`Error delivering FCM alert for post ${postId}:`, error);
    await deliveryRef.set({ status: 'failed', error: String(error) }, { merge: true });
    return null;
  }
};
