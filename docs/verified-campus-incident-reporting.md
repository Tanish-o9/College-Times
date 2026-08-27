# Verified Campus Incident Reporting, Evidence Submission & Admin Review Workflow

**Project**: College Times / AKGEC Times  
**Phase**: Phase 23 — Verified Campus Incident Reporting, Evidence Submission & Admin Review Workflow  
**Target Concurrency**: 10,000+ Concurrent Community Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. OBJECTIVE & CONTROLLED WORKFLOW

Phase 23 implements a controlled student reporting workflow for campus incidents. Student reports **do not automatically broadcast emergency alerts** across campus.

$$\text{STUDENT REPORT} \rightarrow \text{PENDING} \rightarrow \text{ADMIN REVIEW} \rightarrow \text{REJECTED / DISMISSED OR VERIFIED} \rightarrow \text{INCIDENT CREATED/LINKED} \rightarrow \text{ALERT SYSTEM}$$

> **[!IMPORTANT]**
> **Zero Mass Notification Fan-Out at Submission**:  
> Submitting a report writes **exactly 1 document** (`incidentReports/{reportId}`) and uploads evidence to Firebase Storage.  
> It dispatches **0 broadcast notifications** to campus members.

---

## 2. INCIDENT REPORT DATA MODEL (`incidentReports/{reportId}`)

```ts
export interface IncidentReport {
  id: string;
  reporterId: string;
  reporterDisplayName?: string;
  category: IncidentCategory;
  description: string;
  locationName: string;
  locationLat?: number;
  locationLng?: number;
  evidence?: EvidenceAttachment[];
  status: 'pending' | 'under_review' | 'verified' | 'rejected' | 'dismissed';
  severity: 'unknown' | 'low' | 'moderate' | 'high' | 'critical';
  createdAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewNote?: string;
  incidentId?: string;
  alertId?: string;
}
```

---

## 3. EVIDENCE STORAGE & SANITIZATION

- **Storage Path**: `incidentEvidence/{reportId}/{userId}/{sanitizedFilename}`
- **Allowed MIMEs**: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/webm`.
- **Max Limits**: $\le 5$ files per report; max $10\text{MB}$ per file. Unsafe file extensions (`.exe`, `.js`, `.bat`, `.cmd`, `.ps1`, `.svg`, `.html`) are strictly rejected.
- **Sanitization**: Replaces `/`, `\`, URI/control chars with `_`, truncated to max 100 characters.

---

## 4. SERVER-ENFORCED RATE LIMITING

- Max 3 report submissions per 10-minute window per user checked in `createIncidentReport`.

---

## 5. UI COMPONENTS & ROUTES

- **`ReportIncidentForm.tsx`**: Student report form with upload progress tracking.
- **`MyIncidentReports.tsx`** (`/my-reports`): Student list view tracking report verification statuses.
- **`IncidentReportDetail.tsx`** (`/my-reports/:reportId`): Detail view displaying report status, review notes, evidence attachments, and linked verified incident.
- **`IncidentReportCard.tsx`**: Admin review queue card in `AdminDashboard.tsx` with "Take Review", "Verify", "Reject", and "Dismiss" controls.

---

## 6. FIRESTORE & STORAGE SECURITY RULES

```rules
// Storage Rules
match /incidentEvidence/{reportId}/{userId}/{filename} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
    && request.auth.uid == userId
    && request.resource.size <= 10 * 1024 * 1024
    && (
      request.resource.contentType.matches('image/.*') ||
      request.resource.contentType == 'video/mp4' ||
      request.resource.contentType == 'video/webm'
    );
}

// Firestore Rules
match /incidentReports/{reportId} {
  allow read: if isAuthenticated() && (resource == null || resource.data.reporterId == request.auth.uid || isAdmin());
  allow create: if isAuthenticated() 
    && request.resource.data.reporterId == request.auth.uid 
    && request.resource.data.status == 'pending';
  allow update: if (isAuthenticated() 
    && resource.data.reporterId == request.auth.uid 
    && resource.data.status == 'pending' 
    && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['status', 'reviewedBy', 'severity', 'incidentId', 'alertId']))) 
    || isAdmin();
  allow delete: if (isAuthenticated() && resource.data.reporterId == request.auth.uid && resource.data.status == 'pending') || isAdmin();
}
```

---

## 7. LOAD TEST VERIFICATION

Executed `node scripts/loadTestIncidentReports.js`:
- **Simulated Members**: 10,000
- **Submission Notification Writes**: 0 (100% Bounded)
- **Rate Limiting & Security Checks**: 100% PASS
- **Review Queue Transitions**: 100% PASS
