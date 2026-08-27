# Phase 35 — Advanced Campus Group Management, Roles, Member Controls, Moderation & Community Safety

## Overview
Phase 35 makes Campus Groups production-grade by introducing role hierarchy (`owner`, `admin`, `moderator`, `member`), join request approvals for private groups, official announcements, member bans and removals, atomic ownership transfer, group archiving, unified moderation dashboard, audit logs, and security rule hardening.

---

## 1. Role Hierarchy & Permissions

- **`OWNER`**: Full group management, transfer ownership, archive group, manage admins/mods, edit settings, manage invite pass, moderate content.
- **`ADMIN`**: Manage members, approve/reject join requests, moderate content, edit general settings, create announcements, manage invite pass.
- **`MODERATOR`**: Moderate feed posts, chat messages, Instants, announcements, review member reports, hide/remove inappropriate content.
- **`MEMBER`**: Normal group participation (feed, chat, polls, events, Instants, reporting content).

---

## 2. Join Request System (Private Groups)

- **Path**: `groups/{groupId}/joinRequests/{uid}`
- **Status Flow**: `pending` -> `approved` or `rejected`.
- **Atomic Approval**: Creates `groups/{groupId}/members/{uid}` (`role: 'member'`), creates `users/{uid}/groupMemberships/{groupId}`, increments `memberCount: +1`, and updates request status to `approved`.

---

## 3. Ban & Member Removal Controls

- **`removeMemberFromGroup()`**: Atomically deletes `groups/{groupId}/members/{uid}` and `users/{uid}/groupMemberships/{uid}`, decrements `memberCount: -1`.
- **`banMemberFromGroup()`**: Updates `groups/{groupId}/members/{uid}` status to `'banned'`. Prevents rejoining via invite pass codes or join requests.

---

## 4. Official Group Announcements

- **Path**: `groups/{groupId}/announcements/{announcementId}`
- Fields: `title`, `content`, `createdBy`, `creatorName`, `createdAt`, `pinned`, `status`.
- Supports pinning important announcements at the top of group detail pages.

---

## 5. Audit Logging & Moderation Dashboard

- **Audit Log Path**: `groups/{groupId}/auditLogs/{logId}`
  - Logs administrative actions (`member_joined`, `member_removed`, `member_banned`, `role_changed`, `announcement_created`, `ownership_transferred`, `group_archived`).
- **Member Reports Path**: `groups/{groupId}/memberReports/{reportId}`
  - Logs member reports (`spam`, `harassment`, `inappropriate`, `impersonation`, `abuse`).

---

## 6. Scalability & 10,000 Member Rules

- **Bounded Member Queries**: Member roster and join request lists limited to **50 items per page**.
- **O(1) User Membership Index**: `users/{uid}/groupMemberships/{groupId}` continues to provide O(1) membership lookups.
- **Zero Broadcast Notification Fan-Out**: Normal administrative actions produce zero broadcast notification writes.
