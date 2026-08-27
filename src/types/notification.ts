import type { Timestamp, FieldValue } from 'firebase/firestore';

export type NotificationCategory =
  | 'all'
  | 'unread'
  | 'mentions'
  | 'chat'
  | 'alerts'
  | 'events'
  | 'social';

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
  | 'system';

export interface NotificationItem {
  id: string;
  recipientId: string;
  type: NotificationType;
  title?: string;
  message: string;
  read: boolean;
  createdAt: Timestamp | FieldValue | any;
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

export interface UserNotificationPreferences {
  pushEnabled: boolean;
  chatMentions: boolean;
  chatActivity: boolean;
  postInteractions: boolean;
  eventUpdates: boolean;
  lostFoundUpdates: boolean;
  campusAlerts: boolean; // Mandatory for critical safety
  adminAnnouncements: boolean;
  updatedAt?: Timestamp | FieldValue | any;
}

export const DEFAULT_USER_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  pushEnabled: true,
  chatMentions: true,
  chatActivity: true,
  postInteractions: true,
  eventUpdates: true,
  lostFoundUpdates: true,
  campusAlerts: true,
  adminAnnouncements: true,
};
