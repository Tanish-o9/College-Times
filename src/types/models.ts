import type { Timestamp, FieldValue } from 'firebase/firestore';

export interface User {
  uid: string;
  displayName: string;
  phone?: string;
  email?: string;
  photoURL?: string;
  role: 'student' | 'admin';
  points: number;
  joinedChannelIds?: string[];
  departmentId?: string;
  batchYear?: number;
  createdAt: Timestamp | FieldValue;
  lastLoginAt?: Timestamp | FieldValue;
}

export type AudienceType = 'campus' | 'channel' | 'department' | 'batch' | 'custom';
export type PostPriority = 'normal' | 'important' | 'emergency';

export interface PostAudience {
  type: AudienceType;
  channelId?: string;
  departmentId?: string;
  batchId?: string;
  audienceId?: string;
}

export interface NotificationPolicy {
  enabled: boolean;
  priority: PostPriority;
  notifyMentions: boolean;
  notifyReplies: boolean;
  notifyReactions: boolean;
}

export interface CampusNotificationPreferences {
  enabled: boolean;
  importantEnabled: boolean;
  emergencyEnabled: boolean;
  mentionsEnabled: boolean;
  repliesEnabled: boolean;
  reactionsEnabled: boolean;
  updatedAt?: Timestamp | FieldValue | any;
}

export const DEFAULT_CAMPUS_NOTIFICATION_PREFERENCES: CampusNotificationPreferences = {
  enabled: true,
  importantEnabled: true,
  emergencyEnabled: true,
  mentionsEnabled: true,
  repliesEnabled: true,
  reactionsEnabled: false,
};

export interface PostImageItem {
  storagePath: string;
  downloadUrl: string;
  width?: number;
  height?: number;
}

export interface Post {
  id?: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  category: 'Mishap' | 'Event' | 'General' | 'LostFound';
  timestamp: any;
  likeCount: number;
  commentCount: number;
  imageUrl?: string;
  images?: PostImageItem[];
  postType: 'news' | 'lost' | 'found';
  status: 'resolved' | 'active' | 'deleted' | 'hidden';
  reportCount: number;
  contactInfo?: string;
  location?: string;
  eventId?: string;
  incidentId?: string;
  isOfficial?: boolean;
  isImportant?: boolean;
  trendingScore?: number;
  savesCount?: number;
  sharesCount?: number;
  isEdited?: boolean;
  editedAt?: any;
  groupId?: string;
  poll?: any;
  reactionCounts?: Record<string, number>;
  audience?: PostAudience;
  priority?: PostPriority;
  notificationPolicy?: NotificationPolicy;
  savedCount?: number;
}

export interface Comment {
  id?: string;
  postId: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: any;
}

export interface Notification {
  id?: string;
  recipientId: string;
  message: string;
  type?: 'mention' | 'reply' | 'reaction' | 'system';
  relatedPostId?: string;
  channelId?: string;
  messageId?: string;
  actorName?: string;
  read: boolean;
  timestamp: any;
}

export interface CampusEvent {
  id?: string;
  title: string;
  description: string;
  location: string;
  eventDate: any;
  createdBy: string;
  rsvpCount: number;
  createdAt?: any;
}

export interface Report {
  id?: string;
  postId: string;
  reporterId: string;
  reason: string;
  timestamp: any;
}
