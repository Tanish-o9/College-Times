# Phase 33 — Scalable Dedicated Group Chat

## Overview
Phase 33 implements dedicated private group chats for every campus group (`/chat?channel=group-{groupId}`). Only current active members of a campus group are granted access to read or participate in its dedicated group chat. The architecture is engineered for 10,000-member scale with **zero notification fan-out** on normal message writes, targeted notifications for @mentions and replies, and inline group quick actions.

---

## 1. Architecture & Canonical Channels

- **Canonical Channel ID**: `group-{groupId}` (e.g. `group-all-campus`, `group-cse`, `group-grp_1787823901_robotics`).
- **Channel Document (`channels/group-{groupId}`)**:
  ```json
  {
    "id": "group-grp_1787823901_robotics",
    "name": "AKGEC Robotics & Embedded Systems Chat",
    "description": "Dedicated private group chat for AKGEC Robotics & Embedded Systems.",
    "category": "group",
    "type": "group",
    "groupId": "grp_1787823901_robotics",
    "createdAt": "Timestamp",
    "createdBy": "user_uid_123",
    "memberCount": 42
  }
  ```

---

## 2. Membership Access Control

- **Group Membership Check**: `isUserGroupChatMember(groupId, uid)` validates whether `groups/{groupId}/members/{uid}` exists.
- **Strict Guarding**: Non-members attempting to open `/chat?channel=group-{groupId}` are presented with a private access guard. Historical chat, messages, attachments, and real-time listeners remain strictly blocked.

---

## 3. Zero Fan-Out Notification Strategy (10,000 Member Scale)

To support groups with up to 10,000 members without O(N) database fan-out or notification writes:

1. **Normal Group Messages**:
   - Generates **0 broadcast notification writes**.
   - Messages are written directly to `channels/group-{groupId}/messages`.
2. **@Mention Notifications**:
   - Parses `mentionedUids` array in payload.
   - Generates **1 targeted notification document** in `notifications` for each mentioned user.
3. **Message Reply Notifications**:
   - Generates **1 targeted notification document** for the author of the original message being replied to.

---

## 4. Unread State & Read Receipts

- Per-user group chat read state stored in `users/{uid}/groupChatReadState/{groupId}`:
  ```typescript
  interface GroupChatReadState {
    groupId: string;
    lastReadMessageId: string;
    lastReadAt: Timestamp;
    isMuted?: boolean;
  }
  ```

---

## 5. Group Chat Media Storage

- Path: `groupChatMedia/{groupId}/{userId}/{filename}`
- Validated for MIME types (`image/jpeg`, `image/png`, `image/webp`, `image/gif`), 10MB file limit, and sanitized filenames.
- Storage rules enforce authenticated access and uploader ownership.

---

## 6. Group Quick Actions & Navigation

- **View Group**: Direct navigation button to `/groups/{groupId}`.
- **Polls**: Direct navigation to `/groups/{groupId}?tab=polls`.
- **Mute Notifications**: One-click toggle for notification mute setting in `groupChatReadState`.
