# Campus Alert Reliability, Delivery Tracking & Admin Monitoring Architecture

**Project**: College Times / AKGEC Times  
**Phase**: Phase 19 — Campus Alert Reliability, Delivery Tracking & Admin Monitoring  
**Target Concurrency**: 10,000+ Concurrent Community Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. OBJECTIVE & RELIABILITY GUARANTEES

Phase 19 hardens the Phase 18 Campus Instant Alert system for production usage with state-machine delivery tracking, invalid push token management, bounded retries, admin cancellation, deep-link fallbacks, and audit logging.

> **[!IMPORTANT]**
> **Zero 10K Per-Recipient Fan-Out**:  
> All delivery tracking operates on **aggregate notification records** (`notificationsDelivery/{postId}`) and daily metrics (`analytics/alertDaily/{YYYY-MM-DD}`).  
> No per-user delivery documents are generated for 10,000 members.

---

## 2. DELIVERY STATE MACHINE & SCHEMA

### Document Path
`notificationsDelivery/{postId}` (Deterministic document ID matching original post ID)

```ts
export type AlertDeliveryStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped' | 'cancelled';

export interface NotificationDeliveryDoc {
  postId: string;
  topic: string;
  audienceType: 'campus' | 'department' | 'batch' | 'community' | 'channel';
  priority: 'normal' | 'important' | 'emergency';
  status: AlertDeliveryStatus;
  attemptCount: number;
  createdAt: Timestamp;
  lastAttemptAt?: Timestamp;
  sentAt?: Timestamp;
  failedAt?: Timestamp;
  errorCode?: string;
  invalidTokenCount?: number;
  successCount?: number;
  failureCount?: number;
}
```

### State Transitions
```
pending → sending → sent
             ↓
           failed (Max 3 attempts, transient errors only)
             ↓ (Admin retry request)
           pending

pending → cancelled (Admin cancellation before delivery starts)
```

- **`sent` state immutability**: Once status reaches `'sent'`, transition back to `'pending'` or `'sending'` is blocked.

---

## 3. RETRY POLICY & IDEMPOTENCY

1. **Max Retry Limit**: Hard ceiling of 3 delivery attempts (`attemptCount <= 3`).
2. **Transient Errors Retried**: Network blips, temporary FCM endpoint timeouts.
3. **Permanent Errors Blocked**: Invalid topic syntax, unauthorized topic, malformed payload.
4. **Cloud Function Idempotency**: If `status === 'sent'`, Cloud Function retries immediately exit without sending duplicate push messages.

---

## 4. ADMIN MONITORING & DASHBOARD INTEGRATION

Integrated into `AdminDashboard.tsx` under **"CAMPUS ALERTS"** tab:
- **`AlertHistory.tsx`**: Paginated alert delivery log table (max 50 records per page, cursor-based pagination, no unbounded listeners).
- **`AlertDetail.tsx`**: Modal view displaying delivery status, topic, attempt count, and last error message.
- **Admin Actions**:
  - **Retry Delivery**: Permitted only for `'failed'` alerts with `attemptCount < 3`.
  - **Cancel Delivery**: Permitted only for `'pending'` alerts before sending starts.
  - **Audit Logging**: Actions record immutable audit entries in `adminAuditLogs/{logId}`.

---

## 5. FIRESTORE SECURITY RULES

```rules
// Private user push token storage, client cannot reactivate inactive tokens
match /users/{userId}/pushTokens/{tokenId} {
  allow read, create, delete: if isOwner(userId);
  allow update: if isOwner(userId) && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['active']) || request.resource.data.active == false);
}

// FCM Notification Delivery Idempotency Log (Admin-only read, client write blocked)
match /notificationsDelivery/{postId} {
  allow read: if isAdmin();
  allow write: if false;
}

// Admin Audit Logs Collection (Admin-only read, admin/backend write, immutable)
match /adminAuditLogs/{logId} {
  allow read: if isAdmin();
  allow create: if isAdmin() && request.resource.data.keys().hasAll(['actorId', 'action', 'targetId', 'timestamp']);
  allow update, delete: if false;
}
```

---

## 6. DEEP LINK FALLBACK & DEDUPLICATION

- **Deep Link Path**: `/feed?postId=<postId>`
- **Fallback Toast**: If post is deleted, hidden, or non-existent when notification is tapped, user sees `"This campus update is no longer available."` toast and is safely returned to Feed.
- **Foreground Deduplication**: `seenNotificationIds` Set (max 100 entries) prevents duplicate toast popups if duplicate push notifications arrive.

---

## 7. LOAD TEST VERIFICATION

Ran `node scripts/loadTestAlerts.js`:
- **Simulated Members**: 10,000
- **Total Firestore Writes**: 8 across 4 alerts (Average 2 per alert)
- **Saved Fan-out Writes**: 39,992 (100% SUCCESS)
- **Reliability & Security Checks**: 100% PASS
