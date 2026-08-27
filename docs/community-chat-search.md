# Community Chat Scalable Search Specification

**Project**: College Times / AKGEC Times  
**Phase**: Phase 12 — Scalable Community Chat Message Search  
**Target Concurrency**: 10,000+ Concurrent Community Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. SEARCH ARCHITECTURE & STRATEGY

Firestore is a document store optimized for index-backed queries, not a full-text search engine (e.g. Elasticsearch/Algolia). Rather than downloading entire channel histories into browser memory or executing unbounded scans, Phase 12 implements a bounded, index-driven search architecture.

### Scope Boundaries
- **Channel-Local Search**: Bounded Firestore query targeting `channels/{channelId}/messages`.
- **Multi-Channel Search**: Bounded parallel queries over user's joined channels (`joinedChannelIds`), hard-capped to top 5 channels per page.
- **Service Layer Abstraction**: Encapsulated inside `chatSearchService.ts` so future third-party search backends (e.g. Algolia/Typesense) can be plugged in without refactoring UI components.

---

## 2. FIRESTORE SEARCH SEMANTICS & LIMITATIONS

| Feature | Supported Semantics | Implementation Details |
|---|---|---|
| **Query Text Matching** | Normalized Token & Substring Match on Page | Normalizes input query (`normalizeSearchQuery`), filters matched content in bounded page. |
| **Moderation Filtering** | Hard status filter (`status == 'active'`) | Non-admin students are prohibited from querying `hidden` or `deleted` messages. |
| **Channel Scope** | Current channel vs All joined channels | Enforces explicit user membership checks before issuing queries. |
| **Date Range Filter** | `createdAt >= startDate` & `createdAt <= endDate` | Bounded timestamp range query. |
| **Pagination** | `startAfter(lastDoc)` | Cursor-based pagination with hard max limit (`pageSize <= 50`, default 20). |
| **Debounce** | 400ms frontend request throttle | Prevents Firestore query storms on keystrokes. Minimum 2 characters required. |

> **[!NOTE]**
> **Firestore Substring Limitation Note**: Native Firestore does not perform arbitrary substring indexing on arbitrary string fields across millions of unindexed documents. The client-side keyword matching is executed on bounded index-sorted query pages ($\le 50$ docs per request). For true full-text fuzzy token indexing across millions of historical messages, an external search engine (e.g. Algolia/Typesense) can be integrated via the existing `chatSearchService.ts` interface.

---

## 3. SECURITY & MEMBERSHIP PROTECTION

- **Membership Verification**: Users can only query messages from channels present in their `joinedChannelIds` or public channels.
- **Moderation Enforcer**: Queries for regular students strictly include `where('status', '==', 'active')`. Soft-deleted and hidden messages are filtered out.
- **No Unsafe HTML**: Match highlighting (`ChatSearch.tsx`) uses safe React text segmentation (`<mark>`) rather than `dangerouslySetInnerHTML`.

---

## 4. RESULT → MESSAGE NAVIGATION & DOM ANCHORING

1. Clicking a search result navigates to `/chat/:channelId?msgId=:messageId`.
2. `MessageBubble.tsx` attaches stable DOM identifier `id="message-:id"` and `data-message-id=":id"`.
3. `ChatRoom.tsx` detects `msgId`, scrolls target message into view smooth center, and applies a temporary 3-second highlight ring (`ring-2 ring-sky-400 bg-sky-500/10`).
4. If target message is older than current loaded window, `ChatRoom` auto-paginates older history up to a safe maximum limit.
