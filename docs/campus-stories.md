# Scalable Campus Stories, 24-Hour Temporary Updates, Story Views, Reactions & Engagement

**Project**: College Times / AKGEC Times  
**Phase**: Phase 32 — Scalable Campus Stories  
**Target Concurrency**: 10,000+ Concurrent Campus Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. ARCHITECTURE OVERVIEW

Phase 32 introduces 24-hour temporary campus stories (`stories/{storyId}`). Stories support image and text content, background gradient styles, audience targeting (`campus`, `group`, `close_friends`), owner-only viewer tracking (`stories/{storyId}/views/{userId}`), reactions (`👍`, `❤️`, `😂`, `😮`, `😢`, `🔥`), and direct message replies integrating with Phase 31 private messaging.

$$\begin{matrix}
\text{\textbf{Author}} & \rightarrow & \text{Create Story (24h TTL: expiresAt = now + 24h)} \\
& & \downarrow \\
& & \text{\textbf{StoryBar.tsx}} \quad (\text{Grouped by Author}) \\
& & \downarrow \\
& & \text{\textbf{StoryViewer.tsx}} \quad (\text{5s Progress, Reactions, DM Reply}) \\
& & \downarrow \\
& & \text{Auto-expires after 24h } (\text{Query Filter: expiresAt > now \& status == 'active'})
\end{matrix}$$

---

## 2. FIRESTORE STORY DATA MODEL (`stories`)

```ts
export interface Story {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  mediaType: 'image' | 'text';
  mediaUrl?: string;
  storagePath?: string;
  text?: string;
  backgroundStyle?: string;
  audience: 'campus' | 'group' | 'close_friends';
  groupId?: string;
  status: 'active' | 'deleted' | 'expired';
  createdAt: Timestamp;
  expiresAt: Timestamp; // createdAt + 24 Hours
  viewCount?: number;
  reactionCount?: number;
  replyCount?: number;
}
```

---

## 3. 24-HOUR SERVER-SIDE EXPIRATION

Active stories are queried using server-side Firestore filters:
```ts
query(
  collection(db, 'stories'),
  where('status', '==', 'active'),
  where('expiresAt', '>', Timestamp.now()),
  orderBy('expiresAt', 'asc'),
  limit(50)
);
```
Stories with `expiresAt <= now` or `status != 'active'` are strictly excluded from active feeds.

---

## 4. SECURITY & PRIVACY RULES

- **Story Creation**: Allowed if `request.auth.uid == request.resource.data.authorId`.
- **Story Deletion**: Allowed by author only.
- **Viewer List Privacy**: `stories/{storyId}/views` is readable ONLY by the story author (`authorId == request.auth.uid`). Viewers cannot see who else viewed the story.
- **Storage Security**: Media stored in `storyMedia/{userId}/{storyId}/{filename}` restricted to authenticated uploader for images $\le 10\text{MB}$.

---

## 5. LOAD SIMULATION RESULTS

Executed `node scripts/loadTestStories.js`:
- **Simulated Users**: 10,000
- **24-Hour Server-Side Expiration**: PASS
- **Notification Fan-out Writes**: 0 (100% Bounded)
- **Author Ring Grouping**: PASS
- **Single View Document & Owner Privacy**: PASS
- **Story Media Path Security**: PASS
