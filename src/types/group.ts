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

export interface GroupMember {
  uid: string;
  role: 'member' | 'moderator' | 'admin';
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
