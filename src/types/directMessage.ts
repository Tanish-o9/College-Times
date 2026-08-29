export type ConversationStatus = 'pending' | 'active' | 'blocked' | 'declined';
export type DirectMessageType = 'text' | 'image' | 'video' | 'file';

export interface ParticipantMeta {
  muted?: boolean;
  archived?: boolean;
  lastReadMessageId?: string;
  lastReadAt?: any;
}

export interface DirectConversation {
  id: string; // Deterministic: [uidA, uidB].sort().join('_')
  participantIds: [string, string];
  participantNames?: Record<string, string>;
  participantAvatars?: Record<string, string>;
  lastMessageId?: string;
  lastMessagePreview?: string;
  lastMessageAt?: any;
  lastMessageSenderId?: string;
  createdAt: any;
  updatedAt?: any;
  status: ConversationStatus;
  blockedBy?: string;
  participantMeta?: Record<string, ParticipantMeta>;
  unreadCounts?: Record<string, number>;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  messageType: DirectMessageType;
  attachment?: {
    url: string;
    filename: string;
    size?: number;
    mimeType?: string;
  };
  replyToMessageId?: string;
  replyToPreview?: string;
  replyTo?: {
    messageId: string;
    senderId: string;
    preview: string;
  };
  forwardedFromMessageId?: string;
  forwardedFromConversationId?: string;
  originalSenderId?: string;
  isEdited?: boolean;
  reactionCounts?: Record<string, number>;
  status: 'active' | 'deleted';
  createdAt: any;
  updatedAt?: any;
  editedAt?: any;
  deletedAt?: any;
}

export interface DirectMessageReadState {
  conversationId: string;
  lastReadMessageId: string;
  lastReadAt: any;
}

export interface BlockedUser {
  blockedUid: string;
  blockedName?: string;
  createdAt: any;
}
