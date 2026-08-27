import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../lib/firebase';
import type { GroupMember } from '../types/group';
import { createNotification } from './notificationService';

/**
 * Searches group member suggestions when typing @ inside group posts/comments.
 * Bounded query (limit: 10).
 */
export const searchGroupMemberMentions = async (
  groupId: string,
  searchQuery: string,
  limitCount: number = 10
): Promise<GroupMember[]> => {
  if (!groupId || !searchQuery) return [];
  const cleanTerm = searchQuery.trim().toLowerCase();

  try {
    const membersRef = collection(db, 'groups', groupId, 'members');
    const q = query(membersRef, orderBy('joinedAt', 'desc'), limit(50));
    const snap = await getDocs(q);

    const matched = snap.docs
      .map((d) => ({ ...(d.data() as GroupMember), uid: d.id }))
      .filter((m) => {
        const name = (m.displayName || '').toLowerCase();
        return name.includes(cleanTerm) || m.uid.toLowerCase().includes(cleanTerm);
      });

    return matched.slice(0, Math.min(10, limitCount));
  } catch (err) {
    console.error(`Error searching member mentions for group ${groupId}:`, err);
    return [];
  }
};

/**
 * Dispatches targeted notifications to users mentioned with @uid in content.
 * Bounded to max 20 mentions per post/comment.
 */
export const dispatchPostMentions = async (
  content: string,
  postId: string,
  senderUser: FirebaseUser,
  targetMentionUids?: string[]
): Promise<void> => {
  if (!content || !senderUser) return;

  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
  const matches = new Set<string>(targetMentionUids || []);

  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    matches.add(match[1]);
    if (matches.size >= 20) break; // Hard cap at 20 mentions per post
  }

  const senderName = senderUser.displayName || 'Student';

  for (const recipientId of Array.from(matches)) {
    if (recipientId === senderUser.uid) continue;

    createNotification({
      recipientId,
      senderId: senderUser.uid,
      type: 'mention',
      title: 'Mentioned in Campus Post',
      message: `${senderName} mentioned you in a campus post.`,
      deepLink: `/?postId=${postId}`,
    }).catch(() => {});
  }
};
