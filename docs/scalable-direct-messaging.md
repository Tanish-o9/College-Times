# Scalable Campus Direct Messaging, Private Conversations, Message Requests & Privacy

**Project**: College Times / AKGEC Times  
**Phase**: Phase 31 — Scalable Campus Direct Messaging  
**Target Concurrency**: 10,000+ Concurrent Campus Members  
**Status**: **IMPLEMENTED & VERIFIED**

---

## 1. ARCHITECTURE OVERVIEW

Phase 31 introduces scalable 1-on-1 private messaging separate from public community channels. Each 1-on-1 private conversation uses a deterministic conversation ID (`[uidA, uidB].sort().join('_')`), guaranteeing that messaging from User A to User B and User B to User A resolves to the exact same Firestore conversation document (`conversations/{conversationId}`).

$$\begin{matrix}
\text{\textbf{Participant A}} & \rightarrow & \text{Deterministic ID: sort([uidA, uidB]).join('\_')} & \leftarrow & \text{\textbf{Participant B}} \\
& & \downarrow & & \\
& & \text{\textbf{conversations/A\_B}} & & \\
& & \downarrow & & \\
& & \text{\textbf{conversations/A\_B/messages/msg123}} & & 
\end{matrix}$$

---

## 2. FIRESTORE CONVERSATION DATA MODEL (`conversations`)

```ts
export interface DirectConversation {
  id: string; // Deterministic: [uidA, uidB].sort().join('_')
  participantIds: [string, string];
  participantNames?: Record<string, string>;
  participantAvatars?: Record<string, string>;
  lastMessageId?: string;
  lastMessagePreview?: string;
  lastMessageAt?: Timestamp;
  lastMessageSenderId?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  status: 'pending' | 'active' | 'blocked' | 'declined';
  blockedBy?: string;
  participantMeta?: {
    [uid: string]: {
      muted?: boolean;
      archived?: boolean;
      lastReadMessageId?: string;
      lastReadAt?: Timestamp;
    };
  };
}
```

---

## 3. MESSAGE REQUEST & BLOCKING FLOW

- **Message Request (`pending`)**: Unsolicited first-time messages between non-connected users create a conversation in `'pending'` status. The recipient receives an actionable banner to `Accept`, `Decline`, or `Block`.
- **User Blocking (`blockedUsers/{blockedUid}`)**: When User A blocks User B, `users/A/blockedUsers/B` is recorded and conversation status changes to `'blocked'`. Neither user can send new DMs while blocked.

---

## 4. SECURITY & PRIVACY RULES

- **Conversation Read/Write**: Restricted to participants only (`request.auth.uid in resource.data.participantIds`).
- **Message Read/Write**: Only participants of the parent conversation can read or post messages. Sender impersonation is strictly rejected (`request.resource.data.senderId == request.auth.uid`).
- **Storage Security**: Media attachments stored in `dmMedia/{conversationId}/{userId}/{filename}` restricted to authenticated uploader and recipient.

---

## 5. LOAD SIMULATION RESULTS

Executed `node scripts/loadTestDirectMessaging.js`:
- **Simulated Users**: 10,000
- **Deterministic Conversation IDs**: PASS (100% Symmetric)
- **Notification Writes per DM**: 1 (Targeted, 0 Broadcast Fan-out)
- **Message Requests & Blocking**: PASS
- **Bounded 50-Message Pagination**: PASS
- **Non-Participant Access Rejection**: 100% PASS
