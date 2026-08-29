import { collection, query, where, getCountFromServer, collectionGroup, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface PlatformMetrics {
  usersTotal: number;
  usersNew: number;
  postsTotal: number;
  commentsTotal: number;
  friendshipsTotal: number;
  groupsTotal: number;
  groupMembershipsTotal: number;
  listingsTotal: number;
  listingsSold: number;
  opportunitiesActive: number;
  eventsUpcoming: number;
  eventsRsvps: number;
  reportsOpen: number;
  reportsResolved: number;
  trends: {
    users: { today: number; yesterday: number; thisWeek: number; prevWeek: number; thisMonth: number; prevMonth: number };
    posts: { today: number; yesterday: number; thisWeek: number; prevWeek: number; thisMonth: number; prevMonth: number };
  };
}

/**
 * Computes real platform metrics using lightweight server-side count aggregates and trend comparisons.
 */
export const getPlatformAnalytics = async (): Promise<PlatformMetrics> => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // 1. Users Counts
    const usersColl = collection(db, 'users');
    const usersTotalSnap = await getCountFromServer(usersColl);
    const usersNewSnap = await getCountFromServer(
      query(usersColl, where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo)))
    );

    // Users trends
    const uTodaySnap = await getCountFromServer(query(usersColl, where('createdAt', '>=', Timestamp.fromDate(startOfToday))));
    const uYestSnap = await getCountFromServer(query(usersColl, where('createdAt', '>=', Timestamp.fromDate(startOfYesterday)), where('createdAt', '<', Timestamp.fromDate(startOfToday))));
    const uThisWeekSnap = await getCountFromServer(query(usersColl, where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo))));
    const uPrevWeekSnap = await getCountFromServer(query(usersColl, where('createdAt', '>=', Timestamp.fromDate(fourteenDaysAgo)), where('createdAt', '<', Timestamp.fromDate(sevenDaysAgo))));
    const uThisMonthSnap = await getCountFromServer(query(usersColl, where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo))));
    const uPrevMonthSnap = await getCountFromServer(query(usersColl, where('createdAt', '>=', Timestamp.fromDate(sixtyDaysAgo)), where('createdAt', '<', Timestamp.fromDate(thirtyDaysAgo))));

    // 2. Posts & Comments
    const postsColl = collection(db, 'posts');
    const postsTotalSnap = await getCountFromServer(postsColl);
    const commentsCollGroup = collectionGroup(db, 'comments');
    const commentsTotalSnap = await getCountFromServer(commentsCollGroup);

    // Posts trends
    const pTodaySnap = await getCountFromServer(query(postsColl, where('timestamp', '>=', Timestamp.fromDate(startOfToday))));
    const pYestSnap = await getCountFromServer(query(postsColl, where('timestamp', '>=', Timestamp.fromDate(startOfYesterday)), where('timestamp', '<', Timestamp.fromDate(startOfToday))));
    const pThisWeekSnap = await getCountFromServer(query(postsColl, where('timestamp', '>=', Timestamp.fromDate(sevenDaysAgo))));
    const pPrevWeekSnap = await getCountFromServer(query(postsColl, where('timestamp', '>=', Timestamp.fromDate(fourteenDaysAgo)), where('timestamp', '<', Timestamp.fromDate(sevenDaysAgo))));
    const pThisMonthSnap = await getCountFromServer(query(postsColl, where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo))));
    const pPrevMonthSnap = await getCountFromServer(query(postsColl, where('timestamp', '>=', Timestamp.fromDate(sixtyDaysAgo)), where('timestamp', '<', Timestamp.fromDate(thirtyDaysAgo))));

    // 3. Friendships
    const friendshipsColl = collection(db, 'friendships');
    const friendshipsSnap = await getCountFromServer(friendshipsColl);

    // 4. Groups & Memberships
    const groupsColl = collection(db, 'groups');
    const groupsSnap = await getCountFromServer(groupsColl);
    const groupMembersCollGroup = collectionGroup(db, 'members');
    const groupMembersSnap = await getCountFromServer(groupMembersCollGroup);

    // 5. Marketplace
    const listingsColl = collection(db, 'marketplaceListings');
    const listingsTotalSnap = await getCountFromServer(listingsColl);
    const listingsSoldSnap = await getCountFromServer(
      query(listingsColl, where('status', '==', 'sold'))
    );

    // 6. Opportunities
    const oppsColl = collection(db, 'opportunities');
    const oppsActiveSnap = await getCountFromServer(
      query(oppsColl, where('status', '==', 'active'))
    );

    // 7. Events
    const eventsColl = collection(db, 'events');
    const eventsUpcomingSnap = await getCountFromServer(
      query(eventsColl, where('eventDate', '>=', Timestamp.fromDate(now)))
    );
    const rsvpsCollGroup = collectionGroup(db, 'rsvps');
    const rsvpsSnap = await getCountFromServer(rsvpsCollGroup);

    // 8. Reports
    const reportsColl = collection(db, 'reports');
    const reportsOpenSnap = await getCountFromServer(
      query(reportsColl, where('status', '==', 'OPEN'))
    );
    const reportsResolvedSnap = await getCountFromServer(
      query(reportsColl, where('status', 'in', ['RESOLVED', 'DISMISSED']))
    );

    return {
      usersTotal: usersTotalSnap.data().count,
      usersNew: usersNewSnap.data().count,
      postsTotal: postsTotalSnap.data().count,
      commentsTotal: commentsTotalSnap.data().count,
      friendshipsTotal: friendshipsSnap.data().count,
      groupsTotal: groupsSnap.data().count,
      groupMembershipsTotal: groupMembersSnap.data().count,
      listingsTotal: listingsTotalSnap.data().count,
      listingsSold: listingsSoldSnap.data().count,
      opportunitiesActive: oppsActiveSnap.data().count,
      eventsUpcoming: eventsUpcomingSnap.data().count,
      eventsRsvps: rsvpsSnap.data().count,
      reportsOpen: reportsOpenSnap.data().count,
      reportsResolved: reportsResolvedSnap.data().count,
      trends: {
        users: {
          today: uTodaySnap.data().count,
          yesterday: uYestSnap.data().count,
          thisWeek: uThisWeekSnap.data().count,
          prevWeek: uPrevWeekSnap.data().count,
          thisMonth: uThisMonthSnap.data().count,
          prevMonth: uPrevMonthSnap.data().count,
        },
        posts: {
          today: pTodaySnap.data().count,
          yesterday: pYestSnap.data().count,
          thisWeek: pThisWeekSnap.data().count,
          prevWeek: pPrevWeekSnap.data().count,
          thisMonth: pThisMonthSnap.data().count,
          prevMonth: pPrevMonthSnap.data().count,
        },
      },
    };
  } catch (err) {
    console.error('Failed to aggregate platform metrics:', err);
    return {
      usersTotal: 0,
      usersNew: 0,
      postsTotal: 0,
      commentsTotal: 0,
      friendshipsTotal: 0,
      groupsTotal: 0,
      groupMembershipsTotal: 0,
      listingsTotal: 0,
      listingsSold: 0,
      opportunitiesActive: 0,
      eventsUpcoming: 0,
      eventsRsvps: 0,
      reportsOpen: 0,
      reportsResolved: 0,
      trends: {
        users: { today: 0, yesterday: 0, thisWeek: 0, prevWeek: 0, thisMonth: 0, prevMonth: 0 },
        posts: { today: 0, yesterday: 0, thisWeek: 0, prevWeek: 0, thisMonth: 0, prevMonth: 0 },
      },
    };
  }
};
