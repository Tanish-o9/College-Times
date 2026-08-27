# Campus Emergency Incident Management & Live Incident Status System

**Project**: College Times / AKGEC Times  
**Phase**: Phase 22 — Campus Emergency Incident Management & Live Incident Status System  
**Target Concurrency**: 10,000+ Concurrent Community Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. OBJECTIVE & EMERGENCY INCIDENT OVERVIEW

Phase 22 builds a production-grade Campus Emergency Incident System allowing authorized administrators to report, verify, activate, escalate, monitor, and resolve live campus incidents with real-time status updates.

> **[!IMPORTANT]**
> **Zero 10K Per-User Firestore Fan-Out**:  
> Creating or activating an incident for 10,000 students writes **exactly 1 incident document** (`incidents/{incidentId}`) and 1 alert index document (`activeAlerts/{incidentId}`).  
> It creates **0 automatic per-user documents** and dispatches push notifications via existing FCM topics.

---

## 2. INCIDENT DATA MODEL (`incidents/{incidentId}`)

```ts
export interface Incident {
  id: string;
  title: string;
  summary: string;
  category: 'accident' | 'medical' | 'fire' | 'security' | 'weather' | 'infrastructure' | 'transport' | 'other';
  severity: 'low' | 'moderate' | 'high' | 'critical';
  status: 'reported' | 'verifying' | 'active' | 'monitoring' | 'resolved' | 'dismissed';
  locationName: string;
  locationLat?: number;
  locationLng?: number;
  affectedArea: 'campus' | 'department' | 'building' | 'batch' | 'community';
  affectedAreaId?: string;
  emergencyInstructions?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  verifiedAt?: Timestamp;
  resolvedAt?: Timestamp;
  resolutionSummary?: string;
  currentAlertId?: string;
}
```

---

## 3. STATE MACHINE TRANSITION RULES

Centralized state transition validation in `src/services/incidentService.ts`:

```
REPORTED → VERIFYING → ACTIVE → MONITORING → RESOLVED
   ↓           ↓
DISMISSED   DISMISSED
```

- **Terminal States**: `resolved` and `dismissed` are terminal; clients cannot transition them back to `active`.

---

## 4. REAL-TIME LIVE STATUS UPDATES

- **Subcollection**: `incidents/{incidentId}/updates/{updateId}` (`{ message, status, createdBy, createdAt }`).
- **Realtime Bounds**: `subscribeToIncidentUpdates` uses an `onSnapshot` query capped at max 50 items with deterministic unsubscribe.

---

## 5. ALERT & FCM INTEGRATION

- **Idempotency Key**: Uses `incidentId` as the unique key.
- **Activation**: When an incident becomes `active` with severity `high` or `critical`, it creates/updates `activeAlerts/{incidentId}` and triggers existing FCM topic notification dispatches without duplicating campaigns.

---

## 6. UI COMPONENTS & ACCESSIBILITY

- **`CreateIncidentForm.tsx`**: Admin incident reporting modal with string length and coordinate validations.
- **`IncidentDetail.tsx`** (`/incidents/:incidentId`): Live status page with timeline, status badges, emergency instructions, user acknowledgement button ("I've seen this alert"), and resolution modal.
- **`ActiveIncidentStrip.tsx`**: Compact top overlay strip displayed on main layout when active `HIGH` or `CRITICAL` incidents exist (max 3 visible).
- **Accessibility**: Enforces `aria-live="assertive"` for critical incidents and `aria-live="polite"` for active incidents.

---

## 7. FIRESTORE SECURITY RULES

```rules
// User Incident Read State Sub-collection: Private to user
match /users/{userId}/incidentReadState/{incidentId} {
  allow read, create, update, delete: if isOwner(userId);
}

// User Incident Acknowledgements Sub-collection: Private to user
match /users/{userId}/incidentAcknowledgements/{incidentId} {
  allow read, create, update, delete: if isOwner(userId);
}

// Campus Emergency Incidents Collection & Updates Sub-collection
match /incidents/{incidentId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isAdmin();

  match /updates/{updateId} {
    allow read: if isAuthenticated();
    allow create, update, delete: if isAdmin();
  }
}
```

---

## 8. LOAD TEST VERIFICATION

Executed `node scripts/loadTestIncidents.js`:
- **Simulated Members**: 10,000
- **Total Firestore Writes**: 7 across 4 test incidents
- **Saved Per-User Writes**: 39,993 (100% SUCCESS)
- **State Machine Rules**: 100% PASS
- **Emergency Incident Security Checks**: 100% PASS
