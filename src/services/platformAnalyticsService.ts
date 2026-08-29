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
}

/**
 * Computes real platform metrics using lightweight server-side count aggregates.
 */
export const getPlatformAnalytics = async (): Promise<PlatformMetrics> => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Users Counts
    const usersColl = collection(db, 'users');
    const usersTotalSnap = await getCountFromServer(usersColl);
    const usersNewSnap = await getCountFromServer(
      query(usersColl, where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo)))
    );

    // 2. Posts & Comments
    const postsColl = collection(db, 'posts');
    const postsTotalSnap = await getCountFromServer(postsColl);
    const commentsCollGroup = collectionGroup(db, 'comments');
    const commentsTotalSnap = await getCountFromServer(commentsCollGroup);

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
    };
  } catch (err) {
    console.error('Failed to aggregate platform metrics:', err);
    // Return zeros fallback
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
    };
  }
};
