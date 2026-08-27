# Unified Notification Center & Smart Notification Preferences

**Project**: College Times / AKGEC Times  
**Phase**: Phase 25 — Unified Campus Alerts, Smart Notification Preferences & Notification Center  
**Target Concurrency**: 10,000+ Concurrent Campus Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. ARCHITECTURE OVERVIEW

Phase 25 unifies personal notifications, chat @mentions, social interactions, campus events, and emergency alerts into a single, scalable Notification Center (`/notifications`) and user Preference Control Panel (`/settings/notifications`).

$$\begin{matrix}
\text{\textbf{Personal Events}} & \rightarrow & \text{Targeted Firestore Doc} & \rightarrow & \text{Notification Center (/notifications)} \\
\text{\textbf{Campus Broadcasts}} & \rightarrow & \text{1 FCM Topic ('campus\_all')} & \rightarrow & \text{0 Per-User Writes (Bounded Listener)}
\end{matrix}$$

> **[!IMPORTANT]**
> **Zero 10,000-Document Notification Fan-Out Writes**:  
> Campus alerts write **1 canonical document** (`campusBroadcasts/{incidentId}`) and dispatch **1 FCM topic publish operation**.  
> Personal targeted notifications (mentions, replies, likes, comments) write **only to legitimate recipients** ($1 \text{ recipient} = 1 \text{ write}$).

---

## 2. NOTIFICATION DATA MODEL (`notifications/{notificationId}`)

```ts
export interface NotificationItem {
  id: string;
  recipientId: string;
  type:
    | 'mention'
    | 'reply'
    | 'reaction'
    | 'post_like'
    | 'post_comment'
    | 'event_created'
    | 'event_reminder'
    | 'event_rsvp'
    | 'lost_found'
    | 'campus_incident'
    | 'admin_broadcast'
    | 'chat_activity'
    | 'system';
  title?: string;
  message: string;
  read: boolean;
  createdAt: Timestamp;
  channelId?: string;
  messageId?: string;
  postId?: string;
  eventId?: string;
  incidentId?: string;
  actorId?: string;
  actorName?: string;
  severity?: 'low' | 'moderate' | 'high' | 'critical';
  deepLink?: string;
}
```

---

## 3. USER NOTIFICATION PREFERENCES (`users/{uid}/notificationPreferences/settings`)

```ts
export interface UserNotificationPreferences {
  pushEnabled: boolean;
  chatMentions: boolean;
  chatActivity: boolean;
  postInteractions: boolean;
  eventUpdates: boolean;
  lostFoundUpdates: boolean;
  campusAlerts: boolean; // Mandatory for safety
  adminAnnouncements: boolean;
}
```

> **[!NOTE]**
> **Critical Campus Safety Alerts**:  
> `campusAlerts` is enforced as `true` across preference saves to guarantee student safety alert delivery.

---

## 4. UI COMPONENTS & ROUTES

- **`NotificationCenter.tsx`**: Unified notification list component with category tabs (`All`, `Unread`, `Mentions`, `Chat`, `Campus Alerts`, `Events`, `Social Activity`), cursor pagination (`limit: 20`), and batch mark-read controls.
- **`NotificationsPage.tsx`** (`/notifications`): Dedicated notification center page.
- **`NotificationSettings.tsx`** (`/settings/notifications`): Mobile-friendly preference configuration screen.
- **`Navbar.tsx`**: Updated navbar with unread notification badge indicator (`subscribeToUnreadCount`).

---

## 5. FIRESTORE & STORAGE SECURITY RULES

```rules
// User Notification Preferences Sub-collection: Private to user owner
match /notificationPreferences/{settingId} {
  allow read, create, update, delete: if isOwner(userId);
}

// Notifications Collection
match /notifications/{notificationId} {
  allow create: if isAuthenticated()
    && request.resource.data.keys().hasAll(['recipientId', 'message', 'read', 'timestamp']);
  allow read: if isAuthenticated() && resource.data.recipientId == request.auth.uid;
  allow update: if isAuthenticated() 
    && resource.data.recipientId == request.auth.uid 
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);
  allow delete: if false;
}
```

---

## 6. LOAD SIMULATION RESULTS

Executed `node scripts/loadTestUnifiedNotifications.js`:
- **Simulated Campus Members**: 10,000
- **Campus Alert Broadcast FCM Topic Publishes**: 1 (`campus_all`)
- **Campus Alert Per-User Firestore Writes**: 0 (100% Bounded)
- **Cursor Pagination Limit**: 20 (Capped at max 50)
- **Unread Counter Listener**: Bounded to `limit(10)`
- **Security Rule Enforcements**: 100% PASS
