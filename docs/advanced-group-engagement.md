# Phase 39 — Advanced Group Engagement, Real-Time Activity & Community Experience

## Overview
Phase 39 upgrades Campus Groups into a highly interactive real-time community experience with advanced mentions (`@username`, `@everyone`, `@here`) and permission controls, unified Group Activity Timeline (`groups/{groupId}/activity/{activityId}`), Group Activity Unread State (`users/{uid}/groupActivityState/{groupId}`), Group Pinned Content (`groups/{groupId}/pinnedItems/{pinId}`), Group Notification Preferences, Chat ↔ Moments/Polls/Events references, Group Engagement Insights (`/groups/{groupId}/insights`), Saved Group Content (`users/{uid}/savedGroupContent/{saveId}`), security rule hardening, and 10,000 member scale verification with 0 fan-out notifications.

---

## 1. Advanced Mentions & FCM Broadcast Strategy

- **`@username`**: Creates max 20 targeted notifications for explicitly mentioned members. Never notifies the sender.
- **`@everyone` / `@here`**:
  - Permissions: Owner and Admin only by default (configurable in group settings: `allowMemberEveryoneMention`, `allowMemberHereMention`).
  - Rate Limiting: Maximum 3 `@everyone` broadcasts per 10 minutes per user.
  - Zero 10K Fan-out: Publishes **1 FCM push notification to topic `group_{groupId}`** via Cloud Function. Creates 0 per-user notification documents in Firestore.

---

## 2. Activity Timeline & Ephemeral vs Persistent Split

- **Persistent Events**: `groups/{groupId}/activity/{activityId}` storing `type` (`announcement`, `event`, `poll`, `moment`, `post`, `membership_change`, `moderation`), `actorId`, `actorName`, `actorAvatar`, `targetId`, `targetType`, `preview`, `createdAt`.
- **Ephemeral Events**: Likes, reactions, typing, presence (handled in memory/ephemeral state without polluting Firestore activity collection).
- **Cursor Pagination**: Bounded query limits (1 to 50, default 20 items per page).

---

## 3. Pinned Group Content

- **Path**: `groups/{groupId}/pinnedItems/{pinId}`
- **Target Types**: `post`, `moment`, `poll`, `announcement`, `event`.
- **Bounded Limit**: Enforces a strict maximum limit of **20 active pins per group**.

---

## 4. Structured Chat References (Moments, Polls, Events)

- **Chat Message Types**: `moment_reference`, `poll_reference`, `event_reference`.
- **Zero Binary Duplication**: Embeds structured metadata references resolving original items with deep links (`Open Moment`, `Open Poll`, `View Event`). Displays fallback message if target item is deleted.

---

## 5. Group Engagement Insights

- **Route**: `/groups/{groupId}/insights`
- **Access**: Group Owners and Admins only.
- **Metrics**: Aggregate counts for member roster, moments, announcements, pins, and moderation events using bounded candidate queries.
