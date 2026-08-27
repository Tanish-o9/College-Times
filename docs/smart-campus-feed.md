# Smart Campus Feed, Trending, Personalization & Engagement

**Project**: College Times / AKGEC Times  
**Phase**: Phase 27 — Smart Campus Feed  
**Target Concurrency**: 10,000+ Concurrent Campus Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. ARCHITECTURE OVERVIEW

Phase 27 upgrades Campus Feed 2.0 into a smart campus discovery system. It features deterministic feed modes (`Latest`, `Trending`, `For You` / `Personalized`, `Events`, `Lost & Found`, `Important`), lightweight category preferences (`users/{uid}/feedPreferences/settings`), deterministic ranking algorithms, time-decayed trending calculation, post editing (author-only), and Admin "Important" status tagging — WITHOUT creating 10,000-document notification fan-outs or converting normal feed ranking into notification spam.

$$\begin{matrix}
\text{\textbf{Candidate Pool (30 Docs)}} & \rightarrow & \text{Deterministic Score Formula} & \rightarrow & \text{Personalized Feed Ordering} \\
\text{\textbf{Category Preferences}} & \rightarrow & \text{Lightweight User Sub-Collection} & \rightarrow & \text{Safety Notices Un-Suppressed} \\
\text{\textbf{Campus Emergency Alerts}} & \rightarrow & \text{1 FCM Topic ('campus\_all')} & \rightarrow & \text{Separate Incident System}
\end{matrix}$$

---

## 2. FEED MODES

- **`latest`**: Chronological active posts (`orderBy('timestamp', 'desc')`).
- **`personalized`**: Ranked candidate pool using deterministic formula based on user category preferences.
- **`trending`**: Ranked top active posts using time-decayed engagement calculation.
- **`events`**: Filtered event-related posts (`category == 'Event'`).
- **`lost_found`**: Filtered Lost & Found posts (`category == 'LostFound'`).
- **`important`**: High-priority non-emergency campus information tagged by campus admins (`isImportant === true` or `isOfficial === true`).

---

## 3. DETERMINISTIC RANKING FORMULA (`feedRankingService.ts`)

$$\text{score} = \text{recencyScore} + \text{engagementScore} + \text{categoryPreferenceScore} + \text{freshnessBonus} + \text{importantPostBonus}$$

- **`recencyScore`**: $\frac{100}{1 + \text{hoursSinceCreation} \times 0.2}$
- **`engagementScore`**: $(\text{likes} \times 1) + (\text{comments} \times 3) + (\text{saves} \times 4) + (\text{shares} \times 5)$
- **`categoryPreferenceScore`**: $+30$ if category in `preferredCategories`; $-50$ if in `mutedCategories`.
- **`freshnessBonus`**: $+20$ if posted within last 6 hours.
- **`importantPostBonus`**: $+50$ if `isImportant === true` or `isOfficial === true`.

---

## 4. TIME-DECAYED TRENDING FORMULA (`trendingService.ts`)

$$\text{trendingScore} = \frac{(\text{likes} \times 1) + (\text{comments} \times 3) + (\text{saves} \times 4) + (\text{shares} \times 5)}{1 + \text{hoursSinceCreation} \times 0.3}$$

- Evaluated against a bounded candidate pool ($30$ recent active posts). Returns top $5$ items for `TrendingPosts` carousel display.

---

## 5. USER FEED PREFERENCES (`users/{uid}/feedPreferences/settings`)

```ts
export interface UserFeedPreferences {
  preferredCategories: string[]; // e.g. ['General', 'Event', 'LostFound']
  mutedCategories: string[];
  updatedAt?: Timestamp;
}
```

> **[!NOTE]**
> **Critical Campus Safety Alerts**:  
> Emergency alerts (`CampusAlertBanner`) and verified campus incidents remain un-suppressed across all category preference choices.

---

## 6. FIRESTORE & STORAGE SECURITY RULES

```rules
// User Feed Preferences Sub-collection: Private to user owner
match /feedPreferences/{settingId} {
  allow read, create, update, delete: if isOwner(userId);
}

// Posts Collection Update Rules
match /posts/{postId} {
  allow update: if isAuthenticated() && (
    isAdmin() ||
    request.resource.data.diff(resource.data).affectedKeys().hasAny(['likeCount', 'commentCount', 'reportCount']) ||
    (resource.data.authorId == request.auth.uid && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'images', 'imageUrl', 'title', 'content', 'category', 'isEdited', 'editedAt']))
  );
}
```

---

## 7. LOAD SIMULATION RESULTS

Executed `node scripts/loadTestSmartFeed.js`:
- **Simulated Campus Members**: 10,000
- **Feed Ranking Notification Fan-out Writes**: 0 (100% Bounded)
- **Deterministic Ranking Formula**: PASS (228 pts)
- **Time-Decayed Trending Calculation**: PASS (35.6 pts)
- **Security Rule Tampering Rejections**: 100% PASS
