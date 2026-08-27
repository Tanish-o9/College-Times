# Community Chat System — Production Readiness & Architecture Specification

**Project**: College Times / AKGEC Times  
**Firebase Project**: `college-times-9f395`  
**Target Concurrency**: Up to 10,000 Concurrent Community Members  
**Status**: **PRODUCTION READY**

---

## 1. ARCHITECTURE OVERVIEW

The Community Chat System for College Times is engineered to support up to 10,000 concurrent student and admin members while remaining strictly bounded in Firestore operations, network bandwidth, and client memory.

### Data Model & Firestore Hierarchy
```
channels/{channelId}                          [Channel Metadata]
  ├── members/{uid}                          [Atomic Member State & Mute Status]
  ├── messages/{messageId}                    [ChatMessage Documents]
  │     ├── reactions/{uid}                  [1-per-user Reaction Documents]
  │     └── reports/{reporterId}             [1-per-user Moderation Reports]
  └── typing/{uid}                           [Ephemeral Typing Indicators (TTL: 5s)]

users/{uid}                                   [User Profiles & Rate Limit Timestamps]
chatReports/{messageId}_{reporterId}         [Top-Level Moderation Report Index]
notifications/{messageId}_{recipientId}      [Idempotent Mention Notifications]
```

### Realtime Database Presence Path
```
presence/{uid} -> { state: "online" | "offline", lastChanged: serverTimestamp }
```

---

## 2. SCALE & BOUNDARY CONSTRAINTS

| Subsystem | Scalability Rule | Implementation Mechanism |
|---|---|---|
| Messages Listener | **Bounded (Limit 50)** | `subscribeToRecentMessages` query `orderBy('createdAt', 'desc').limit(50)` |
| History Pagination | **Cursor Bounded (Limit 30)** | `getOlderMessages` using `startAfter(lastDoc).limit(30)` |
| Message Cache | **Cap 200 / channel** | `chatCacheService.ts` sliding window (max 200 items/channel) |
| Reply Cache | **Cap 200 items** | `replyCacheService.ts` FIFO eviction (max 200 items) |
| Mention Fan-Out | **Max 20 recipients** | Cloud Function `onMessageCreate` caps unique mention UIDs at 20 |
| Typing Writes | **Throttled (3s interval)** | `lastTypingWriteMap` throttles client writes to 1 per 3,000ms; 5s TTL |
| Presence Writes | **Zero Firestore Writes** | Handled exclusively via Firebase Realtime Database + `onDisconnect` hook |

---

## 3. SECURITY & MODERATION HARDENING

### Security Pairing Matrix

| Operation | Client Validation | Cloud Function Validation | Firestore Security Rules Enforcement |
|---|---|---|---|
| Rate Limiting | Throttled UI state | 30s window check | Transactional write on `users/{uid}.recentMessageTimestamps` |
| Denylist Filter | Pre-validation check | Re-validated in trigger | Rejected in `sendMessage()` & Cloud Function |
| Channel Muting | Disabled composer UI | Pre-send check | Rules check: `get(/.../members/$(auth.uid)).data.muted != true` |
| Soft Delete | Moderator indicator | Status validation | Rules check: `isAdmin()` or author UID matching |
| Report Message | Modal selection | Transactional indexing | Rules check: 1 report per `reporterId` (`request.auth.uid == reporterId`) |
| Image Upload | File type & 5MB cap | Client compression | `storage.rules`: matching owner `request.auth.uid == userId` & size $< 10$MB |

### Security Bypass Matrix Results (Tests A - M)
- **A. Role Escalation**: Rejected (Rules require existing admin role in `users/{uid}`). **PASS**
- **B. Points Manipulation**: Rejected (Points updates restricted by rule logic). **PASS**
- **C. Reaction Impersonation**: Rejected (Rule enforces `request.auth.uid == uid`). **PASS**
- **D. Typing Impersonation**: Rejected (Rule enforces `request.auth.uid == userId`). **PASS**
- **E. Presence Impersonation**: Rejected (`database.rules.json` enforces `auth.uid === $uid`). **PASS**
- **F. Non-Member Message Send**: Rejected (Rule verifies channel membership). **PASS**
- **G. Muted User Direct Write**: Rejected (Rule verifies `muted != true`). **PASS**
- **H. Unauthorized Delete**: Rejected (Only author or admin can delete). **PASS**
- **I. Unauthorized Mute**: Rejected (Only admin can update `muted` field). **PASS**
- **J. Duplicate Report Attempt**: Rejected (Transaction checks existing report sub-doc). **PASS**
- **K. Report Count Alteration**: Rejected (Rules block manual `reportCount` modification). **PASS**
- **L. Storage Upload to Other UID**: Rejected (`storage.rules` verifies `auth.uid == userId`). **PASS**
- **M. Non-Image Storage Upload**: Rejected (`storage.rules` enforces `contentType.matches('image/.*')`). **PASS**

