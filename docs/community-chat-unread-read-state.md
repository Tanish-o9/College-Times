# Community Chat Unread & Read State Architecture Specification

**Project**: College Times / AKGEC Times  
**Phase**: Phase 11 — Scalable Chat Unread Message & Read State  
**Target Concurrency**: 10,000+ Concurrent Community Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. ARCHITECTURE OVERVIEW

The unread message and read-state subsystem for Community Chat is designed to scale efficiently up to 10,000 concurrent users without creating Firestore write storms, per-message read receipts, or global collectionGroup scans.

### Firestore Hierarchy
```
users/{uid}/channelReadState/{channelId}
  ├── channelId: string
  ├── lastReadMessageId: string
  ├── lastReadAt: Timestamp
  └── updatedAt: Timestamp

channels/{channelId}
  ├── lastMessageAt: Timestamp
  ├── lastMessagePreview: string
  └── lastMessageId: string
```

---

## 2. SCALABILITY & WRITE OPTIMIZATION RULES

1. **One Read-State Doc Per User Per Channel**:
   Read states live exclusively at `users/{uid}/channelReadState/{channelId}`. Zero per-message-per-user read documents are created.
2. **In-Memory Write Deduplication**:
   `markChannelAsRead()` checks `lastSavedReadMessageIdMap`. If `lastReadMessageId` has not changed since the last persist, the Firestore write operation is aborted immediately.
3. **Lazy Initialization**:
   Missing read-state documents indicate the user has never opened the channel. Read state is created only when the user opens the channel and reaches the bottom of the room.
4. **Sender Exclusion**:
   Messages sent by `currentUser.uid` do not increment unread counts for the sender. Sender automatically updates read cursor to `newMessageRef.id`.
5. **No Write Storm on Scroll**:
   Read state is updated strictly when the user reaches $\le 150\text{px}$ from the bottom of the room, on initial load if at bottom, or when clicking "Jump to latest".

---

## 3. UNREAD CALCULATION ALGORITHM

The `useChatUnreadState` hook calculates unread channel statuses cheaply in-memory using:
- **Scenario A**: `lastReadMessageId === channel.lastMessageId` $\Rightarrow$ 0 unread.
- **Scenario B**: `channel.lastMessageAt > readState.lastReadAt` $\Rightarrow$ Unread badge active.
- **Scenario C**: Realtime incoming message while room is open $\Rightarrow$ Increments volatile `localUnreadMap` if user is scrolled away from bottom.
- **Scenario D**: Unopened channel (no `readState`) $\Rightarrow$ Unread dot (`•`) shown until opened.

---

## 4. FIREBASE SECURITY RULES

```rules
// Channel Read State Sub-collection: 1 per user per channel
match /channelReadState/{channelId} {
  allow read: if isOwner(userId);
  allow create, update: if isOwner(userId)
    && request.resource.data.keys().hasAll(['channelId', 'lastReadMessageId', 'lastReadAt'])
    && request.resource.data.channelId is string
    && request.resource.data.lastReadMessageId is string
    && request.resource.data.lastReadMessageId.size() <= 100;
  allow delete: if isOwner(userId);
}
```

---

## 5. UI COMPONENTS & ACCESSIBILITY

- **`ChannelList.tsx`**: Displays unread badge (`4`, `99+`, `•`) with `aria-label="${unreadCount} unread messages"`.
- **`Navbar.tsx`**: Displays global chat unread badge on Channels nav item (`totalUnreadCount`) with `aria-label="${totalUnreadCount} total unread chat messages"`.
- **`ChatRoom.tsx`**: Floating jump-to-bottom button displays `↓ ${newMessagesCount} new message(s)` with keyboard accessibility.
