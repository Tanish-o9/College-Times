import type { Timestamp, FieldValue } from 'firebase/firestore';

export type CampusGroupType = 'campus' | 'department' | 'batch' | 'community';
export type CampusGroupVisibility = 'public' | 'private';

export interface CampusGroup {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: CampusGroupType;
  visibility: CampusGroupVisibility;
  category?: string;
  rules?: string;
  departmentId?: string;
  batchYear?: number;
  iconUrl?: string;
  memberCount: number;
  active: boolean;
  createdBy: string;
  createdAt: Timestamp | FieldValue | any;
  updatedAt: Timestamp | FieldValue | any;
  chatChannelId?: string;

  // Phase 32: Invite Pass System fields
  inviteCodeHash?: string;
  inviteCodeVersion?: number;
  inviteEnabled?: boolean;
  inviteCodePlaintext?: string;
}

export type GroupRole = 'owner' | 'admin' | 'moderator' | 'member';
export type GroupMemberStatus = 'active' | 'pending' | 'banned' | 'removed';

export interface GroupMember {
  uid: string;
  role: GroupRole;
  status?: GroupMemberStatus;
  joinedAt: Timestamp | FieldValue | any;
  displayName?: string;
  photoURL?: string;
}

export interface UserGroupMembership {
  groupId: string;
  joinedAt: Timestamp | FieldValue | any;
}

export interface GroupInviteCodeDoc {
  code: string;
  groupId: string;
  active: boolean;
  createdAt: Timestamp | FieldValue | any;
  createdBy: string;
}

// Phase 34 & 36A: Permanent Group Instant / Moments Experience Data Models
export interface GroupInstantMedia {
  id?: string;
  mediaId: string;
  instantId: string;
  groupId: string;
  ownerId: string;
  storagePath: string;
  downloadUrl: string;
  mimeType: string;
  width?: number;
  height?: number;
  fileSize: number;
  order: number;
  createdAt: Timestamp | FieldValue | any;
}

export interface GroupInstant {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  type: 'text' | 'image' | 'video';
  media: string[]; // Legacy fallback image URLs
  mediaCount?: number; // Total scalable media items in subcollection
  caption?: string;
  createdAt: Timestamp | FieldValue | any;
  expiresAt?: Timestamp | FieldValue | any; // Optional for backward compatibility
  status: 'active' | 'expired' | 'deleted' | 'hidden';
  reactionCounts?: Record<string, number>;
  replyCount?: number;
  commentCount?: number;
  saveCount?: number;
  shareCount?: number;
}

export interface GroupInstantComment {
  id?: string;
  commentId?: string;
  instantId: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: Timestamp | FieldValue | any;
  updatedAt?: Timestamp | FieldValue | any;
  status: 'active' | 'deleted';
  replyToCommentId?: string;
}

export interface SavedGroupMoment {
  instantId: string;
  groupId: string;
  savedAt: Timestamp | FieldValue | any;
}

export interface GroupInstantReadState {
  groupId: string;
  lastSeenInstantAt: Timestamp | FieldValue | any;
  lastSeenInstantId: string;
  updatedAt: Timestamp | FieldValue | any;
}

export interface GroupNotificationPreferences {
  groupId: string;
  instantsEnabled: boolean;
  chatEnabled: boolean;
  mentionsEnabled: boolean;
  updatedAt: Timestamp | FieldValue | any;
}

// Phase 35: Advanced Group Management Data Models
export interface GroupJoinRequest {
  id?: string;
  userId: string;
  userName: string;
  avatar?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp | FieldValue | any;
  reviewedAt?: Timestamp | FieldValue | any;
  reviewedBy?: string;
}

export interface GroupAnnouncement {
  id?: string;
  groupId: string;
  title: string;
  content: string;
  createdBy: string;
  creatorName: string;
  createdAt: Timestamp | FieldValue | any;
  updatedAt?: Timestamp | FieldValue | any;
  pinned: boolean;
  status: 'active' | 'deleted';
}

export interface GroupMemberReport {
  id?: string;
  groupId: string;
  reporterId: string;
  targetUserId: string;
  targetUserName?: string;
  reason: 'spam' | 'harassment' | 'inappropriate' | 'impersonation' | 'abuse' | 'other';
  description?: string;
  createdAt: Timestamp | FieldValue | any;
  status: 'pending' | 'reviewed' | 'dismissed';
}

export interface GroupAuditLog {
  id?: string;
  groupId: string;
  action:
    | 'member_joined'
    | 'member_removed'
    | 'member_banned'
    | 'role_changed'
    | 'announcement_created'
    | 'announcement_deleted'
    | 'post_moderated'
    | 'instant_moderated'
    | 'group_settings_changed'
    | 'invite_regenerated'
    | 'ownership_transferred'
    | 'group_archived';
  actorId: string;
  actorName: string;
  details: string;
  timestamp: Timestamp | FieldValue | any;
}
