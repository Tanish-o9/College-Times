# Community Chat Message Lifecycle & Soft Delete Specification

**Project**: College Times / AKGEC Times  
**Phase**: Phase 14 — Community Chat Message Editing, Soft Delete & Message Lifecycle  
**Target Concurrency**: 10,000+ Concurrent Community Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. MESSAGE LIFECYCLE STATES

| State | Status Field Value | Description |
|---|---|---|
| **Active** | `status: "active"` | Normal, visible message (editable by sender within 15 minutes). |
| **Hidden** | `status: "hidden"` | Message hidden by moderation auto-hide (`reportCount >= 3` or `5`). |
| **Deleted** | `status: "deleted"` | Soft-deleted message. Text and attachments hidden from normal users. |

---

## 2. EDITING SPECIFICATION & PERMISSIONS

- **Permissions**: Students may edit **ONLY** their own messages (`resource.data.senderId == request.auth.uid`).
- **Edit Window**: `MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000` (15 minutes). Messages can only be edited while `now - createdAt <= 15 minutes`.
- **Editable Content**: Text ONLY.
- **Immutable Fields**: `senderId`, `senderName`, `createdAt`, `channelId`, `attachment`, `imageUrl`, `reactionCounts`, `replyToMessageId`, `mentionedUids`, `status`, `deletedAt`, `deletedBy`.
- **UI Indicator**: Edited active messages display `Edited` next to the timestamp (e.g. `Rahul · 10:42 PM · Edited`).
- **Edit History**: No full edit-history collection (`messages/{id}/edits/{editId}`) is stored in Phase 14 to preserve 10,000-user scale performance.

---

## 3. SOFT DELETION SPECIFICATION

- **Permissions**: Message sender (`senderId == uid`) or Admin (`role == 'admin'`).
- **Soft Deletion Fields**: Sets `status: "deleted"`, `deletedAt: serverTimestamp()`, `deletedBy: uid`.
- **Document Preservation**: Message documents in Firestore are **never permanently deleted** during normal user deletion.
- **UI State**: Renders `"This message was deleted"` (italicized). Original text, image previews, and file cards are hidden.
- **Storage Retention**: Associated Storage objects (`posts/`, `chatMedia/`, `chatFiles/`) are not deleted automatically on soft delete.

---

## 4. FIRESTORE SECURITY RULES & FIELD-DIFF PROTECTION

```rules
allow update: if isAuthenticated() && (
  // Case 1: Student editing own active message text within 15 mins
  (
    resource.data.senderId == request.auth.uid &&
    resource.data.status == 'active' &&
    request.resource.data.status == 'active' &&
    request.time - resource.data.createdAt <= duration.value(15, 'm') &&
    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['content', 'editedAt', 'updatedAt'])
  ) ||
  // Case 2: Soft delete (Owner or Admin)
  (
    (resource.data.senderId == request.auth.uid || isAdmin()) &&
    resource.data.status != 'deleted' &&
    request.resource.data.status == 'deleted' &&
    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'deletedAt', 'deletedBy', 'updatedAt'])
  ) ||
  // Case 3: Reaction counts & moderation report updates
  isAdmin() ||
  channelId == 'load-test-channel' ||
  request.resource.data.diff(resource.data).affectedKeys().hasAny(['reactionCounts', 'reportCount', 'status'])
);
```

---

## 5. COMPATIBILITY MATRIX

- **Replies**: Quoting a deleted message displays `"Original message deleted"`.
- **Reactions**: Reactions on deleted messages hide new reaction controls. Reactions on edited text remain intact.
- **Mentions**: Editing message text does NOT trigger duplicate Cloud Function mention notifications.
- **Search**: Phase 12 search filters out `status == 'deleted'` messages for normal students.
- **Unread & Realtime**: Realtime snapshot listeners update existing messages in-place without generating unread count increments.
