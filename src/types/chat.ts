import type { Timestamp, FieldValue, QueryDocumentSnapshot } from 'firebase/firestore';

export type ChannelCategory = 'general' | 'academic' | 'events' | 'clubs' | 'group';
export type ChannelType = 'public' | 'announcement' | 'group';

export interface Channel {
  id?: string;
  name: string;
  description: string;
  category: ChannelCategory;
  type: ChannelType;
  groupId?: string;
  createdAt: Timestamp | FieldValue | any;
  createdBy: string;
  memberCount: number;
  lastMessageAt?: Timestamp | FieldValue | any;
  lastMessagePreview?: string;
  lastMessageId?: string;
  isArchived?: boolean;
  topic?: string;
}

export interface GroupChatReadState {
  groupId: string;
  lastReadMessageId: string;
  lastReadAt: Timestamp | FieldValue | any;
  isMuted?: boolean;
  updatedAt: Timestamp | FieldValue | any;
}

export interface ChannelReadState {
  channelId: string;
  lastReadMessageId: string;
  lastReadAt: Timestamp | FieldValue | any;
  updatedAt: Timestamp | FieldValue | any;
}

export interface ChatFileAttachment {
  type: 'file';
  name: string;
  size: number;
  mimeType: string;
  storagePath: string;
  downloadUrl: string;
}

export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 Minutes

export interface ChatMessage {
  id?: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderRole: 'student' | 'admin';
  senderAvatar?: string;
  content: string;
  imageUrl?: string;
  mediaUrl?: string;
  attachment?: ChatFileAttachment;
  replyToMessageId?: string;
  replyToSnippet?: string;
  mentionedUids?: string[];
  reactionCounts?: Record<string, number>;
  reportCount?: number;
  status: 'active' | 'deleted' | 'hidden';
  createdAt: Timestamp | FieldValue | any;
  updatedAt?: Timestamp | FieldValue | any;
  editedAt?: Timestamp | FieldValue | any;
  deletedAt?: Timestamp | FieldValue | any;
  deletedBy?: string;
}

export interface SavedChatMessage {
  messageId: string;
  channelId: string;
  savedAt: Timestamp | FieldValue | any;
  senderId: string;
  senderName: string;
  messageType: 'text' | 'image' | 'file';
  previewText: string;
}

export interface ChatNotificationPreferences {
  channelId: string;
  muted: boolean;
  muteUntil?: Timestamp | FieldValue | any;
  notifyMessages: boolean;
  notifyMentions: boolean;
  notifyReplies: boolean;
  notifyReactions: boolean;
  updatedAt?: Timestamp | FieldValue | any;
}

export const DEFAULT_CHAT_NOTIFICATION_PREFERENCES = {
  muted: false,
  notifyMessages: true,
  notifyMentions: true,
  notifyReplies: true,
  notifyReactions: false,
};

export interface ChannelMember {
  channelId: string;
  userId: string;
  role: 'member' | 'moderator' | 'admin';
  joinedAt: Timestamp | FieldValue | any;
  lastReadAt?: Timestamp | FieldValue | any;
  muted?: boolean;
}

export interface TypingUser {
  userId: string;
  displayName: string;
  timestamp: any;
}

export interface MentionNotificationPayload {
  messageId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  snippet: string;
}

export interface ChannelChatCache {
  messages: ChatMessage[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
  lastLoadedAt: number;
}

export const MAX_CACHED_MESSAGES_PER_CHANNEL = 200;
