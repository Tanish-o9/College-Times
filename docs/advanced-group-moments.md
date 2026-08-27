# Phase 37 — Advanced Group Moments, Social Engagement & Scalable Activity System

## Overview
Phase 37 upgrades Permanent Group Moments into a complete social activity experience with discussion comments (`groups/{groupId}/instants/{instantId}/comments/{commentId}`), saved moments (`users/{uid}/savedGroupMoments/{instantId}`), deep link sharing (`/groups/{groupId}?moment={instantId}`), targeted author notifications, Moments discovery tab on `GroupDetailPage`, search integration, security rule hardening, and 10,000 member scale verification with 0 broadcast notification writes.

---

## 1. Permanent Lifecycle & Unlimited Media Architecture

- **No Expiration**: Instants remain accessible indefinitely.
- **Backward Compatibility**: `expiresAt` optional field preserved for historical records without triggering automatic client/server deletion.
- **Subcollection Media**: `groups/{groupId}/instants/{instantId}/media/{mediaId}` storing metadata only (`downloadUrl`, `mimeType`, `fileSize`, `order`, `createdAt`). Max 10MB per image file.

---

## 2. Moment Reactions & Discussion Comments

- **Reactions**: `groups/{groupId}/instants/{instantId}/reactions/{uid}` supporting `❤️`, `👍`, `🔥`, `😂`, `😮`. 1 reaction per user per Moment with transaction-safe counters.
- **Comments Subcollection**: `groups/{groupId}/instants/{instantId}/comments/{commentId}`
  - Schema: `{ commentId, instantId, groupId, authorId, authorName, authorAvatar?, text, createdAt, status: 'active' | 'deleted' }`.
  - Max text length: 500 characters.
  - Bounded pagination limit (20 items per page).

---

## 3. Save / Bookmark & Deep Link Sharing

- **Saved Moments**: `users/{uid}/savedGroupMoments/{instantId}` storing `{ instantId, groupId, savedAt }`.
- **Deep Link Sharing**: Web Share API with clipboard copy fallback (`/groups/{groupId}?moment={instantId}`).
- **Privacy Enforcement**: Non-members attempting to open private group deep links are blocked from viewing moment content.

---

## 4. 10,000 Member Scale & FCM Strategy

- **0 Fan-Out Writes**: Creating a Moment creates **0 broadcast notification documents**.
- **FCM Topic Push**: Publishes 1 push notification to topic `group_{groupId}` via Cloud Function.
- **Targeted Notifications**: Direct interactions (reactions, comments, mentions) send targeted notifications strictly to the Moment author.
