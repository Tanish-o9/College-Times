# Phase 36 — Unified Campus Search, Discovery & Smart Navigation

## Overview
Phase 36 implements a global unified campus search experience accessible directly from the Navbar (`/search?q=<query>` and `Ctrl+K` / `Cmd+K` keyboard shortcut). Students can search across People, Groups, Feed Posts, Events, Lost & Found, Marketplace listings, and Opportunities with 300ms debouncing, bounded results, deterministic ranking, search suggestions, and strict privacy filtering.

---

## 1. Search Categories & Entities

| Category | Searchable Fields | Public / Privacy Rules | Result Link |
|---|---|---|---|
| **People** | `displayName`, `username`, `department`, `batch`, `bio` | Excludes phone numbers, emails, blocked user records. | `/profile/:uid` |
| **Groups** | `name`, `description`, `category`, `department` | Shows public groups and discoverable metadata for private groups. | `/groups/:groupId` |
| **Posts** | `title`, `content`, `category` | Active public feed posts only. Excludes deleted, hidden, or private group posts. | `/?postId=:postId` |
| **Events** | `title`, `description`, `category`, `organizer` | Excludes cancelled or private event details. | `/events/:eventId` |
| **Lost & Found** | `title`, `description`, `category`, `location` | Excludes private contact information or phone numbers. | `/lost-found` |
| **Marketplace** | `title`, `description`, `category`, `sellerName` | Excludes private seller metadata. | `/marketplace` |
| **Opportunities**| `title`, `organization`, `category`, `description` | Public campus opportunities. | `/opportunities` |

---

## 2. Deterministic Ranking Algorithm

SearchResult items are scored using a deterministic, explainable scoring formula:
```
score = (exactTitleMatch ? 50 : 0)
      + (titlePrefixMatch ? 40 : 0)
      + (titleSubstringMatch ? 30 : 0)
      + (contentSubstringMatch ? 20 : 0)
      + (recencyScore ? 10 : 0)
```

---

## 3. Performance & 10,000 Scale Safeguards

- **Bounded Page Results**: Maximum 20 results returned per query category.
- **Bounded Suggestions**: Maximum 10 suggestion items shown in popover.
- **Debounced Input**: 300ms input debounce prevents rapid Firestore queries.
- **In-Memory Cache**: Up to 50 query cache keys held in memory.
- **Client-Side Recent Searches**: Stored in `localStorage` (max 10 items). Privacy-safe analytics logs only `search_submitted` with count (no raw text).

---

## 4. Privacy & Security Rules

- **Direct Messages**: NEVER globally searchable.
- **Saved Messages**: Private per user, excluded from global search.
- **Private Incident Reports**: Excluded from global student search.
- **Blocked Users**: Privacy rules prevent discovery of blocked user records.
- **Deleted/Hidden Content**: Excluded via strict `status == 'active'` queries.
