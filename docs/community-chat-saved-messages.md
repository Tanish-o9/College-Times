# Community Chat Saved Messages & Bookmarks Architecture Specification

**Project**: College Times / AKGEC Times  
**Phase**: Phase 15 — Community Chat Saved Messages / Bookmarks  
**Target Concurrency**: 10,000+ Concurrent Community Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. OBJECTIVE

The Saved Messages system allows community members to bookmark important chat messages (text, image, file/document, reply) to their personal collection and navigate directly to the original message via deep linking, without introducing hot-document write bottlenecks or modifying source chat messages.

> **[!IMPORTANT]**
> **Key Architectural Guarantees**:
> 1. **No Source Document Writes**: Saving/unsaving a message does **NOT** modify the original message document (`channels/{channelId}/messages/{messageId}`). No `savedBy` arrays or save counters are added.
> 2. **User-Scoped Path**: `users/{uid}/savedMessages/{messageId}`. Deterministic `messageId` path ensures idempotency.
> 3. **No Binary Data**: Saved documents store metadata and text previews **ONLY**. Binary file/image contents are never duplicated into Firestore.

---

## 2. DATA MODEL & FIRESTORE SCHEMA

```ts
export interface SavedChatMessage {
  messageId: string;
  channelId: string;
  savedAt: Timestamp | FieldValue | any;
  senderId: string;
  senderName: string;
  messageType: 'text' | 'image' | 'file';
  previewText: string;
}
```

---

## 3. FIRESTORE SECURITY RULES

```rules
// Personal Saved Messages Sub-collection: 1 per message per user
match /users/{userId}/savedMessages/{messageId} {
  allow read: if isOwner(userId);
  allow create: if isOwner(userId)
    && request.resource.data.keys().hasAll(['messageId', 'channelId', 'savedAt', 'senderId', 'senderName', 'messageType', 'previewText'])
    && request.resource.data.messageId is string
    && request.resource.data.channelId is string
    && request.resource.data.senderId is string
    && request.resource.data.senderName is string
    && request.resource.data.messageType in ['text', 'image', 'file']
    && request.resource.data.previewText is string
    && request.resource.data.previewText.size() <= 200;
  allow delete: if isOwner(userId);
  allow update: if false; // Immutable saved bookmarks
}
```

- **User Privacy**: `read, create, delete` are strictly restricted to `isOwner(userId)` (`request.auth.uid == userId`). Cross-user reads and writes are blocked by security rules.
- **Immutability**: `allow update: if false;` prevents metadata tampering.

---

## 4. PAGINATION & SCALE AUDIT

- **Cursor Pagination**: Uses `orderBy("savedAt", "desc")` and `startAfter(lastDocSnapshot)`.
- **Bounded Page Size**: Default **20 items**, hard limit **50 items**.
- **No Global Listeners**: Uses one-time `getDocs` queries for pagination. Zero collection-wide realtime listeners.

---

## 5. DEEP LINKING & MESSAGE NAVIGATION

Clicking **Open ↗** on a saved item navigates to:  
`/chat/{channelId}?msgId={messageId}`

Reuses Phase 12 `ChatRoom` URL parameter deep-linking, automatic history pagination, target scrollIntoView, and 3-second temporary highlight ring (`id="message-{messageId}"`).

---

## 6. COMPATIBILITY & LIFECYCLE BEHAVIOR

- **Soft-Deleted Messages**: If a saved message becomes soft-deleted (`status: "deleted"`), the saved reference displays `"This message was deleted"` (italicized) without exposing file/image contents or download URLs.
- **Edited Messages**: Resolving live messages displays current text and `Edited` indicator.
- **Images & Files**: Renders Phase 13 file/image metadata card without automatically downloading file bytes.
- **Reactions & Mentions**: Saving a message does not affect reaction counts, `@mentions`, or Cloud Function notification triggers.
- **Unread & Gamification**: Saving a message awards 0 points and does not alter channel or global unread counts.
