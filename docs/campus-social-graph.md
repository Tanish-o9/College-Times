# Phase 45 — Campus Profiles, Social Graph, Follow System & Connections

## Overview
Phase 45 introduces a production-grade Campus Social Graph supporting:
- **Campus Profile 2.0** (`ProfilePage.tsx`): Displays display name, unique `@username`, avatar, bio, department, batch year, followers/following stats, and public/private profile boundary guards.
- **Unique Username System** (`usernameService.ts`, `usernames/{username}`): Normalized 3–30 character unique handles (`a-z0-9_`) reserved transactionally.
- **Transaction-Safe Follow System** (`followService.ts`): Manages `users/{uid}/following/{targetUid}` and `users/{uid}/followers/{followerUid}` with transaction-safe counter updates and max 50 pagination bounds.
- **Connections Hub** (`ConnectionsPage.tsx`): Route `/connections` with `Following` and `Followers` tabs and search filters.
- **People Discovery** (`PeopleYouMayKnow.tsx`): Neutral "Suggested for You" recommendations based on department and mutual connections (bounded max 5 suggestions).
- **Security & Privacy Rules**: Private profiles require follow authorization before restricted content is exposed. Blocked users cannot follow or message each other.

---

## 1. Unique Username System

- **Collection Path**: `usernames/{username}`
- **Handle Validation**: Must match `/^[a-z0-9_]{3,30}$/`
- **Claim Transaction**: `claimUsername(uid, username)` executes a Firestore transaction creating `usernames/{username}` and updating `users/{uid}.username`.

---

## 2. Follow Architecture & Privacy Bounds

- **Following Path**: `users/{uid}/following/{targetUid}`
- **Followers Path**: `users/{uid}/followers/{followerUid}`
- **Follow Requests**: `users/{targetUid}/followRequests/{requesterUid}`
- **Targeted Notifications**: Follow actions produce 1 targeted notification write to recipient with zero broadcast fan-out.
- **Pagination Limit**: Bounded cursor pagination capped at max 50 items per query page.
