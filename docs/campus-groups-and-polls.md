# Campus Groups, Polls, Rich Social Interactions & Community Engagement

**Project**: College Times / AKGEC Times  
**Phase**: Phase 28 — Campus Groups & Polls  
**Target Concurrency**: 10,000+ Concurrent Campus Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. ARCHITECTURE OVERVIEW

Phase 28 establishes a scalable campus community engagement layer. Students and campus administrators can create, discover, and join campus groups (`groups/{groupId}`), participate in group discussions, publish interactive polls (`type: 'poll'`), submit votes with atomic transaction validation, react to posts with emoji reactions (`👍`, `❤️`, `😂`, `😮`, `😢`, `🔥`), and mention fellow group members — WITHOUT creating 10,000-document notification fan-outs or breaking existing feed, chat, or emergency alert systems.

$$\begin{matrix}
\text{\textbf{Group Membership}} & \rightarrow & \text{Canonical Sub-Collection: groups/\{groupId\}/members/\{uid\}} \\
\text{\textbf{Poll Voting}} & \rightarrow & \text{Atomic Transaction: posts/\{postId\}/pollVotes/\{uid\}} \\
\text{\textbf{Group Channel}} & \rightarrow & \text{Reused Chat Channel (/chat?channel=channel-\{groupId\})} \\
\text{\textbf{Group Notifications}} & \rightarrow & \text{Targeted Only (Mentions / Direct Interactions)}
\end{matrix}$$

---

## 2. CAMPUS GROUPS SCHEMA (`groups/{groupId}`)

```ts
export interface CampusGroup {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: 'campus' | 'department' | 'batch' | 'community';
  visibility: 'public' | 'private';
  memberCount: number;
  active: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

- **Membership Index**: `users/{uid}/groupMemberships/{groupId}` for $O(1)$ client lookup.
- **Member Pagination**: Bounded cursor queries (`getGroupMembersPage`, max $50$/page).

---

## 3. POLL ARCHITECTURE (`pollService.ts`)

```ts
export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

export interface PollData {
  question: string;
  options: PollOption[];
  allowMultiple?: boolean;
  anonymous?: boolean;
  expiresAt: number; // ms timestamp
  totalVotes: number;
}
```

- **Vote Record**: `posts/{postId}/pollVotes/{uid}` with `{ uid, optionIds, votedAt }`.
- **Atomic Transactions**: Votes update `options[i].voteCount` and `totalVotes` transactionally on parent post document. Server-side validation rejects votes after `now >= expiresAt`.

---

## 4. EMOJI REACTIONS (`postReactionService.ts`)

- Supported Emojis: `👍`, `❤️`, `😂`, `😮`, `😢`, `🔥`.
- Path: `posts/{postId}/reactions/{uid}`.
- Transactionally updates `reactionCounts` map on parent post. Dispatches 1 targeted notification to post author (skipping self-reactions).

---

## 5. FIRESTORE & STORAGE SECURITY RULES

```rules
// Poll Votes Sub-collection
match /pollVotes/{userId} {
  allow read: if isAuthenticated();
  allow create, update: if isAuthenticated() && userId == request.auth.uid;
  allow delete: if false;
}

// Post Reactions Sub-collection
match /reactions/{userId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isAuthenticated() && userId == request.auth.uid;
}

// Group Storage Path: groupMedia/{groupId}/{userId}/{filename}
match /groupMedia/{groupId}/{userId}/{filename} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == userId && request.resource.size < 10 * 1024 * 1024;
}
```

---

## 6. LOAD SIMULATION RESULTS

Executed `node scripts/loadTestGroups.js`:
- **Simulated Group Members**: 10,000
- **Group Post Notification Fan-out Writes**: 0 (100% Bounded)
- **Bounded Member Page Size**: 50 Max
- **Atomic Poll Voting**: PASS (76 total votes)
- **Expired Poll Protection**: PASS
- **Security Rule Tampering Rejections**: 100% PASS
