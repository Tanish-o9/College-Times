# Phase 34 — Instagram-Like Instant Group Sharing, Moments & Real-Time Group Broadcast

## Overview
Phase 34 introduces an Instagram-inspired lightweight "Instant" moments feature for campus groups (`groups/{groupId}/instants/{instantId}`). Group members can quickly capture and share photos (up to 5 images) or text with captions. Instants expire automatically after 24 hours and feature a fullscreen dark viewer, progress timer, emoji reactions, and direct reply to group chat.

---

## 1. Key Features & Data Architecture

- **Dedicated Sub-collection**: `groups/{groupId}/instants/{instantId}`
  ```json
  {
    "id": "inst_1787825000_abc",
    "groupId": "grp_1787823901_robotics",
    "senderId": "user_uid_123",
    "senderName": "Rahul Sharma",
    "senderAvatar": "https://...",
    "type": "image",
    "media": ["https://.../img1.png", "https://.../img2.png"],
    "caption": "Lab setup for upcoming robotics demo!",
    "createdAt": "Timestamp",
    "expiresAt": "Timestamp (+24h)",
    "status": "active",
    "reactionCounts": { "❤️": 5, "🔥": 8 },
    "replyCount": 2
  }
  ```

---

## 2. Expiration Policy (24 Hours)

- Default Expiration Duration: **24 Hours** (`expiresAt = createdAt + 24h`).
- Expiration Filter: Realtime listener filters active documents where `status == 'active'` and `expiresAt > Timestamp.now()`. Expired content is automatically hidden from queries.

---

## 3. Scalable FCM Broadcast (Zero 10K Firestore Fan-Out)

- **Cloud Function (`onGroupInstantCreate`)**: Triggered on creation of active Instants in `groups/{groupId}/instants/{instantId}`.
- Sends 1 FCM payload to topic `group_{groupId}`.
- **ZERO per-user Firestore notification fan-out** written for 10,000 group members.

---

## 4. UI Components

- **`GroupInstantCarousel`**: Horizontal roster rendered at top of Group Detail Page and Group Chat. Displays `+ Instant` creation trigger and glowing unread border indicators.
- **`CreateGroupInstantModal`**: Modal for selecting up to 5 photos, writing a 300-char caption, previewing images, and publishing with upload progress.
- **`GroupInstantViewer`**: Fullscreen Instagram-style dark viewer with segmented progress bars, side tap navigation, author metadata, emoji reaction bar, and "Reply in Group Chat" action.

---

## 5. Security & Storage Rules

- **Storage Path**: `groupInstantMedia/{groupId}/{userId}/{instantId}/{filename}` (Validated for MIME type and 10MB file limit).
- **Firestore Security Rules**: Authenticated access required for `groups/{groupId}/instants/{instantId}` and `users/{userId}/groupInstantState/{groupId}`.
