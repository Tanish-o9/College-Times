# Community Chat Notification Preferences Specification

**Project**: College Times / AKGEC Times  
**Phase**: Phase 16 — Community Chat Notification Intelligence & User Experience  
**Target Concurrency**: 10,000+ Concurrent Community Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. OBJECTIVE

The Notification Intelligence system provides user-scoped control over channel notifications (mutes, temporary mute durations, mentions, replies, reactions) while maintaining strict 10,000-user scale limits (0 broadcast notification writes for normal messages in public channels).

> **[!IMPORTANT]**
> **Mute vs Read State Distinction**:  
> Muting notifications suppresses popup alerts and notification document delivery. Muting **does NOT mark messages as read** and does **NOT** alter Phase 11 unread counts or `users/{uid}/channelReadState/{channelId}`.

---

## 2. PREFERENCE DATA MODEL

```ts
export interface ChatNotificationPreferences {
  channelId: string;
  muted: boolean;
  muteUntil?: Timestamp | FieldValue | any;
  notifyMessages: boolean;
  notifyMentions: boolean;
  notifyReplies: boolean;
  notifyReactions: boolean;
  updatedAt?: Timestamp | FieldValue | any;
}
```

### Global Defaults
- `notifyMessages = true`
- `notifyMentions = true`
- `notifyReplies = true`
- `notifyReactions = false`
- `muted = false`

---

## 3. FIRESTORE SECURITY RULES

```rules
// Chat Notification Preferences Sub-collection: 1 per user per channel
match /users/{userId}/chatNotificationPreferences/{channelId} {
  allow read: if isOwner(userId);
  allow create, update: if isOwner(userId)
    && request.resource.data.keys().hasAll(['channelId', 'muted', 'notifyMessages', 'notifyMentions', 'notifyReplies', 'notifyReactions'])
    && request.resource.data.channelId is string
    && request.resource.data.muted is bool
    && request.resource.data.notifyMessages is bool
    && request.resource.data.notifyMentions is bool
    && request.resource.data.notifyReplies is bool
    && request.resource.data.notifyReactions is bool;
  allow delete: if isOwner(userId);
}
```

---

## 4. SERVER-SIDE DELIVERY & CLOUD FUNCTION AUDIT

- **`onMessageCreateHandler` (`functions/src/index.ts`)**:
  - Resolves recipient notification preferences (`shouldDeliverNotification()`).
  - Evaluates active mute duration (`muteUntil`).
  - Supports `@mentions` (capped at 20 per message) and direct `replies`.
  - Deterministic IDs (`mention_${messageId}_${recipientId}`, `reply_${messageId}_${recipientId}`) guarantee idempotency.
  - Zero broadcast writes for general channel messages.

---

## 5. UI COMPONENTS & DEEP LINKING

- **`ChatNotificationSettings.tsx`**: Route `/chat/settings?channelId=:id` providing channel dropdown, mute toggles (1h, 8h, 24h, permanent), and mention/reply/reaction switches.
- **`ChannelList.tsx`**: Displays `🔕` (`BellOff`) icon for muted channels alongside unread badge.
- **`NotificationCard.tsx`**: Renders `@` mention icon, `↩` reply icon, and `❤️` reaction icon with deep links (`/chat/:channelId?msgId=:messageId`).
- **`ChatRoom.tsx`**: Adds quick access `Alerts` button (`Bell`) in header.
