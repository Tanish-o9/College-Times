# Phase 43 — Campus Social Hub, Real-Time Engagement & Group Intelligence 2.0

## Overview
Phase 43 transforms the Campus Group experience into a complete production-grade Campus Social Hub integrating:
- **Group Home Dashboard** (`GroupHomeDashboard.tsx`): Overview, header, quick action cards, latest content previews, pinned content, and recent activity.
- **Unified Group Navigation** (`GroupDetailPage.tsx`): Seamless tab navigation (`Overview`, `Announcements`, `Members`, `Polls`, `Activity`, `Leaderboard`, `Search`, `Invites`) with query parameter deep links.
- **Bounded Real-Time Group Activity** (`RealtimeGroupActivity.tsx`): Bounded realtime listener (`limit(10)`) rendering a non-intrusive "New activity available" toast indicator.
- **Group Announcements & FCM Topic Broadcast** (`GroupAnnouncements.tsx`, `CreateAnnouncementModal.tsx`): Priority announcements (`normal`, `important`, `urgent`). Urgent announcements send 1 FCM topic broadcast to `group_{groupId}` with 0 per-user notification writes.
- **Member Discovery Explorer** (`GroupMembersExplorer.tsx`): Paginated roster (bounded max 50) with role filters, search, and direct "Message" trigger via DM architecture.
- **Community Engagement Leaderboard** (`GroupLeaderboard.tsx`): Non-sensitive engagement stats (`Top Contributors`, `Top Creators`) using bounded query limits.
- **Group Notification Digest Service** (`groupNotificationDigestService.ts`): Aggregates grouped presentation summaries (e.g. "5 new activities in CSE Community") without per-user notification fan-out writes.
- **Quick Share to Group Chat** (`QuickShareModal.tsx`): Share posts, moments, polls, events, and announcements directly to group chat with structured reference cards.
- **Group Content Search** (`GroupSearchTab.tsx`): Group-scoped search filtering posts, moments, polls, events, announcements, and members (bounded max 20 results per category).

---

## 1. Unified Navigation Tabs & Deep Links

- **URL Format**: `/groups/{groupId}?tab={tabName}`
- **Supported Tabs**: `overview`, `announcements`, `members`, `polls`, `activity`, `leaderboard`, `search`, `invites`
- **Security Guard**: Private group non-members receive an interactive pass code gate blocking access to member roster and discussions.

---

## 2. Urgent Announcements & Zero Notification Fan-out

- **Urgent Announcement Flow**: Group Owner/Admin creates an urgent announcement.
- **Broadcast Strategy**: Cloud Function publishes 1 FCM message to topic `group_{groupId}`.
- **Firestore Writes**: **0 per-user notification documents created**.

---

## 3. Performance & 10K Scalability Bounds

- **Member Pagination**: Maximum page size of 50 members (`getGroupMembersPage`).
- **Activity Listener**: Bounded snapshot listener (`limit(10)`).
- **Search Bounds**: Bounded candidate query limit of max 20 results per category.
- **Leaderboard Bounds**: Bounded query limit of max 10 top members.
