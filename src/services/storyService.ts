import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  increment, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, logAnalyticsEvent } from '../lib/firebase';
import type { 
  Story, 
  StoryAudience, 
  StoryMediaType, 
  StoryView, 
  GroupedAuthorStories 
} from '../types/story';
import { createNotification } from './notificationService';

/**
 * Creates a new 24-hour campus story.
 */
export const createStory = async (
  currentUser: FirebaseUser,
  params: {
    mediaType: StoryMediaType;
    text?: string;
    mediaUrl?: string;
    storagePath?: string;
    backgroundStyle?: string;
    audience?: StoryAudience;
    groupId?: string;
  }
): Promise<Story> => {
  if (!currentUser) throw new Error('Authentication required.');
  if (!params.text?.trim() && !params.mediaUrl) {
    throw new Error('Story must contain an image or text content.');
  }

  const nowMs = Date.now();
  const expiresAtMs = nowMs + 24 * 60 * 60 * 1000; // 24 Hours TTL

  const storyData: Record<string, any> = {
    authorId: currentUser.uid,
    authorName: currentUser.displayName || 'Campus Student',
    authorAvatar: currentUser.photoURL || undefined,
    mediaType: params.mediaType,
    mediaUrl: params.mediaUrl || undefined,
    storagePath: params.storagePath || undefined,
    text: params.text?.trim() || undefined,
    backgroundStyle: params.backgroundStyle || 'from-indigo-600 to-purple-700',
    audience: params.audience || 'campus',
    groupId: params.groupId || undefined,
    status: 'active',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    viewCount: 0,
    reactionCount: 0,
    replyCount: 0,
  };

  const storiesRef = collection(db, 'stories');
  const docRef = await addDoc(storiesRef, storyData);

  logAnalyticsEvent('story_created', { mediaType: params.mediaType, audience: params.audience });

  return { id: docRef.id, ...storyData, createdAt: new Date() } as Story;
};

/**
 * Retrieves active campus stories grouped by author.
 * Sets hasUnseen accurately per-user based on Firestore view records.
 */
export const getActiveCampusStories = async (
  currentUser?: FirebaseUser
): Promise<GroupedAuthorStories[]> => {
  try {
    const storiesRef = collection(db, 'stories');
    let snap;
    try {
      const q = query(storiesRef, where('status', '==', 'active'), limit(100));
      snap = await getDocs(q);
    } catch {
      snap = await getDocs(storiesRef);
    }

    const nowMs = Date.now();
    const activeStories = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Story[];

    const filtered = activeStories.filter((story) => {
      if (story.status === 'deleted') return false;
      if (!story.expiresAt) return true;
      const expMs = typeof (story.expiresAt as any)?.toMillis === 'function' 
        ? (story.expiresAt as any).toMillis() 
        : new Date(story.expiresAt).getTime();
      return isNaN(expMs) || expMs > nowMs;
    });

    // Group stories by authorId
    const authorMap: Record<string, GroupedAuthorStories> = {};

    for (const story of filtered) {
      if (!authorMap[story.authorId]) {
        authorMap[story.authorId] = {
          authorId: story.authorId,
          authorName: story.authorName || 'Campus Student',
          authorAvatar: story.authorAvatar,
          stories: [],
          hasUnseen: false, // Will be set after checking views
        };
      }
      authorMap[story.authorId].stories.push(story);
    }

    // For logged-in users, check per-story view status in parallel (bounded)
    if (currentUser) {
      const uid = currentUser.uid;
      const viewChecks = filtered.map(async (story) => {
        try {
          const viewRef = doc(db, 'stories', story.id, 'views', uid);
          const viewSnap = await getDoc(viewRef);
          return { storyId: story.id, authorId: story.authorId, viewed: viewSnap.exists() };
        } catch {
          return { storyId: story.id, authorId: story.authorId, viewed: false };
        }
      });

      const viewResults = await Promise.all(viewChecks);

      // For each author group, mark hasUnseen = true if ANY story in the group is unviewed
      for (const result of viewResults) {
        if (!result.viewed && authorMap[result.authorId]) {
          authorMap[result.authorId].hasUnseen = true;
        }
      }
    } else {
      // Not logged in: treat all as unseen
      for (const group of Object.values(authorMap)) {
        group.hasUnseen = true;
      }
    }

    return Object.values(authorMap);
  } catch (err) {
    console.error('Error fetching active stories:', err);
    return [];
  }
};

