# 10,000-Member Community Chat — Architecture & Data Design

This document details the high-scale system architecture for the **College Times / AKGEC Times** Community Chat system, designed to support up to **10,000 concurrent community members** on Firebase (Auth, Firestore, Storage) and React/TypeScript.

---

## 🏛️ 1. Core Document Hierarchy & Storage Paths

To guarantee zero collection-wide lock bottlenecks and linear performance scaling:

- **Channels Collection**:  
  `channels/{channelId}`  
  Contains metadata (`name`, `description`, `category`, `type`, `memberCount`, `lastMessageAt`, `createdAt`).

- **Messages Sub-collection**:  
  `channels/{channelId}/messages/{messageId}`  
  Isolated per channel. Contains `senderId`, `senderName`, `senderRole`, `content`, `reactionCounts`, `status`, `createdAt`.

- **Members Sub-collection**:  
  `channels/{channelId}/members/{uid}`  
  Tracks individual channel subscriptions, roles (`member` | `moderator` | `admin`), `joinedAt`, and `lastReadAt` timestamps.

- **Ephemeral Typing Sub-collection**:  
  `channels/{channelId}/typing/{uid}`  
  Isolated temporary status documents containing `displayName` and `timestamp`, auto-expires after 5 seconds of inactivity.

---

## 🚫 2. Why Anti-Patterns Are Prohibited (10,000-User Scale)

### Why a Global `messages` Collection is NOT Used
Storing all community messages in a single top-level `messages` collection creates severe indexing bottlenecks and risk of accidental unbounded collection scans. Partitioning messages under `channels/{channelId}/messages` guarantees that queries remain strictly scoped to a single channel.

### Why 10,000 Users Are Never Stored in a Single Array or Document
Firestore documents are hard-capped at **1 MB**. Storing 10,000 user IDs or member objects inside a single `channel.members` array or map will exceed the document size limit and cause write transaction failures. Membership is strictly stored as separate documents in `channels/{channelId}/members/{uid}`.

### Why Real-Time Listeners Must Be Windowed
An unbounded `onSnapshot` listener on a channel with 50,000 messages would download the entire history to every client on mount, generating millions of read billing operations and crashing browser memory. All chat `onSnapshot` listeners are hard-capped at `limit(50)` latest messages.

### Why Older History Uses Cursor Pagination
To view older messages when scrolling up, the client executes one-time, non-realtime `getDocs()` queries using Firestore cursor pagination (`startAfter(lastVisibleDoc)` and `limit(30)`). This prevents unnecessary real-time billing for historic, static messages.

### Why Counters Require Transactions / Server Consistency
Naive client read-modify-write for `memberCount` or `reactionCounts` leads to race conditions when hundreds of users interact simultaneously. Counters are updated atomically using Firestore `runTransaction` with `increment()` operations or Cloud Functions.

---

## 📊 3. Scalable Unread Strategy (Zero Full Scan)

Calculating unread messages by querying unread message documents is forbidden because it scales linearly with message volume ($O(N)$ reads).

Instead, unread status is derived in $O(1)$ constant time:
- The channel document maintains a `lastMessageAt` timestamp.
- The user's membership doc `channels/{channelId}/members/{uid}` maintains a `lastReadAt` timestamp.
- **Unread Indicator**: A channel has unread messages if `channel.lastMessageAt > member.lastReadAt`.
- When a user opens a channel, `member.lastReadAt` is updated to the current timestamp.

---

## 🚀 4. Launch Channel Seed Plan (Phase 2 Admin SDK)

Client-side seeding of channels is prohibited to protect system integrity. Phase 2 will execute a standalone Node.js Admin SDK script to seed the initial default campus channels:

1. `#general` — Public campus-wide discussions.
2. `#batch-2026` — Academic batch & department updates.
3. `#lost-found-chat` — Community assistance for lost items.
4. `#events-chat` — Discussions around upcoming campus events.
5. `#admin-announcements` — Announcement-only channel (Admin write, student read-only).

---

## 👤 5. Joined Channels Denormalization Strategy (`users/{uid}.joinedChannelIds`)

To fetch a user's joined channel list without expensive `collectionGroup("members")` queries (which require global index permissions across thousands of docs), the user's profile document `users/{uid}` stores a denormalized array:

```typescript
joinedChannelIds: string[] // e.g. ["general", "events-chat"]
```

When a user joins or leaves a channel, `joinedChannelIds` is updated atomically alongside the channel membership document using a Firestore transaction.

---

## 🎮 6. Gamification Integration (`sendMessage`)

Currently, `sendMessage()` awards **+2 points** atomically in the same Firestore transaction that sets the message document, adhering strictly to current security rules (`request.resource.data.points == resource.data.points + 2`).

In Phase 6, server-side cooldowns and daily point caps will be integrated via Cloud Functions / transactional throttles to prevent spam farming.

---

## 📏 7. Message Length & Field Constraints

- **Message Content Cap**: 1,000 characters (enforced both client-side in `chatService.ts` and database-side in `firestore.rules`).
- **Sender Validation**: `senderId` must strictly equal `request.auth.uid`.
- **Announcement Protection**: Channels with `type == 'announcement'` can only be posted to by administrators (`isAdmin()`).

---

## ⚡ 8. Ephemeral Typing & Presence Strategy (Phase 7 Concept)

Typing indicators write temporary documents to `channels/{channelId}/typing/{uid}` containing `displayName` and `timestamp`.
- Real-time listener is bounded to `limit(10)`.
- Client filters out typing docs older than 5 seconds.
- Full presence & typing UI experience is scheduled for Phase 7.
