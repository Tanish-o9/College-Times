import { collection, query, limit, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { rankPostsPersonalized } from './feedRankingService';
import { getUserFeedPreferences } from './feedPreferenceService';
import { getUserGroupIds } from './groupService';
import { getFriends } from './friendService';
import { isUserBlocked } from './directMessageService';
import type { Post } from '../types/models';

/**
 * Fetches and ranks posts for the For You personalized feed.
 */
export const getForYouFeed = async (userId: string, pageSize: number = 20): Promise<Post[]> => {
  if (!userId) return [];
  try {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('timestamp', 'desc'), limit(100));
    const snap = await getDocs(q);
    let posts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));

    const [userDoc, friendsData, userGroupIds, feedPrefs] = await Promise.all([
      getDoc(doc(db, 'users', userId)),
      getFriends(userId, 100),
      getUserGroupIds(userId),
      getUserFeedPreferences(userId),
    ]);

    const userProfile = userDoc.exists() ? userDoc.data() : null;
    const friendsUids = friendsData.uids;
    const uniqueAuthorIds = Array.from(new Set(posts.map((p) => p.authorId)));
    
    const authorProfiles: Record<string, any> = {};
    const blockStatuses: Record<string, boolean> = {};

    await Promise.all(
      uniqueAuthorIds.map(async (authorId) => {
        if (authorId === userId) return;
        
        const blockedByMe = await isUserBlocked(userId, authorId);
        const blockedByThem = await isUserBlocked(authorId, userId);
        blockStatuses[authorId] = blockedByMe || blockedByThem;

        const aSnap = await getDoc(doc(db, 'users', authorId));
        if (aSnap.exists()) {
          authorProfiles[authorId] = aSnap.data();
        }
      })
    );

    posts = posts.filter((post) => {
      if (post.authorId === userId) return true;
      if (blockStatuses[post.authorId]) return false;

      const authorProfile = authorProfiles[post.authorId];
      if (authorProfile && authorProfile.profileStatus === 'suspended') return false;

      if (authorProfile && authorProfile.profileVisibility === 'private' && !friendsUids.includes(post.authorId)) {
        return false;
      }

      if ((post.audience as unknown as string) === 'friends' && !friendsUids.includes(post.authorId)) {
        return false;
      }

      return true;
    });

    const ranked = rankPostsPersonalized(
      posts,
      feedPrefs,
      userProfile as any,
      userGroupIds,
      friendsUids
    );

    return ranked.slice(0, pageSize);
  } catch (err) {
    console.error('Error fetching For You feed:', err);
    return [];
  }
};

/**
 * Fetches posts exclusively from followed creators/friends.
 */
export const getFollowingFeed = async (userId: string, pageSize: number = 20): Promise<Post[]> => {
  if (!userId) return [];
  try {
    const friendsData = await getFriends(userId, 100);
    const friendsUids = friendsData.uids;

    if (friendsUids.length === 0) return [];

    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('timestamp', 'desc'), limit(100));
    const snap = await getDocs(q);
    let posts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));

    posts = posts.filter((post) => friendsUids.includes(post.authorId));

    const uniqueAuthorIds = Array.from(new Set(posts.map((p) => p.authorId)));
    const blockStatuses: Record<string, boolean> = {};
    const authorProfiles: Record<string, any> = {};

    await Promise.all(
      uniqueAuthorIds.map(async (authorId) => {
        const blockedByMe = await isUserBlocked(userId, authorId);
        const blockedByThem = await isUserBlocked(authorId, userId);
        blockStatuses[authorId] = blockedByMe || blockedByThem;

        const aSnap = await getDoc(doc(db, 'users', authorId));
        if (aSnap.exists()) {
          authorProfiles[authorId] = aSnap.data();
        }
      })
    );

    posts = posts.filter((post) => {
      if (blockStatuses[post.authorId]) return false;
      const authorProfile = authorProfiles[post.authorId];
      if (authorProfile && authorProfile.profileStatus === 'suspended') return false;
      return true;
    });

    return posts.slice(0, pageSize);
  } catch (err) {
    console.error('Error fetching Following feed:', err);
    return [];
  }
};
