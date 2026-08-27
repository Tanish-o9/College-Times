# Scalable Campus Instant Alerts & FCM Topic Notifications Architecture

**Project**: College Times / AKGEC Times  
**Phase**: Phase 18 — Scalable Campus Instant Alerts & FCM Topic Notifications  
**Target Concurrency**: 10,000+ Concurrent Community Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. OBJECTIVE & CORE SCALABILITY GUARANTEE

Phase 18 implements a production-grade **Instant Campus Alert** system powered by **Firebase Cloud Messaging (FCM) Topics**.

> **[!IMPORTANT]**
> **10,000-User Scale Architecture**:  
> Large-audience notifications use **FCM Topics** (`campus_all`, `department_cse`, `batch_2029`, `group_<groupId>`) rather than per-user Firestore notification fan-out.  
> Creating a campus emergency alert for 10,000 students produces **1 write to `posts/{postId}` + 1 write to `notificationsDelivery/{postId}` + 1 FCM Topic publish request** (0 bulk Firestore writes).

---

## 2. DETERMINISTIC TOPIC NAMES

- **Campus-Wide**: `campus_all`
- **Department**: `department_<deptId>` (e.g. `department_cse`)
- **Batch Year**: `batch_<batchYear>` (e.g. `batch_2029`)
- **Community Group**: `group_<groupId>` (e.g. `group_robotics-club`)
- **Chat Channel**: `channel_<channelId>` (e.g. `channel_general`)

---

## 3. PUSH TOKEN MODEL & FIRESTORE RULES

Push tokens are stored under private user-scoped subcollections:  
`users/{uid}/pushTokens/{tokenId}`

```ts
export interface PushTokenDoc {
  token: string;
  platform: 'web';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  active: boolean;
}
```

### Firestore Security Rules
```rules
// Private user push token storage
match /users/{userId}/pushTokens/{tokenId} {
  allow read, create, update, delete: if isOwner(userId);
}

// Admin-only read, client write blocked idempotency collection
match /notificationsDelivery/{postId} {
  allow read: if isAdmin();
  allow write: if false;
}
```

---

## 4. SERVICE WORKER (`public/firebase-messaging-sw.js`)

- Background FCM push listener (`messaging.onBackgroundMessage`).
- Displays notification card with title, truncated snippet, and app icon.
- Handles notification click (`notificationclick`) $\rightarrow$ navigates to `/feed?postId=<postId>` and focuses active browser tab.

---

## 5. CLOUD FUNCTION & IDEMPOTENCY

Implemented in `functions/src/index.ts` (`onPostCreateHandler`):
1. Verifies `notifyAudience === true` and post moderation status (`active`).
2. **Idempotency Check**: Reads `notificationsDelivery/{postId}`. If `status === 'sent'`, skips retry execution to prevent duplicate notifications.
3. Resolves target FCM topic name (`resolveAudienceTopicName`).
4. Dispatches single topic notification via Firebase Admin SDK (`admin.messaging().sendToTopic(topic, payload)`).
5. Updates `notificationsDelivery/{postId}` status to `'sent'`.

---

## 6. DEEP LINKING & FEED HIGHLIGHTING

- Deep link format: `/feed?postId=<postId>`
- `Feed.tsx` reads `searchParams.get('postId')`.
- Auto-fetches target post if not present in initial 10-item page.
- Scrolls post element `id="post-<postId>"` into view and applies temporary 3-second ring highlight.

---

## 7. ALERT AUTHORIZATION & POLICIES

- Configurable student emergency policy constant: `CAN_STUDENTS_SEND_URGENT_ALERTS = false`.
- Standard student posts: Normal priority alerts allowed.
- Emergency alerts: Restricted to campus administrators (`userProfile.role === 'admin'`). Enforced both client-side and server-side (`postService.ts` & `firestore.rules`).

---

## 8. LOAD TEST VERIFICATION

Executed `node scripts/loadTestAlerts.js` for 10,000 members:
- **Total Simulated Members**: 10,000
- **Total Firestore Writes**: 8 across 4 alerts (Average 2 per alert)
- **Saved Mass Fan-out Writes**: 39,992 (100% SUCCESS)
- **FCM Topic Publishes**: 4
