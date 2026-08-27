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
  departmentId?: string;
  batchYear?: number;
  iconUrl?: string;
  memberCount: number;
  active: boolean;
  createdBy: string;
  createdAt: Timestamp | FieldValue | any;
  updatedAt: Timestamp | FieldValue | any;
  chatChannelId?: string;
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
