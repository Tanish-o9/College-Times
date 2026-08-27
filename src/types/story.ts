export type StoryAudience = 'campus' | 'group' | 'close_friends';
export type StoryMediaType = 'image' | 'text';
export type StoryStatus = 'active' | 'deleted' | 'expired';

export interface Story {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  mediaType: StoryMediaType;
  mediaUrl?: string;
  storagePath?: string;
  text?: string;
  backgroundStyle?: string;
  audience: StoryAudience;
  groupId?: string;
  status: StoryStatus;
  createdAt: any;
  expiresAt: any;
  viewCount?: number;
  reactionCount?: number;
  replyCount?: number;
}

export interface StoryView {
  userId: string;
  userName?: string;
  userAvatar?: string;
  viewedAt: any;
}

export interface StoryReaction {
  userId: string;
  reactionType: string;
  createdAt: any;
}

export interface GroupedAuthorStories {
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  stories: Story[];
  hasUnseen: boolean;
}
