import type { Timestamp, FieldValue } from 'firebase/firestore';

export type NotificationCategory =
  | 'all'
  | 'unread'
  | 'mentions'
  | 'social'
  | 'groups'
  | 'messages'
  | 'events'
  | 'opportunities'
  | 'marketplace'
  | 'feed'
  | 'system'
  | 'security'
  | 'emergency'
  // Legacy compatibility mapping
  | 'chat'
  | 'alerts'
  | 'group_chat'
  | 'moments'
  | 'polls'
  | 'announcements'
  | 'moderation'
  | 'membership';

export type NotificationType =
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
  | 'marketplace_interest'
  | 'marketplace_offer_received'
  | 'marketplace_offer_accepted'
  | 'marketplace_offer_rejected'
  | 'opportunity_deadline_reminder'
  | 'system'
  | 'group_mention'
  | 'group_reply'
  | 'group_chat_message'
  | 'moment_created'
  | 'moment_comment'
  | 'moment_reaction'
  | 'poll_created'
  | 'poll_result'
  | 'group_announcement'
  | 'join_request'
  | 'membership_change'
  | 'group_moderation'
  | 'group_invite';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export interface ActionablePayload {
  actionType: 'group_join' | 'event_rsvp' | 'marketplace_offer' | 'dm_request';
  entityId: string;
  status?: 'pending' | 'accepted' | 'declined';
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  type: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  groupId?: string;
  groupName?: string;
  title?: string;
  message: string;
  read: boolean;
  createdAt: Timestamp | FieldValue | any;
  expiresAt?: Timestamp | FieldValue | any;
  channelId?: string;
  messageId?: string;
  postId?: string;
  eventId?: string;
  incidentId?: string;
  actorId?: string;
  actorName?: string;
  actorAvatar?: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  deepLink?: string;
  actionable?: ActionablePayload;
  groupKey?: string;
  groupCount?: number;
}

export interface QuietHoursConfig {
  enabled: boolean;
  start: string; // e.g. "22:00"
  end: string;   // e.g. "07:00"
}

export interface UserNotificationPreferences {
  pushEnabled: boolean;
  social: boolean;
  messages: boolean;
  groups: boolean;
  events: boolean;
  opportunities: boolean;
  marketplace: boolean;
  feed: boolean;
  system: boolean;
  chatMentions: boolean;
  chatActivity: boolean;
  postInteractions: boolean;
  eventUpdates: boolean;
  lostFoundUpdates: boolean;
  adminAnnouncements: boolean;
  campusAlerts: boolean;
  quietHours?: QuietHoursConfig;
  digestMode?: 'immediate' | 'hourly' | 'daily';
  updatedAt?: Timestamp | FieldValue | any;
}

export const DEFAULT_USER_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  pushEnabled: true,
  social: true,
  messages: true,
  groups: true,
  events: true,
  opportunities: true,
  marketplace: true,
  feed: true,
  system: true,
  chatMentions: true,
  chatActivity: true,
  postInteractions: true,
  eventUpdates: true,
  lostFoundUpdates: true,
  adminAnnouncements: true,
  campusAlerts: true,
  quietHours: { enabled: false, start: '22:00', end: '07:00' },
  digestMode: 'immediate',
};
