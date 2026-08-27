# Phase 36A — Permanent Group Instants & Unlimited Photo Sharing Upgrade

## Overview
Phase 36A upgrades Group Instants from temporary 24-hour stories into **Permanent Group Moments** with unlimited photo sharing backed by a scalable subcollection architecture (`groups/{groupId}/instants/{instantId}/media/{mediaId}`).

---

## 1. Permanent Lifecycle & Expiration Removal
- **No 24-Hour Expiration**: Instants remain accessible to authorized group members indefinitely.
- **Backward Compatibility**: Existing documents containing `expiresAt` remain visible without automatic client or server deletion.
- **Status Lifecycle**: `active` -> `deleted` (soft deleted by author or admin) or `hidden` (moderated).

---

## 2. Unlimited Photo Subcollection Architecture
- **Subcollection Path**: `groups/{groupId}/instants/{instantId}/media/{mediaId}`
- **Parent Document**: Contains lightweight metadata, `mediaCount`, and `media` fallback array (first 5 URLs for legacy clients).
- **Subcollection Document Schema**:
  ```json
  {
    "mediaId": "m_0_1787822400000",
    "instantId": "inst_1787822400000",
    "groupId": "group_cse_2029",
    "ownerId": "user_abc",
    "storagePath": "groupInstantMedia/group_cse_2029/user_abc/inst_1787822400000/1787822400000_photo.jpg",
    "downloadUrl": "https://firebasestorage.googleapis.com/...",
    "mimeType": "image/jpeg",
    "fileSize": 1048576,
    "order": 0,
    "createdAt": "TIMESTAMP"
  }
  ```

---

## 3. Practical Safety Limits & Storage Security
- **Max File Size**: 10MB per image.
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
- **Concurrent Batch Uploads**: 4 images uploaded concurrently per network chunk for browser stability. No product-level photo count cap.

---

## 4. Viewer & Lazy Preloading Architecture
- **Lazy Preloading**: Viewer fetches media items from subcollection using `getGroupInstantMedia(groupId, instantId, limitCount)` and preloads current, previous, and next images.
- **Photo Counter**: Displays `Photo X of Y` (e.g. "Photo 17 of 143").
- **Interactive Controls**: Touch side-tap navigation, keyboard arrow keys, author header, caption, emoji reaction bar, and "Reply in Group Chat" action.

---

## 5. Notification & Scalability Rules
- **Zero Fan-Out Writes**: Creating an Instant creates 0 broadcast notification documents.
- **FCM Topic Push Broadcast**: Publishes 1 push notification to topic `group_{groupId}` via Cloud Function.
