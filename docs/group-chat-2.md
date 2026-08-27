# Phase 42 — Advanced Group Chat 2.0, Real-Time Messaging, Media, Search & Chat UX

## Overview
Phase 42 upgrades the canonical group chat (`channels/group-{groupId}`) into a production-grade Group Chat 2.0 supporting optimistic message sending, 15-minute edit window, soft deletion (`status: 'deleted'`), multiple image & file attachments (`groupChatMedia/{groupId}/{userId}/{messageId}/{filename}`), debounced message search (bounded max 50 results), pinned messages (`channels/group-{groupId}/pinnedMessages/{messageId}`, max 20 limit), visual unread separator, jump-to-latest button, local draft preservation (`groupChatDraft:{groupId}`), sender quick profile modal, rich references (Moments, Polls, Events, Announcements), security rule hardening, and 10,000 member scale verification with 0 notification fan-out for normal messages.

---

## 1. Canonical Group Chat & Access Control

- **Canonical Channel Path**: `channels/group-{groupId}`
- **Messages Path**: `channels/group-{groupId}/messages/{messageId}`
- **Membership Protection**: Access is restricted strictly to active, non-banned group members in `groups/{groupId}/members/{uid}`. Deactivated groups enter read-only state blocking new messages.

---

## 2. 15-Minute Edit Window & Soft Deletion

- **Edit Window**: `editGroupMessage()` calculates elapsed minutes from `createdAt`. Edits beyond 15 minutes are strictly blocked. Sets `isEdited: true` and `editedAt`.
- **Soft Deletion**: `deleteGroupMessage()` updates `status: 'deleted'`, replacing message text with `"This message was deleted."` while suppressing original media URLs.

---

## 3. Pinned Chat Messages & Search Bounds

- **Pinned Path**: `channels/group-{groupId}/pinnedMessages/{messageId}`
- **Pin Bounds**: Strict maximum limit of **20 pinned messages per group chat**.
- **Message Search**: `searchGroupChatMessages()` uses debounced text matching with bounded candidate queries (max 50 results).

---

## 4. Local Drafts & Optimistic UI

- **Draft Key**: `groupChatDraft:{groupId}` stored in `localStorage`. Automatically restored when entering chat and cleared upon successful message send.
- **Optimistic UI**: Immediately renders local messages with sending state and retry triggers on network failure.

---

## 5. Storage Security Rules

- **Storage Path**: `groupChatMedia/{groupId}/{userId}/{filename}`
- **File Limit**: 10MB maximum file size per attachment, restricting uploads to authenticated group members.
