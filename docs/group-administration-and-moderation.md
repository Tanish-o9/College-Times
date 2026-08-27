# Phase 38 — Campus Group Administration, Roles, Member Management & Moderation

## Overview
Phase 38 upgrades Campus Groups into a complete, production-grade community management system featuring a canonical role hierarchy (`owner`, `admin`, `moderator`, `member`), transactional member management service (`groupMemberManagementService.ts`), temporary and permanent ban system with rejoin protection, member muting (`mutedUntil`), join request queue (`groups/{groupId}/joinRequests/{uid}`), official announcement management with FCM topic broadcasts, centralized moderation hub (`/groups/{groupId}/moderation`), group deactivation lifecycle, security rule hardening, and 10,000 member scale verification with 0 fan-out notifications.

---

## 1. Role Hierarchy & Permission Matrix

- **`OWNER`**: Full group administration, manage admins/moderators/members, edit settings, manage invite pass, moderate content, create announcements, transfer ownership, deactivate group.
- **`ADMIN`**: Manage moderators/members, approve/reject join requests, moderate content, edit settings, manage invite pass, create announcements.
- **`MODERATOR`**: Moderate posts, Moments, comments, chat messages, review moderation hub, ban/mute members if authorized. Cannot modify roles or transfer ownership.
- **`MEMBER`**: Group participation (feed, chat, polls, events, moments, reactions, report content, leave group).

---

## 2. Member Management & Bounded Pagination

- **Service**: `src/services/groupMemberManagementService.ts`
- **Pagination**: All member queries are cursor-paginated (bounded size 1 to 50, default 20).
- **Functions**: `getGroupMembersPage()`, `searchGroupMembers()`, `updateMemberRole()`, `removeGroupMember()`, `banGroupMember()`, `unbanGroupMember()`, `muteGroupMember()`, `unmuteGroupMember()`.

---

## 3. Join Request Pipeline for Private Groups

- **Path**: `groups/{groupId}/joinRequests/{uid}`
- **Status**: `'pending' | 'approved' | 'rejected'`
- **Transaction Safety**: Approval atomically creates membership in `groups/{groupId}/members/{uid}` and user lookup index `users/{uid}/groupMemberships/{groupId}` while incrementing `memberCount`.

---

## 4. Centralized Moderation Hub & Audit Logging

- **Route**: `/groups/{groupId}/moderation`
- **Tabs**: `Reported Posts`, `Reported Moments`, `Reported Comments`, `Reported Messages`, `Banned Members`, `Join Requests`, `Moderation History`.
- **Append-Only Audit Logs**: `groups/{groupId}/auditLogs/{logId}` tracking administrative actions (banning, role changes, announcements, group deactivation).

---

## 5. Group Lifecycle & Deactivation

- **Status**: `active` | `deactivated`
- **Read-Only Mode**: Deactivated groups block creation of new posts, chat messages, moments, or polls while preserving historical content visibility for members.

---

## 6. 10,000 Member Scalability & FCM Push Broadcast

- **0 Fan-Out Writes**: Creating a group post, chat message, moment, or announcement creates **0 per-user notification writes**.
- **FCM Topic Push**: Publishes 1 push notification to topic `group_{groupId}` via Cloud Function for important announcements.
