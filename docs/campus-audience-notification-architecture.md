# Campus Audience Targeting & Notification Intelligence Foundation Architecture

**Project**: College Times / AKGEC Times  
**Phase**: Phase 16 — Campus Audience Targeting & Notification Intelligence Foundation  
**Target Concurrency**: 10,000+ Concurrent Community Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. OBJECTIVE & CORE DESIGN PRINCIPLE

Phase 16 establishes the technical foundation for campus audience targeting, notification priorities, and user preference controls without compromising system scalability.

> **[!IMPORTANT]**
> **Critical Scalability Guarantee**:  
> **Feed visibility and notification delivery are separate systems.**  
> Creating a campus post (e.g. *"Main block mein fest chal raha hai"*) creates **exactly 1 Firestore post document** (`posts/{postId}`) and uploads its media to Firebase Storage. Normal campus posts **must never generate one Firestore notification document per campus member** (0 mass notification fan-out writes).

---

## 2. DATA MODELS

### Audience Model
```ts
export type AudienceType = 'campus' | 'channel' | 'department' | 'batch' | 'custom';

export interface PostAudience {
  type: AudienceType;
  channelId?: string;
  departmentId?: string;
  batchId?: string;
  audienceId?: string;
}
```

### Post Priority Model
```ts
export type PostPriority = 'normal' | 'important' | 'emergency';
```
- **`normal`**: Default for standard student campus posts.
- **`important`**: Featured updates (timetable updates, campus events).
- **`emergency`**: Critical safety / administrative alerts (**Admin-only access**, enforced server-side via `firestore.rules`).

### Notification Policy & User Preferences
```ts
export interface CampusNotificationPreferences {
  enabled: boolean;
  importantEnabled: boolean;
  emergencyEnabled: boolean;
  mentionsEnabled: boolean;
  repliesEnabled: boolean;
  reactionsEnabled: boolean;
  updatedAt?: Timestamp | FieldValue | any;
}
```

Stored at user-scoped path: `users/{uid}/notificationPreferences/campus`.

---

## 3. AUDIENCE RESOLUTION SERVICE

Implemented in `src/services/audienceService.ts`:
- **`campus`**: Fully supported (entire campus feed).
- **`channel`**: Fully supported (channel-scoped post visibility).
- **`department`**: Controlled "Coming Soon in Phase 17" status.
- **`batch`**: Controlled "Coming Soon in Phase 17" status.
- **`custom`**: Controlled "Coming Soon in Phase 17" status.

---

## 4. FIRESTORE SECURITY RULES

```rules
// Campus Notification Preferences Sub-collection
match /users/{userId}/notificationPreferences/{preferenceId} {
  allow read: if isOwner(userId);
  allow create, update: if isOwner(userId)
    && request.resource.data.keys().hasAll(['enabled', 'importantEnabled', 'emergencyEnabled', 'mentionsEnabled', 'repliesEnabled', 'reactionsEnabled'])
    && request.resource.data.enabled is bool
    && request.resource.data.importantEnabled is bool
    && request.resource.data.emergencyEnabled is bool
    && request.resource.data.mentionsEnabled is bool
    && request.resource.data.repliesEnabled is bool
    && request.resource.data.reactionsEnabled is bool;
  allow delete: if isOwner(userId);
}

// Emergency priority post protection
match /posts/{postId} {
  allow create: if isAuthenticated()
    && request.resource.data.authorId == request.auth.uid
    && (!('priority' in request.resource.data) || request.resource.data.priority != 'emergency' || isAdmin());
}
```

---

## 5. UI COMPONENTS & SETTINGS

- **`CreatePostModal.tsx`**: Updated with Target Audience selector (`Campus`, `Current Channel`, `Department (Soon)`, `Batch (Soon)`) and Priority selector (`Normal`, `Important`, `Emergency (Admin)`).
- **`CampusNotificationSettings.tsx`**: Route `/settings/notifications` enabling users to toggle preferences for standard updates, important updates, emergency alerts, mentions, replies, and reactions.
- **Informational Notice**: *"Turning off notifications does not hide campus posts from your feed."*

---

## 6. 10,000-USER SCALE GUARANTEES

1. **0 Mass Fan-Out Writes**: Creating a campus post for 10,000 students produces 1 write to `posts/{postId}`.
2. **Feed Query Isolation**: Feed rendering performs index-backed cursor queries (`getDocs(query(postsRef, orderBy('timestamp', 'desc'), limit(10)))`) without accessing notification collections.
3. **No Unbounded Listeners**: Zero global audience or notification listeners created.