/**
 * Records a story view once per user.
 * Path: stories/{storyId}/views/{userId}
 */
export const recordStoryView = async (
  storyId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !storyId) return;
  const uid = currentUser.uid;

  const viewRef = doc(db, 'stories', storyId, 'views', uid);
  const viewSnap = await getDoc(viewRef);

  if (!viewSnap.exists()) {
    await setDoc(viewRef, {
      userId: uid,
      userName: currentUser.displayName || 'Student',
      userAvatar: currentUser.photoURL || undefined,
      viewedAt: serverTimestamp(),
    });

    const storyRef = doc(db, 'stories', storyId);
    await setDoc(storyRef, { viewCount: increment(1) }, { merge: true });
    logAnalyticsEvent('story_viewed', { storyId });
  }
};

/**
 * Reads list of viewers for a story (author-only access).
 */
export const getStoryViewers = async (
  storyId: string,
  currentUser: FirebaseUser
): Promise<StoryView[]> => {
  if (!currentUser || !storyId) return [];

  const storyRef = doc(db, 'stories', storyId);
  const storySnap = await getDoc(storyRef);
  if (!storySnap.exists()) return [];

  const storyData = storySnap.data() as Story;
  if (storyData.authorId !== currentUser.uid) {
    throw new Error('Only the story author can view the viewer list.');
  }

  const viewsRef = collection(db, 'stories', storyId, 'views');
  const q = query(viewsRef, orderBy('viewedAt', 'desc'), limit(50));
  const snap = await getDocs(q);

  return snap.docs.map((d) => d.data()) as StoryView[];
};

/**
 * Toggles or adds a reaction to a story.
 */
export const reactToStory = async (
  storyId: string,
  reactionType: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !storyId) return;
  const uid = currentUser.uid;

  const storyRef = doc(db, 'stories', storyId);
  const storySnap = await getDoc(storyRef);
  if (!storySnap.exists()) return;

  const storyData = storySnap.data() as Story;
  const reactionRef = doc(db, 'stories', storyId, 'reactions', uid);
  const rxSnap = await getDoc(reactionRef);

  if (!rxSnap.exists()) {
    await setDoc(reactionRef, {
      userId: uid,
      reactionType,
      createdAt: serverTimestamp(),
    });

    await setDoc(storyRef, { reactionCount: increment(1) }, { merge: true });

    // Targeted notification to story author
    if (storyData.authorId !== uid) {
      createNotification({
        recipientId: storyData.authorId,
        senderId: uid,
        type: 'chat_activity',
        title: `Story Reaction ${reactionType}`,
        message: `${currentUser.displayName || 'Student'} reacted ${reactionType} to your story.`,
        deepLink: `/stories`,
      }).catch(() => {});
    }

    logAnalyticsEvent('story_reaction_added', { storyId, reactionType });
  }
};

/**
 * Soft deletes a story.
 */
export const deleteStory = async (
  storyId: string,
  currentUser: FirebaseUser
): Promise<void> => {
  if (!currentUser || !storyId) throw new Error('Authentication required.');

  const storyRef = doc(db, 'stories', storyId);
  const storySnap = await getDoc(storyRef);
  if (!storySnap.exists()) throw new Error('Story not found.');

  const storyData = storySnap.data() as Story;
  if (storyData.authorId !== currentUser.uid) {
    throw new Error('Only the author can delete this story.');
  }

  await setDoc(storyRef, { status: 'deleted' }, { merge: true });
  logAnalyticsEvent('story_deleted', { storyId });
};
