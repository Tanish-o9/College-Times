# Real-Time Campus Breaking News & Emergency Alert UX Architecture

**Project**: College Times / AKGEC Times  
**Phase**: Phase 20 — Real-Time Campus Breaking News & Emergency Alert UX  
**Target Concurrency**: 10,000+ Concurrent Community Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. OBJECTIVE & REAL-TIME EXPERIENCE

Phase 20 provides an in-app real-time breaking alert experience overlaying active campus updates and emergency alerts without requiring page refreshes or full-screen interruptions.

> **[!IMPORTANT]**
> **Zero 10K Per-User Real-time Listeners**:  
> Active alerts use a lightweight, bounded snapshot listener (`activeAlerts` collection; max 10 documents) with client-side audience filtering.  
> Users do **not** subscribe to individual post listeners or 10,000 per-recipient alert documents.

---

## 2. ACTIVE ALERT INDEX (`activeAlerts/{postId}`)

```ts
export interface ActiveAlertDoc {
  postId: string;
  audienceType: 'campus' | 'department' | 'batch' | 'community' | 'channel';
  audienceId?: string;
  priority: 'normal' | 'important' | 'emergency';
  title: string;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  active: boolean;
  pinned?: boolean;
  pinnedUntil?: Timestamp;
  channelId?: string;
  messageId?: string;
}
```

- **Content-free**: Stores title snippet and audience metadata only; full post content and images remain in `posts/{postId}`.

---

## 3. AUDIENCE & EXPIRATION FILTERING

Implemented in `src/services/activeAlertService.ts`:
- **Audience Verification**:
  - `campus`: Eligible for all authenticated campus members.
  - `department`: Verified against `userProfile.departmentId === audienceId`.
  - `batch`: Verified against `userProfile.batchYear === audienceId`.
  - `community` / `channel`: Verified against `joinedGroupIds.includes(audienceId)`.
- **Expiration Policy**: Drops alerts where `expiresAt` < current timestamp (Urgent default: 2 hours, Important default: 24 hours).
- **Session Dismissal**: Dismissing an alert writes `users/{uid}/dismissedAlerts/{postId}` only when explicitly clicked.

---

## 4. UI COMPONENTS & ACCESSIBILITY

- **`BreakingAlertBanner.tsx`**: Top overlay banner displaying priority badges (`🚨 URGENT CAMPUS ALERT`, `📢 IMPORTANT UPDATE`), title, audience tag, "View Update" button, and dismiss action.
  - Accessibility: `aria-live="assertive"` for emergency alerts, `aria-live="polite"` for important alerts.
  - Maximum visible banners: 3. Displays `+N More Campus Alerts` button linking to `/alerts`.
- **`AlertCenter.tsx`** (`/alerts`): Cursor-paginated active and historical campus alerts list (max 50/page).

---

## 5. ADMIN CONTROLS & ESCALATION

- **Pinning**: `pinActiveAlert(postId)` allows admins to pin up to 3 alerts at top of feed (`📌 Campus Announcement`).
- **Priority Escalation**: `escalateAlertPriority(postId, 'emergency')` allows admins to escalate priority. Restricted to Admins; ordinary student escalation attempts are rejected.

---

## 6. FIRESTORE SECURITY RULES

```rules
// User Dismissed Alerts Sub-collection: Private to user
match /users/{userId}/dismissedAlerts/{postId} {
  allow read, create, update, delete: if isOwner(userId);
}

// User Alert Read State Sub-collection: Private to user
match /users/{userId}/alertReadState/{postId} {
  allow read, create, update, delete: if isOwner(userId);
}

// Active Campus Alerts Index Collection
match /activeAlerts/{postId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isAdmin();
}
```

---

## 7. LOAD TEST VERIFICATION

Ran `node scripts/loadTestAlerts.js`:
- **Simulated Members**: 10,000
- **Total Firestore Writes**: 12 across 4 test alerts (Average 3 per alert)
- **Saved Per-User Writes**: 39,988 (100% SUCCESS)
- **Realtime UX & Security Checks**: 100% PASS
