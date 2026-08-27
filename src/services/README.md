# AKGEC Times — Service Layer API Contracts

This directory contains modular service interfaces for all Firestore collection interactions across AKGEC Times.

> **Architecture Constraint**: Components must **never** invoke Firestore SDK directly. All document reads, writes, queries, and listeners are encapsulated strictly within this service layer.

---

## Service Contracts & Collection Ownership

### 1. `authService.ts`
- **Collection Owned**: `users`
- **Document Model**: `User`
- **Planned Operations**:
  - `createUserProfile(user: User): Promise<void>`
  - `getUserProfile(uid: string): Promise<User | null>`
  - `updateUserProfile(uid: string, updates: Partial<User>): Promise<void>`
  - `incrementUserPoints(uid: string, pointsDelta: number): Promise<void>`

### 2. `postService.ts`
- **Collection Owned**: `posts`
- **Document Model**: `Post`
- **Planned Operations**:
  - `createPost(post: Omit<Post, 'id'>): Promise<string>`
  - `getFeedPosts(category?: string, lastDoc?: any): Promise<Post[]>`
  - `getPostById(postId: string): Promise<Post | null>`
  - `likePost(postId: string, userId: string): Promise<void>`
  - `reportPost(postId: string, reporterId: string, reason: string): Promise<void>`
  - `deletePost(postId: string): Promise<void>`

### 3. `commentService.ts`
- **Collection Owned**: `comments`
- **Document Model**: `Comment`
- **Planned Operations**:
  - `addComment(comment: Omit<Comment, 'id'>): Promise<string>`
  - `getCommentsByPostId(postId: string): Promise<Comment[]>`
  - `deleteComment(commentId: string, postId: string): Promise<void>`

### 4. `notificationService.ts`
- **Collection Owned**: `notifications`
- **Document Model**: `Notification`
- **Planned Operations**:
  - `sendNotification(notification: Omit<Notification, 'id'>): Promise<string>`
  - `getUserNotifications(recipientId: string): Promise<Notification[]>`
  - `markNotificationAsRead(notificationId: string): Promise<void>`

### 5. `eventService.ts`
- **Collection Owned**: `events` (mapped as `CampusEvent`)
- **Document Model**: `CampusEvent`
- **Planned Operations**:
  - `createEvent(event: Omit<CampusEvent, 'id'>): Promise<string>`
  - `getUpcomingEvents(): Promise<CampusEvent[]>`
  - `rsvpToEvent(eventId: string, userId: string): Promise<void>`

### 6. `lostFoundService.ts`
- **Collection Owned**: `posts` (Filtered by `postType: 'lost' | 'found'`)
- **Document Model**: `Post`
- **Planned Operations**:
  - `createLostFoundItem(item: Omit<Post, 'id'>): Promise<string>`
  - `getLostFoundItems(status?: 'active' | 'resolved'): Promise<Post[]>`
  - `markItemAsResolved(postId: string, authorId: string): Promise<void>`

---

## General Rules for Service Implementation
1. Use `serverTimestamp()` for write timestamps.
2. Wrap all operations in `try/catch` with `react-hot-toast` notifications.
3. Keep return types strictly typed to models defined in `/src/types/models.ts`.
