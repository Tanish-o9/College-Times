# Phase 41 — Advanced Group Notifications, Activity Alerts & Smart Notification Controls

## Overview
Phase 41 upgrades group notifications into a production-grade, scalable notification system supporting granular group notification preferences (`users/{uid}/groupNotificationPreferences/{groupId}`), multi-tier priorities (`critical`, `high`, `normal`, `low`), Category filters (`all`, `unread`, `mentions`, `group_chat`, `moments`, `polls`, `events`, `announcements`, `moderation`, `membership`), notification deduplication, smart client-side grouping, validated deep links, per-group mute controls, FCM topic broadcasts for O(1) group-wide alerts, and 10,000 member scale verification with zero notification fan-out.

---

## 1. Group Notification Preferences & Mute Controls

- **Path**: `users/{uid}/groupNotificationPreferences/{groupId}`
- **Granular Toggles**: `allNotifications`, `mentions`, `replies`, `chatMessages`, `newMoments`, `momentComments`, `polls`, `pollResults`, `events`, `eventReminders`, `announcements`, `joinRequests`, `membershipChanges`, `moderationActions`, `pinnedContent`, `groupActivity`, `pushEnabled`.
- **Mute Controls**: `mutedUntil` timestamp allowing users to mute group notifications for 1 hour, 8 hours, 1 day, or permanently until manually unmuted.

---

## 2. Notification Priority Hierarchy

- **`CRITICAL`**: Group bans, security alerts, mandatory campus emergencies. Bypass silent mute to ensure student safety.
- **`HIGH`**: Direct @mentions, targeted replies, join request approvals, event cancellations.
- **`NORMAL`**: Poll updates, Moment interactions, group activity events.
- **`LOW`**: General engagement digests.

---

## 3. Scalable Group-Wide Broadcast Strategy

- **Zero 10K Fan-out**: Group-wide announcements, `@everyone` / `@here`, moments, polls, and events produce **0 per-user notification writes** in Firestore.
- **FCM Topic Push**: Publishes 1 push message to FCM topic `group_{groupId}` via Cloud Functions.

---

## 4. Targeted Notifications & Deduplication

- **Deterministic Notification IDs**: `{recipientId}_{type}_{targetId}_{actorId}` used for deduplication, ensuring network retries or component re-renders do not generate duplicate notifications.
- **Targeted Recipient Limit**: Maximum 1 targeted notification per recipient for direct interactions (e.g. `@username` mention).

---

## 5. Notification Center & Deep Link Mapping

- **Categories**: `all`, `unread`, `mentions`, `group_chat`, `moments`, `polls`, `events`, `announcements`, `moderation`, `membership`.
- **Deep Links**: Direct navigation to `/groups/{groupId}`, `/chat?channel=group-{groupId}`, `/groups/{groupId}?moment={instantId}`, `/groups/{groupId}?tab=polls&poll={pollId}`, `/events/{eventId}`, `/groups/{groupId}/moderation`.
