# Phase 37 — Advanced Campus Group Management, Roles, Moderation, Announcements & Community Controls

## Overview
Phase 37 upgrades Campus Groups into a production-grade community management system with role permissions (`owner`, `admin`, `moderator`, `member`), group banned roster enforcement (`groups/{groupId}/bannedMembers/{uid}`), official announcements with priority levels and FCM topic broadcasts, unified moderation queue (`Posts`, `Comments`, `Polls`, `Moments`, `Messages`, `Members`), group notification mute preferences, Group Activity Overview dashboard, and security rule hardening.

---

## 1. Role Hierarchy & Permission Boundaries

- **`OWNER`**: Full group administration, transfer ownership, archive group, manage admins/mods, edit settings, manage invite pass, moderate content, create announcements.
- **`ADMIN`**: Manage members, approve/reject join requests, moderate content, edit settings, create announcements, manage invite pass.
- **`MODERATOR`**: Remove/hide reported content, review moderation queue (`Posts`, `Comments`, `Polls`, `Moments`, `Messages`, `Members`), mute/ban members if authorized. Cannot transfer ownership or delete group.
- **`MEMBER`**: Group participation (feed, chat, polls, events, moments, reactions, reporting content, leave group).

---

## 2. Transactional Ownership Transfer & Security

- **Service**: `src/services/groupRoleService.ts` -> `transferOwnership()`
- **Rules**: Only the current group owner (`role === 'owner'`) can transfer ownership. Target user must be an active group member. Operates within an atomic Firestore transaction. Old owner becomes admin. Prevents self-escalation and moderator-to-owner hijacking.

---

## 3. Banned Roster & Rejoin Control

- **Banned Path**: `groups/{groupId}/bannedMembers/{uid}`
- **Security Check**: Enforced in `joinGroup()` (public join) and `joinGroupWithPassCode()` (CT-XXXXXX invite pass join). Banned users are rejected immediately even if they hold a valid pass code or join link.

---

## 4. Official Group Announcements & FCM Topic Broadcast

- **Path**: `groups/{groupId}/announcements/{announcementId}`
- **Priority**: `'normal' | 'important' | 'urgent'`
- **Zero Fan-Out Writes**: Creating an announcement creates 0 notification documents.
- **FCM Push Broadcast**: Publishes 1 push notification to topic `group_{groupId}` via Cloud Function.

---

## 5. Group Notification Mute Preferences

- **Path**: `users/{uid}/groupNotificationPreferences/{groupId}`
- **Fields**: `muted`, `announcements`, `moments`, `chat`, `updatedAt`.
- Allows students to mute group push notifications without losing group access or manual feed visibility.

---

## 6. Bounded Pagination & 10,000 Scale

- Member roster, join requests, announcements, and moderation queue items are limited to **20–50 items per page**.
- O(1) membership lookups continue via `users/{uid}/groupMemberships/{groupId}`.
