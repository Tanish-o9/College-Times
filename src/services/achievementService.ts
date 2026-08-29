import { collection, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const getUserAchievements = async (uid: string): Promise<string[]> => {
  if (!uid) return [];
  const achievements: string[] = [];

  try {
    // 1. Fetch User Points
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      const points = data.points || 0;
      achievements.push('Active Member'); // Default badge for all registered users
      if (points >= 50) achievements.push('Contributor');
      if (points >= 200) achievements.push('Top Contributor');
    }

    // 2. Group Builder (Created at least 1 group)
    const groupsQuery = query(collection(db, 'groups'), where('createdBy', '==', uid), limit(1));
    const groupsSnap = await getDocs(groupsQuery);
    if (!groupsSnap.empty) {
      achievements.push('Group Builder');
    }

    // 3. Event Organizer (Created at least 1 event)
    const eventsQuery = query(collection(db, 'events'), where('createdBy', '==', uid), limit(1));
    const eventsSnap = await getDocs(eventsQuery);
    if (!eventsSnap.empty) {
      achievements.push('Event Organizer');
    }

    // 4. Poll Creator (Created at least 1 post containing a poll)
    const postsQuery = query(collection(db, 'posts'), where('authorId', '==', uid));
    const postsSnap = await getDocs(postsQuery);
    const hasPoll = postsSnap.docs.some((d) => {
      const p = d.data();
      return p.poll !== undefined && p.poll !== null;
    });
    if (hasPoll) {
      achievements.push('Poll Creator');
    }
  } catch (err) {
    console.error('Error fetching achievements:', err);
  }

  return achievements;
};