---

## 4. CLOUD FUNCTIONS & RELIABILITY

- **Trigger**: `onMessageCreate` on `channels/{channelId}/messages/{messageId}`.
- **Idempotency**: Deterministic notification document IDs (`notifications/${messageId}_${recipientId}`). Retries write to identical IDs without duplicate notifications.
- **Fan-Out Capping**: Deduplicates recipient UIDs and caps at 20 max. Broadcast channels (`#general`, `#admin-announcements`) never perform fan-out.
- **Spam Cooldown**: Server-side 60-second cooldown check on `lastPointedMessageAt` before awarding +1 point.

---

## 5. FIRESTORE COMPOUND INDEXES

Declared in [`firestore.indexes.json`](file:///c:/Users/tanis/OneDrive/Desktop/Colleges%20Times/firestore.indexes.json):
1. `posts`: `category ASC`, `timestamp DESC`
2. `posts`: `reportCount DESC`, `timestamp DESC`
3. `notifications`: `recipientId ASC`, `timestamp DESC`
4. `messages` (Collection Group): `channelId ASC`, `createdAt DESC`

---

## 6. COST ESTIMATE (10,000 DAU BASELINE)

- **Assumptions**: 10,000 DAU, 3 channel opens/user/day, 5 messages/user/day.
- **Firestore Reads**: $\approx 2.5 \text{ Million reads/day} \Rightarrow \approx \$1.47 / \text{day}$.
- **Firestore Writes**: $\approx 100,000 \text{ writes/day} \Rightarrow \approx \$0.18 / \text{day}$.
- **Cloud Functions**: $\approx 50,000 \text{ invocations/day} \Rightarrow \text{Free tier covered}$.
- **Realtime Database**: $\approx 20,000 \text{ presence connections/day} \Rightarrow \text{Free tier covered}$.
- **Total Estimated Cost**: **$\approx \$50 - \$60 / \text{month}$**.

---

## 7. DEPLOYMENT & MONITORING GUIDE

### Deployment Commands
```bash
# 1. Deploy Firestore Security Rules
npx firebase-tools deploy --only firestore:rules --project college-times-9f395

# 2. Deploy Firestore Compound Indexes
npx firebase-tools deploy --only firestore:indexes --project college-times-9f395

# 3. Deploy Storage Rules
npx firebase-tools deploy --only storage --project college-times-9f395

# 4. Deploy Realtime Database Rules
npx firebase-tools deploy --only database --project college-times-9f395

# 5. Deploy Cloud Functions
npx firebase-tools deploy --only functions --project college-times-9f395
```

### Production Monitoring Metrics
- **Firebase Auth**: OTP usage and auth failure spikes.
- **Firestore Console**: Read/write operation spikes, index status, rule denials.
- **Realtime Database Console**: Peak concurrent connections and bandwidth usage.
- **Cloud Functions Console**: Invocation count, latency, error rates, and execution memory.
- **Storage Console**: Bandwidth and total stored chat media volume.

---

## 8. STAGED PRODUCTION ROLLOUT PLAN & KILL SWITCH

### Rollout Schedule
- **Stage 1 (Day 1)**: `rolloutPercentage = 5%` (Initial canary group testing).
- **Stage 2 (Day 2–3)**: `rolloutPercentage = 25%` (Broad student sample testing).
- **Stage 3 (Day 4–5)**: `rolloutPercentage = 60%` (Majority campus rollout).
- **Stage 4 (Day 6+)**: `rolloutPercentage = 100%` (Full Community Chat launch).

*Note: The admin/operator manually promotes rollout stages via the Admin Portal (**CHAT ROLLOUT** tab) after verifying system stability metrics.*

### Emergency Kill Switch Protocol
In the event of an unexpected security vulnerability, rate-limiting bypass, or Firestore quota emergency:
1. Navigate to **Admin Portal -> CHAT ROLLOUT**.
2. Click **TRIGGER KILL SWITCH (0%)**.
3. Confirm in the dialog.
4. **Result**: `featureFlags/chat` is set to `{ enabled: false, rolloutPercentage: 0 }`. All non-admin student access to Community Chat is immediately disabled client-side without requiring a frontend redeploy. Existing chat data remains intact.
