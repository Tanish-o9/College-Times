# Community Chat File & Document Sharing Architecture Specification

**Project**: College Times / AKGEC Times  
**Phase**: Phase 13 — Community Chat File & Document Sharing  
**Target Concurrency**: 10,000+ Concurrent Community Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. SUPPORTED FILE TYPES & SIZE LIMITS

| Extension | MIME Type | Maximum Size |
|---|---|---|
| `.pdf` | `application/pdf` | 10 MB |
| `.doc` | `application/msword` | 10 MB |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 10 MB |
| `.xls` | `application/vnd.ms-excel` | 10 MB |
| `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | 10 MB |
| `.ppt` | `application/vnd.ms-powerpoint` | 10 MB |
| `.pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | 10 MB |
| `.txt` | `text/plain` | 10 MB |
| `.csv` | `text/csv` | 10 MB |
| `.zip` | `application/zip` | 10 MB |

> **[!CAUTION]**
> **Prohibited File Types**: Executable and script formats (`.exe`, `.bat`, `.cmd`, `.ps1`, `.js`, `.vbs`, `.scr`) are rejected by both client-side validation and server-side Firebase Storage rules.

---

## 2. FIREBASE STORAGE ARCHITECTURE

### Storage Path
`chatFiles/{channelId}/{userId}/{timestamp}_{cleanFileName}`

### Security & Access Control (`storage.rules`)
- **Authentication**: `request.auth != null && request.auth.uid == userId`.
- **Size Limit**: `request.resource.size <= 10 * 1024 * 1024` (10 MB).
- **MIME Allowlist**: Strictly enforced server-side.
- **Image Compatibility**: Phase 5 image path (`chatMedia/{channelId}/{userId}/...`) remains untouched.

---

## 3. FIRESTORE METADATA SCHEMA

Document file binary data is stored **exclusively in Firebase Storage**. Firestore stores attachment metadata only:

```ts
export interface ChatFileAttachment {
  type: 'file';
  name: string;
  size: number;
  mimeType: string;
  storagePath: string;
  downloadUrl: string;
}
```

Firestore security rules validate `attachment` map keys and size $\le 10,485,760$ bytes on `messages` creation.

---

## 4. ORPHAN FILE CLEANUP & DRAFT PRESERVATION

- **Orphan Cleanup**: If a document file is uploaded to Firebase Storage but message creation in Firestore fails, `deleteChatFile(storagePath)` automatically attempts to remove the uploaded object from Storage.
- **Draft Preservation**: Client input draft is preserved on error so users can retry without re-typing text.

---

## 5. UI COMPONENTS & ACCESSIBILITY

- **`MessageInput.tsx`**: Features a Paperclip button (📎), file picker with `accept` attribute, preview card with remove (`✕`) button, and real-time upload progress percentage (`uploadProgress`).
- **`MessageBubble.tsx`**: Displays file type icons (PDF, Sheet, Presentation, Archive, Text), formatted file size, and accessible `Open` action targeting `downloadUrl`.
- **Accessibility**: Keyboard focusable, aria labels (`aria-label="Attach file"`, `aria-label="Remove attachment"`, `aria-label="Open assignment.pdf"`).

---

## 6. COMPATIBILITY & REGRESSION

- **Phase 5 Images**: Preserved compressed upload pipeline.
- **Phase 6 Mentions & Cloud Functions**: Mention notification fan-out continues working on text + file messages.
- **Phase 8 Moderation & Rate Limiting**: Soft delete hides attachments; file messages enforce the 10 msgs / 30s rate limit.
- **Phase 11 Unread State**: File messages update read state and unread badges identically to text messages.
- **Phase 12 Search**: Displays `📄 filename` in search previews. Binary file content scanning is outside Phase 12 search scope.
