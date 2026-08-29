import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  serverTimestamp,
  QueryDocumentSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { db, logAnalyticsEvent } from '../lib/firebase';

export type GroupActivityType =
  | 'announcement'
  | 'event'
  | 'poll'
  | 'moment'
  | 'post'
  | 'membership_change'
  | 'moderation'
  | 'file_shared'
  | 'task'
  | 'project';

export interface GroupActivityEvent {
  id?: string;
  groupId: string;
  type: GroupActivityType;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  targetId?: string;
  targetType?: string;
  preview?: string;
  createdAt: any;
}

export interface GroupActivityState {
  lastSeenActivityId?: string;
  lastSeenAt?: any;
  unreadCount?: number;
  updatedAt: any;
}

/**
 * Logs a persistent group activity timeline event.
 */
export const logGroupActivityEvent = async (
  groupId: string,
  type: GroupActivityType,
  actorId: string,
  actorName: string,
  actorAvatar?: string,
  targetId?: string,
  targetType?: string,
  preview?: string
): Promise<void> => {
  if (!groupId || !actorId) return;

  try {
    const activityColRef = collection(db, 'groups', groupId, 'activity');
    await addDoc(activityColRef, {
      groupId,
      type,
      actorId,
      actorName,
      ...(actorAvatar ? { actorAvatar } : {}),
      ...(targetId ? { targetId } : {}),
      ...(targetType ? { targetType } : {}),
      ...(preview ? { preview: preview.trim().slice(0, 150) } : {}),
      createdAt: serverTimestamp(),
    });

    let pointsToAdd = 0;
    if (type === 'post') pointsToAdd = 10;
    else if (type === 'moment') pointsToAdd = 10;
    else if (type === 'poll') pointsToAdd = 15;
    else if (type === 'event') pointsToAdd = 20;
    else if (type === 'announcement') pointsToAdd = 20;
    else if (type === 'membership_change' && preview && preview.toLowerCase().includes('joined')) pointsToAdd = 5;
    else if (type === 'task') pointsToAdd = 15;
    else if (type === 'project') pointsToAdd = 30;

    if (pointsToAdd > 0) {
      const getYearWeekString = (date: Date): string => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
      };

      const getYearMonthString = (date: Date): string => {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      };

      try {
        const memberRef = doc(db, 'groups', groupId, 'members', actorId);
        const memberSnap = await getDoc(memberRef);
        if (memberSnap.exists()) {
          const mData = memberSnap.data();
          const currentWeek = getYearWeekString(new Date());
          const currentMonth = getYearMonthString(new Date());

          const lastWeek = mData.lastPointsUpdateWeek || '';
          const lastMonth = mData.lastPointsUpdateMonth || '';

          const prevPoints = mData.points || 0;
          const prevWeekly = mData.weeklyPoints || 0;
          const prevMonthly = mData.monthlyPoints || 0;

          const nextWeekly = lastWeek === currentWeek ? prevWeekly + pointsToAdd : pointsToAdd;
          const nextMonthly = lastMonth === currentMonth ? prevMonthly + pointsToAdd : pointsToAdd;

          await updateDoc(memberRef, {
            points: prevPoints + pointsToAdd,
            weeklyPoints: nextWeekly,
            monthlyPoints: nextMonthly,
            lastPointsUpdateWeek: currentWeek,
            lastPointsUpdateMonth: currentMonth,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Failed to update group member points:', err);
      }
    }

    logAnalyticsEvent('group_activity_created', { groupId, type });
  } catch (err) {
    console.error('Failed to log group activity event:', err);
  }
};

/**
 * Fetches cursor-paginated activity timeline events for a group (bounded size 1 to 50, default 20).
 */
export const getGroupActivityTimeline = async (
  groupId: string,
  pageSize: number = 20,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<{ activities: GroupActivityEvent[]; lastDoc: QueryDocumentSnapshot | null }> => {
  if (!groupId) return { activities: [], lastDoc: null };

  const boundedSize = Math.min(50, Math.max(1, pageSize));
  const activityColRef = collection(db, 'groups', groupId, 'activity');

  let q = query(activityColRef, orderBy('createdAt', 'desc'), limit(boundedSize));
  if (lastDoc) {
    q = query(activityColRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(boundedSize));
  }

  const snap = await getDocs(q);
  const activities = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as GroupActivityEvent),
  }));

  const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { activities, lastDoc: newLastDoc };
};

/**
 * Marks group activity timeline as seen for a user.
 */
export const markGroupActivitySeen = async (
  groupId: string,
  userId: string,
  latestActivityId?: string
): Promise<void> => {
  if (!groupId || !userId) return;

  const stateRef = doc(db, 'users', userId, 'groupActivityState', groupId);
  await setDoc(
    stateRef,
    {
      lastSeenActivityId: latestActivityId || null,
      lastSeenAt: serverTimestamp(),
      unreadCount: 0,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  logAnalyticsEvent('group_activity_marked_seen', { groupId });
};

/**
 * Gets lightweight unread activity count for a user in a group.
 */
export const getGroupActivityUnreadCount = async (
  groupId: string,
  userId: string
): Promise<number> => {
  if (!groupId || !userId) return 0;

  try {
    const stateRef = doc(db, 'users', userId, 'groupActivityState', groupId);
    const snap = await getDoc(stateRef);
    if (snap.exists()) {
      return snap.data().unreadCount || 0;
    }
    return 0;
  } catch (err) {
    return 0;
  }
};
