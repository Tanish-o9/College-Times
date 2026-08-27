# Phase 44 — Realtime Listener Audit Inventory

| Module | Component | Query Path | Bounded Limit | Cleanup Lifecycle |
|---|---|---|---|---|
| **Group Chat** | `ChatRoom.tsx` | `channels/group-{groupId}/messages` | `limit(50)` | Unsubscribed on component unmount |
| **Direct Messaging** | `DirectMessageRoom.tsx` | `directMessages/{conversationId}/messages` | `limit(50)` | Unsubscribed on component unmount |
| **Group Activity** | `RealtimeGroupActivity.tsx` | `groups/{groupId}/activity` | `limit(10)` | Unsubscribed on component unmount |
| **Unified Notifications** | `Navbar.tsx` | `users/{uid}/notifications` | `limit(10)` | Unsubscribed on component unmount |
| **Group Instants** | `GroupInstantCarousel.tsx` | `groups/{groupId}/instants` | `limit(20)` | Unsubscribed on component unmount |
| **Campus Incidents** | `ActiveIncidentStrip.tsx` | `incidents` (active) | `limit(5)` | Unsubscribed on component unmount |

## Verification
- Every `onSnapshot` listener specifies an explicit `limit()`.
- Component `useEffect` return functions invoke `unsubscribe()` to prevent memory leaks or zombie listeners.
