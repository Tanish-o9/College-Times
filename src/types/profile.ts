import type { Timestamp, FieldValue } from 'firebase/firestore';

export type ProfileVisibility = 'public' | 'private';
export type ProfileStatus = 'active' | 'restricted' | 'suspended';

export interface ProfilePrivacySettings {
  showPosts: boolean;
  showGroups: boolean;
  showEvents: boolean;
  showMoments: boolean;
  allowMessages: boolean;
  allowFollowRequests: boolean;
}

export interface UserProfile2 {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
  bio?: string;
  department?: string;
  batchYear?: number;
  skills?: string[];
  interests?: string[];
  followersCount: number;
  followingCount: number;
  profileVisibility: ProfileVisibility;
  profileStatus: ProfileStatus;
  privacySettings?: ProfilePrivacySettings;
  createdAt: Timestamp | FieldValue | any;
  updatedAt?: Timestamp | FieldValue | any;
}

export interface FollowRelationship {
  uid: string;
  targetUid: string;
  createdAt: Timestamp | FieldValue | any;
}

export interface FollowRequest {
  id?: string;
  requesterUid: string;
  requesterName?: string;
  requesterAvatar?: string;
  targetUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp | FieldValue | any;
}

export interface UsernameClaim {
  uid: string;
  username: string;
  createdAt: Timestamp | FieldValue | any;
}
