# Phase 46 — Smart Campus Notifications 2.0, Activity Center & Delivery

## Overview
Phase 46 introduces a production-grade Unified Activity Center and Smart Delivery architecture:
- **Unified Activity Center** (`NotificationsPage.tsx`): Route `/notifications` with category filtering (`All`, `Mentions`, `Social`, `Groups`, `Events`, `Messages`, `System`) and deep-link routing.
- **Deterministic Deduplication**: Deterministic document IDs (`follow_{actor}_{target}`, `post_like_{postId}_{actor}`) preventing notification spam.
- **Targeted Delivery & Zero Fan-out**: Targeted 1-recipient writes for direct interactions (likes, comments, DMs, follows). Group-wide and campus-wide notifications use FCM topic broadcasts (`campus_all`, `group_{groupId}`) with 0 Firestore document fan-out.
- **Category Mute Controls** (`notificationPreferenceService.ts`): Allows muting notification categories (`likes`, `comments`, `reactions`, `mentions`, `follows`, `messages`, `groups`, `events`, `polls`, `announcements`) while maintaining mandatory emergency alerts.

---

## 1. Notification Categories & Deep Links

| Category | Icon | Deep Link Destination |
|---|---|---|
| **Social** | Heart | `/profile/{username}` or `/?postId={postId}` |
| **Mentions** | Sparkles | `/?postId={postId}` or `/groups/{groupId}` |
| **Groups** | Users | `/groups/{groupId}` |
| **Events** | Calendar | `/events/{eventId}` |
| **Messages** | MessageSquare | `/direct/{senderUid}` or `/chat/{channelId}` |
| **System** | ShieldAlert | `/alerts` or `/admin/system-health` |

---

## 2. Scalable FCM Broadcast Strategy

- **Emergency Alerts**: FCM topic `campus_all` (0 Firestore fan-out).
- **Group Announcements**: FCM topic `group_{groupId}` (0 Firestore fan-out).
- **Direct Interactions**: 1 recipient Firestore write to `users/{recipientId}/notifications/{notifId}`.
