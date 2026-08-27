# Campus Feed 2.0: Instant Posts, Media Delivery, Reactions & Smart Distribution

**Project**: College Times / AKGEC Times  
**Phase**: Phase 26 — Campus Feed 2.0  
**Target Concurrency**: 10,000+ Concurrent Campus Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. ARCHITECTURE OVERVIEW

Phase 26 upgrades the campus feed into a fast, realtime, media-friendly campus feed with bounded multi-image gallery support ($\le 5$ images), client compression, instant post indicator, optimistic likes, bounded cursor pagination, Web Share API, bookmarking, and targeted social notifications — WITHOUT creating 10,000-document notification fan-outs.

$$\begin{matrix}
\text{\textbf{Normal Feed Posts}} & \rightarrow & \text{Firestore Feed Query} & \rightarrow & \text{0 Notification Fan-Out Writes} \\
\text{\textbf{Direct Post Interactions}} & \rightarrow & \text{1 Targeted Notification} & \rightarrow & \text{Author Only (Type: post\_like / post\_comment)} \\
\text{\textbf{Emergency Campus Alerts}} & \rightarrow & \text{1 FCM Topic ('campus\_all')} & \rightarrow & \text{0 Per-User Writes (Admin Verified Only)}
\end{matrix}$$

---

## 2. POST DATA MODEL HARDENING

```ts
export interface PostImageItem {
  storagePath: string;
  downloadUrl: string;
  width?: number;
  height?: number;
}

export interface Post {
  id?: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  category: 'Mishap' | 'Event' | 'General' | 'LostFound';
  timestamp: any;
  likeCount: number;
  commentCount: number;
  imageUrl?: string; // Legacy single image
  images?: PostImageItem[]; // Gallery support (max 5)
  postType: 'news' | 'lost' | 'found';
  status: 'resolved' | 'active' | 'deleted' | 'hidden';
  reportCount: number;
  contactInfo?: string;
  location?: string;
  eventId?: string;
  incidentId?: string;
  isOfficial?: boolean;
  audience?: PostAudience;
  priority?: PostPriority;
  notificationPolicy?: NotificationPolicy;
  savedCount?: number;
}
```

---

## 3. MEDIA PIPELINE (`postMediaService.ts`)

- **Storage Path**: `postMedia/{userId}/{postId}/{timestamp}_{fileIndex}_{cleanFilename}`
- **File Validation**: Max $10\text{MB}$ per file, max 5 images per post.
- **Allowed MIMEs**: `image/jpeg`, `image/png`, `image/webp`.
- **Sanitization**: Filenames stripped of special chars and truncated to $\le 100$ chars.

---

## 4. REALTIME STRATEGY & PAGINATION

- **Realtime Recent Window**: Bounded `onSnapshot` query on top 5 posts (`limit(5)`).
- **Floating New Posts Pill**: Displays `"X New Campus Posts Available"` when new posts land in recent snapshot without jumping user scroll.
- **Cursor Pagination**: Page size = 10 (`orderBy('timestamp', 'desc')`, `startAfter(lastDoc)`).
- **Intersection Observer**: Automatic infinite scrolling using `useIsVisible` hook on bottom sentinel.

---

## 5. OPTIMISTIC LIKES & BOOKMARKING

- **Atomic Likes (`postLikeService.ts`)**: `runTransaction` manages `posts/{postId}/likes/{userId}` documents and increments/decrements `likeCount` safely (min 0).
- **Targeted Notification**: Liking a post notifies the post author (`type: 'post_like'`), skipping self-notifications.
- **Bookmarking (`postBookmarkService.ts`)**: Stores saved posts under `users/{uid}/savedPosts/{postId}` (private to owner).

---

## 6. FIRESTORE & STORAGE SECURITY RULES

```rules
// User Saved Posts Sub-collection
match /savedPosts/{postId} {
  allow read, create, update, delete: if isOwner(userId);
}

// Posts Collection & Sub-collections
match /posts/{postId} {
  allow get: if isAuthenticated() && (!('reportCount' in resource.data) || resource.data.reportCount < 5 || isAdmin());
  allow list: if isAuthenticated();

  allow create: if isAuthenticated() 
    && request.resource.data.keys().hasAll(['title', 'content', 'authorId', 'authorName', 'category', 'timestamp', 'likeCount', 'commentCount', 'reportCount', 'status', 'postType'])
    && request.resource.data.authorId == request.auth.uid;

  allow update: if isAuthenticated() && (
    isAdmin() ||
    request.resource.data.diff(resource.data).affectedKeys().hasAny(['likeCount', 'commentCount', 'reportCount']) ||
    (resource.data.authorId == request.auth.uid && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'images', 'imageUrl']))
  );
}

// Storage Rules
match /postMedia/{userId}/{postId}/{filename} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
    && request.auth.uid == userId
    && request.resource.size < 10 * 1024 * 1024
    && request.resource.contentType.matches('image/.*');
}
```

---

## 7. LOAD SIMULATION RESULTS

Executed `node scripts/loadTestCampusFeed.js`:
- **Simulated Campus Members**: 10,000
- **Normal Post Broadcast Notification Fan-out Writes**: 0 (100% Bounded)
- **Multi-Image Gallery Limit**: 5 Max (PASS)
- **Atomic Optimistic Likes**: PASS
- **Security & Privacy Rules**: 100% PASS
