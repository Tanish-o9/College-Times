# Verified Campus Incident Instant Broadcast & Push Notification Architecture

**Project**: College Times / AKGEC Times  
**Phase**: Phase 24 — Verified Campus Incident Instant Broadcast & Push Notification  
**Target Concurrency**: 10,000+ Concurrent Campus Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. ARCHITECTURE OVERVIEW

$$\text{STUDENT REPORT} \xrightarrow{\text{Verification}} \text{ADMIN REVIEW} \xrightarrow{\text{Confirm Broadcast}} \text{CLOUD FUNCTION} \xrightarrow{\text{FCM Topic 'campus_all'}} \text{10,000+ SUBSCRIBED USERS}$$

> **[!IMPORTANT]**
> **Zero 10,000-Document Notification Fan-Out Writes**:  
> Initiating a campus broadcast writes **exactly 1 canonical document** (`campusBroadcasts/{incidentId}`) and dispatches **1 FCM topic publish operation** to `campus_all`.  
> It performs **0 per-user Firestore notification writes**.

---

## 2. FCM TOPIC STRATEGY & SERVICE WORKER

- **Canonical Topic**: `campus_all`
- **Frontend Permission Service (`pushNotificationService.ts`)**:
  - Non-intrusive prompt rendered via `CampusNotificationPrompt.tsx`. Permission is requested ONLY after explicit user click on "Enable Notifications".
  - Registers service worker `public/firebase-messaging-sw.js` and retrieves FCM token.
  - Registers push token under `users/{userId}/pushTokens/{tokenId}` with topic `'campus_all'`.
- **Service Worker (`public/firebase-messaging-sw.js`)**:
  - Handles background push notifications.
  - `notificationclick` handler deep links to `/incidents/{incidentId}` (focuses existing app window or opens new client window).

---

## 3. IDEMPOTENCY & CLOUD FUNCTIONS

- **Cloud Function**: `onCampusBroadcastHandler` in `functions/src/index.ts`
- **Idempotency Lock**: `campusBroadcasts/{incidentId}` with state transitions (`pending` $\rightarrow$ `sending` $\rightarrow$ `sent` / `failed`).
- **Duplicate Prevention**: If `status === 'sent'` or `status === 'sending'`, duplicate execution attempts return safely without publishing duplicate push messages.
- **Admin Retry**: If `status === 'failed'` and `attemptCount < 3`, authorized admins can invoke `retryCampusBroadcast()`, which resets state to `'pending'`.

---

## 4. ADMIN BROADCAST CONTROLS & SEVERITY RULES

- Added `[x] Broadcast Instant Alert to Campus` checkbox in `IncidentReportCard.tsx`.
- **Prominent Confirmation**: For `HIGH` and `CRITICAL` severity incidents, displays explicit warning: `"This will send an instant FCM push notification to 10,000+ subscribed campus members."`
- **Default Policy**: Safe (No accidental broadcast without explicit Admin confirmation).

---

## 5. FIRESTORE & STORAGE SECURITY RULES

```rules
// Verified Campus Broadcasts Collection
match /campusBroadcasts/{incidentId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isAdmin();
}
```

- Students cannot create, update, delete, escalate severity, or verify broadcasts.

---

## 6. LOAD SIMULATION RESULTS

Executed `node scripts/loadTestCampusBroadcast.js`:
- **Subscribed Campus Members**: 10,000
- **FCM Topic Publish Operations per Alert**: 1 (`campus_all`)
- **Per-User Firestore Notification Writes**: 0 (100% Bounded)
- **Duplicate Broadcast Prevention**: 100% PASS
- **Security Rule Enforcements**: 100% PASS
