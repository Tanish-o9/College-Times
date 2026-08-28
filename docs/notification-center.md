# Unified Notification Center

Centralized notification dispatch and settings hub for College Times.

## Data Model

Unified collection path: `/notifications/{notificationId}`

### Fields

*   `id` (string): Unique notification identifier.
*   `recipientId` (string): Target user UID.
*   `actorId` (string): Initiating user UID.
*   `actorName` (string): Initiating user name.
*   `actorAvatar` (string): Initiating user photo URL.
*   `type` (string): Notification taxonomy subcategory (e.g. `reaction`, `reply`, `join_request`).
*   `category` (string): Parent taxonomy group (e.g. `social`, `groups`, `messages`, `system`).
*   `priority` (string): Rank classification (`low`, `normal`, `high`, `critical`).
*   `body` (string): Message description text.
*   `isRead` (boolean): Unread tracking status.
*   `createdAt` (timestamp): Generation moment.

## Scalability & Fan-Out Guardrails

1.  **Group Chats**: Normal chat messages produce **0 per-user Firestore writes**. Notifications are handled via FCM topic subscriptions.
2.  **Emergency/Important Alerts**: Handled using FCM topic broadcasts to prevent bulk database writes.
3.  **Targeted Interactions**: Direct user interactions (comments, DMs, reactions) create a single notification document explicitly targeted at the affected recipient.
4.  **Quiet Hours**: Checks recipient preferences to suppress low/normal priority alerts during muted hours.
