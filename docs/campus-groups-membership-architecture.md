# Campus Groups, Departments, Batches & Scalable Membership Architecture

**Project**: College Times / AKGEC Times  
**Phase**: Phase 17 — Campus Groups, Departments, Batches & Scalable Membership  
**Target Concurrency**: 10,000+ Concurrent Community Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. OBJECTIVE & SCALABILITY GUARANTEES

Phase 17 builds a production-grade, highly scalable Campus Group system supporting campus-wide audiences, department groups, batch/year groups, and community groups.

> **[!IMPORTANT]**
> **Core Architectural Principles**:  
> 1. **Logical Campus Audience**: Campus-wide audience (`type: "campus"`) is represented logically and **does not require one membership document per user** (0 10,000-membership writes).  
> 2. **Canonical Membership Source**: Canonical group membership path is `groups/{groupId}/members/{uid}`.  
> 3. **Denormalized User Index**: `users/{uid}/groupMemberships/{groupId}` acts strictly as a user-scoped convenience lookup.  
> 4. **Feed & Notification Separation**: Feed audience targeting and notification delivery remain completely separate systems.

---

## 2. DATA SCHEMAS

### CampusGroup (`src/types/group.ts`)
```ts
export type CampusGroupType = 'campus' | 'department' | 'batch' | 'community';
export type CampusGroupVisibility = 'public' | 'private';

export interface CampusGroup {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: CampusGroupType;
  visibility: CampusGroupVisibility;
  departmentId?: string;
  batchYear?: number;
  iconUrl?: string;
  memberCount: number;
  active: boolean;
  createdBy: string;
  createdAt: Timestamp | FieldValue | any;
  updatedAt: Timestamp | FieldValue | any;
  chatChannelId?: string;
}
```

### GroupMember & UserGroupMembership
```ts
export interface GroupMember {
  uid: string;
  role: 'member' | 'moderator' | 'admin';
  joinedAt: Timestamp | FieldValue | any;
}

export interface UserGroupMembership {
  groupId: string;
  joinedAt: Timestamp | FieldValue | any;
}
```

---

## 3. ATOMIC TRANSACTIONS & COUNTER INTEGRITY

Implemented in `src/services/groupService.ts`:

- **`joinGroup(groupId, uid)`**:
  - Uses `runTransaction` to read `groups/{groupId}` and `groups/{groupId}/members/{uid}`.
  - Verifies `active === true`.
  - Idempotent: If member document already exists, returns safely without modifying counter.
  - If new member: Writes canonical membership `groups/{groupId}/members/{uid}`, denormalized index `users/{uid}/groupMemberships/{groupId}`, and increments `memberCount: increment(1)`.

- **`leaveGroup(groupId, uid)`**:
  - Uses `runTransaction` to delete canonical membership and denormalized index.
  - Decrements `memberCount: Math.max(0, currentCount - 1)`, preventing negative counters.

---

## 4. FIRESTORE SECURITY RULES

```rules
// User Group Memberships Index: 1 per group per user
match /users/{userId}/groupMemberships/{groupId} {
  allow read: if isOwner(userId);
  allow create, delete: if isOwner(userId) || isAdmin();
  allow update: if false;
}

// Campus Groups Collection & Members Sub-collection
match /groups/{groupId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isAdmin();

  match /members/{memberUid} {
    allow read: if isAuthenticated();
    allow create, delete: if (isAuthenticated() && memberUid == request.auth.uid) || isAdmin();
    allow update: if false;
  }
}
```

---

## 5. UI COMPONENTS & ROUTES

- **`GroupsPage.tsx`**: Route `/groups` providing group discovery tabs (All, Campus, Departments, Batches, Communities), Join/Leave actions, search filtering, and admin group initialization.
- **`GroupDetailPage.tsx`**: Route `/groups/:groupId` rendering group metadata, active status, join/leave toggle, and paginated members list.
- **`GroupMembers.tsx`**: Cursor-paginated member list (max 50 members/page).
- **Navigation**: Added `Groups` (`Users` icon) link to `Navbar.tsx`.

---

## 6. 10,000-USER SCALING GUARANTEES

1. **No `collectionGroup("members")` Scans**: Normal application rendering uses direct document reads (`getDoc`) or bounded user indexes (`getUserGroupIds`).
2. **Paginated Member Queries**: Member listing queries limit page sizes to max 50 (`getGroupMembersPage(groupId, pageSize, lastDoc)`).
3. **No Unbounded Listeners**: Zero global member listeners created.
