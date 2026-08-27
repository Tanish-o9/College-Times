# Phase 32 — Unified Campus Group Discovery, Group Creation & Secure Invite Pass System

## Overview
Phase 32 upgrades College Times Campus Groups into a discoverable, high-scale (10,000 member capacity) community system. Every active group is discoverable according to visibility rules, with support for bounded search, category tabs (Campus, Departments, Batches, Communities, My Groups), and cryptographically generated unique invite pass codes (`CT-XXXXXX`).

---

## 1. Key Features

### 1. Unified Group Discovery & Bounded Search
- **Categories**: All Groups, Campus, Departments, Batches, Communities, My Joined Groups.
- **Real-Time Bounded Search**: Filters groups by name, category, department ID, graduation batch, or description.
- **Cursor Pagination**: Prevents unbounded Firestore scans with `limit(20–50)` and cursor-based pagination.

### 2. Group Creation for Campus Students
- **Student Group Creation**: Any authenticated campus student can create a group and automatically becomes the group creator and initial admin member.
- **Configurable Attributes**: Group name (max 80 chars), category, group type, description (max 500 chars), rules (max 1000 chars), visibility (Public vs Private), department, batch year.
- **Automatic Pass Code Generation**: Automatically creates a unique `CT-XXXXXX` pass code during group initialization.

### 3. Secure Invite Pass Code System (`CT-XXXXXX`)
- **Format**: `CT-XXXXXX` (e.g. `CT-7K4P9X`), cryptographically generated uppercase string.
- **Deterministic Lookup Index**: Stored in `groupInviteCodes/{normalizedCode}` with fields:
  ```json
  {
    "code": "CT-7K4P9X",
    "groupId": "grp_1787823901_robotics",
    "active": true,
    "createdAt": "Timestamp",
    "createdBy": "user_uid_123"
  }
  ```
- **Generic Error Responses**: Failed attempts return `"Invalid or expired group code."` without exposing if a private group exists.
- **Regeneration & Management**: Group creator/admin can regenerate codes (invalidating old codes instantly) or toggle invite pass code access.

### 4. Shareable QR & Deep Links
- **Deep Link Routing**: `/groups/join?code=CT-7K4P9X` auto-populates the pass code modal.
- **Inline SVG QR Generator**: Generates SVG QR codes encoding the join URL directly without external library overhead.
- **Copy Link / Share Link**: One-click copy for pass codes and share links.

### 5. High-Scale (10,000 Members) & Transaction Safety
- **Max Capacity Guard**: Atomic transaction validates `memberCount < 10000` before writing new membership.
- **Dual Membership Sync**:
  - `groups/{groupId}/members/{uid}` (Canonical group member document)
  - `users/{uid}/groupMemberships/{groupId}` (Denormalized user lookup index)
- **Zero Broadcast Writes**: 0 broadcast notifications written on group join to prevent O(N) database operations.

---

## 2. Data Structure Specifications

### CampusGroup Document (`groups/{groupId}`)
```typescript
interface CampusGroup {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: 'campus' | 'department' | 'batch' | 'community';
  visibility: 'public' | 'private';
  category?: string;
  rules?: string;
  departmentId?: string;
  batchYear?: number;
  iconUrl?: string;
  memberCount: number;
  active: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  inviteCodeHash?: string;
  inviteCodeVersion?: number;
  inviteEnabled?: boolean;
  inviteCodePlaintext?: string;
}
```

---

## 3. Privacy & Security Rules

- **Private Group Content Protection**: Non-members viewing private group detail pages are restricted from reading member lists, discussions, or group polls until joined via pass code.
- **Firestore Security Rules**:
  - `groupInviteCodes/{code}`: Authenticated read access for resolving pass codes.
  - `groups/{groupId}`: Authenticated read access; update rules restrict creator/admin fields.

---

## 4. Analytics Events

- `group_created`: Logged on group creation (`groupType`, `visibility`).
- `group_joined`: Logged on group join (`groupId`, `groupType`).
- `group_left`: Logged when leaving a group.
- `group_search`: Logged during group queries (`queryLength`, `categoryFilter`).
- `group_invite_code_used`: Logged when joining via pass code (`groupId`).
- `group_invite_regenerated`: Logged on code regeneration (`groupId`).
- `group_invite_disabled` / `group_invite_enabled`: Logged on invite toggle.
