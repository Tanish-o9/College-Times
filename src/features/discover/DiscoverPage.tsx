import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  rankPeople,
  rankGroups,
  rankEvents,
  rankOpportunities,
  rankListings,
  type RecommendedPerson,
  type RecommendedGroup,
  type RecommendedEvent,
  type RecommendedOpportunity,
  type RecommendedListing,
} from '../../services/discoveryRankingService';
import { collection, getDocs, limit, query, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getFollowRequests } from '../../services/followService';
import {
  getRelationshipStatus,
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  type RelationshipStatus
} from '../../services/friendService';
import {
  Search,
  Users,
  Calendar,
  Briefcase,
  ShoppingBag,
  UserCheck,
  Flame,
  RefreshCw,
  UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';

export const DiscoverPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'people' | 'requests'>('people');
  
  const [people, setPeople] = useState<RecommendedPerson[]>([]);
  const [relationshipMap, setRelationshipMap] = useState<Record<string, RelationshipStatus>>({});
  const [actionBusyUid, setActionBusyUid] = useState<string | null>(null);

  const [groups, setGroups] = useState<RecommendedGroup[]>([]);
  const [events, setEvents] = useState<RecommendedEvent[]>([]);
  const [opportunities, setOpportunities] = useState<RecommendedOpportunity[]>([]);
  const [listings, setListings] = useState<RecommendedListing[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const loadDiscoveryData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // 1. Fetch user profile
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      const currentUserProfile = userDocSnap.exists() ? userDocSnap.data() : null;

      // 2. Fetch candidates in parallel alongside follow requests
      const [peopleSnap, groupsSnap, eventsSnap, oppsSnap, listingsSnap, reqs] = await Promise.all([
        getDocs(query(collection(db, 'users'), limit(20))),
        getDocs(query(collection(db, 'groups'), limit(20))),
        getDocs(query(collection(db, 'events'), limit(20))),
        getDocs(query(collection(db, 'opportunities'), limit(20))),
        getDocs(query(collection(db, 'marketplaceListings'), limit(20))),
        getFollowRequests(currentUser.uid),
      ]);

      const rawPeople = peopleSnap.docs.map((d) => ({ uid: d.id, ...d.data() })) as any[];
      const rawGroups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const rawEvents = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const rawOpps = oppsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const rawListings = listingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      // Fetch detailed profiles of requesters
      const detailedReqs: any[] = [];
      for (const requesterUid of reqs.uids) {
        const uSnap = await getDoc(doc(db, 'users', requesterUid));
        if (uSnap.exists()) {
          detailedReqs.push({
            uid: uSnap.id,
            ...uSnap.data(),
          });
        }
      }
      setPendingRequests(detailedReqs);

      // 3. Rank people & fetch relationship statuses
      const rankedPeople = rankPeople(rawPeople, (currentUserProfile as any) || currentUser);
      const slicedPeople = rankedPeople.slice(0, 5);
      
      const relMap: Record<string, RelationshipStatus> = {};
      await Promise.all(
        slicedPeople.map(async (p) => {
          const status = await getRelationshipStatus(currentUser.uid, p.uid);
          relMap[p.uid] = status;
        })
      );
      setRelationshipMap(relMap);
      setPeople(slicedPeople);

      // 4. Rank and set other collections
      const rankedGroups = rankGroups(rawGroups, undefined, (currentUserProfile as any)?.department);
      const rankedEvents = rankEvents(rawEvents, undefined, []);
      const rankedOpps = rankOpportunities(rawOpps, undefined, []);
      const rankedListings = rankListings(rawListings, undefined);

      setGroups(rankedGroups.slice(0, 5));
      setEvents(rankedEvents.slice(0, 5));
      setOpportunities(rankedOpps.slice(0, 5));
      setListings(rankedListings.slice(0, 5));
    } catch (err) {
      console.error('Failed to load discovery recommendation feeds:', err);
      toast.error('Failed to load personalized recommendations.');
    } finally {
      setLoading(false);
    }
  };

  const handleRelationshipAction = async (targetUid: string, currentStatus: RelationshipStatus) => {
    if (!currentUser || actionBusyUid) return;
    setActionBusyUid(targetUid);
    try {
      if (currentStatus === 'NONE') {
        const isPending = await sendFriendRequest(currentUser.uid, targetUid);
        setRelationshipMap((prev) => ({
          ...prev,
          [targetUid]: isPending ? 'FRIENDS' : 'OUTGOING_PENDING',
        }));
        toast.success('Friend request sent!');
      } else if (currentStatus === 'OUTGOING_PENDING') {
        await cancelFriendRequest(currentUser.uid, targetUid);
        setRelationshipMap((prev) => ({
          ...prev,
          [targetUid]: 'NONE',
        }));
        toast.success('Friend request cancelled.');
      } else if (currentStatus === 'INCOMING_PENDING') {
        await acceptFriendRequest(currentUser.uid, targetUid);
        setRelationshipMap((prev) => ({
          ...prev,
          [targetUid]: 'FRIENDS',
        }));
        toast.success('Friend request accepted! 🎉');
        loadDiscoveryData(); // Refresh counts/requests list
      } else if (currentStatus === 'FRIENDS') {
        const confirm = window.confirm('Are you sure you want to remove this friend?');
        if (confirm) {
          await removeFriend(currentUser.uid, targetUid);
          setRelationshipMap((prev) => ({
            ...prev,
            [targetUid]: 'NONE',
          }));
          toast.success('Friend removed.');
          loadDiscoveryData(); // Refresh counts/requests list
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setActionBusyUid(null);
    }
  };

  const handleAcceptRequest = async (requesterUid: string) => {
    if (!currentUser) return;
    try {
      await acceptFriendRequest(currentUser.uid, requesterUid);
      toast.success('Friend request accepted! 🎉');
      setPendingRequests((prev) => prev.filter((r) => r.uid !== requesterUid));
      loadDiscoveryData(); // Refresh lists and counts
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept request.');
    }
  };

  const handleRejectRequest = async (requesterUid: string) => {
    if (!currentUser) return;
    try {
      await declineFriendRequest(currentUser.uid, requesterUid);
      toast.success('Friend request deleted.');
      setPendingRequests((prev) => prev.filter((r) => r.uid !== requesterUid));
      loadDiscoveryData(); // Refresh lists and counts
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request.');
    }
  };

  useEffect(() => {
    loadDiscoveryData();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-400 text-xs font-mono">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Generating recommendations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-4 sm:px-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
            <span>Campus Discovery Hub</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-mono">Personalized groups, events, opportunities, and connections</p>
        </div>
        <button
          onClick={loadDiscoveryData}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-all"
          title="Refresh Recommendations"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {/* Main Grid content */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('people')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'people'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>People</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'requests'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Friend Requests</span>
            {pendingRequests.length > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 font-bold text-[9px] rounded-full">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'people' ? (
          <div className="space-y-6">
            {/* Search Integration Bar */}
            <div
              onClick={() => navigate('/search')}
              className="p-4 bg-slate-900/60 border border-slate-800 rounded-3xl flex items-center gap-3 cursor-pointer hover:border-slate-700 transition-all shadow-xl group"
            >
              <Search className="w-5 h-5 text-slate-500 group-hover:text-sky-400 transition-colors" />
              <span className="text-xs text-slate-400">Search people, groups, posts, events, and listings...</span>
            </div>

            {/* Discovery Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Groups You May Like */}
              <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Users className="w-4.5 h-4.5 text-sky-400" />
                  <span>Groups You May Like</span>
                </h2>
                <div className="space-y-3">
                  {groups.map((g) => (
                    <div key={g.id} className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-white truncate">{g.name}</h3>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{g.description}</p>
                        <span className="text-[9px] text-sky-400 font-mono mt-1 block">★ {g.explanation}</span>
                      </div>
                      <button
                        onClick={() => navigate(`/groups/${g.id}`)}
                        className="px-3 py-1 bg-sky-500 text-slate-950 font-bold text-[10px] rounded-lg shrink-0 hover:bg-sky-400 transition-all"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* People You May Know */}
              <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <UserPlus className="w-4.5 h-4.5 text-emerald-400" />
                  <span>People You May Know</span>
                </h2>
                <div className="space-y-3">
                  {people.map((p) => {
                    const status = relationshipMap[p.uid] || 'NONE';
                    const isBusy = actionBusyUid === p.uid;

                    return (
                      <div key={p.uid} className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3">
                        <div 
                          onClick={() => navigate(`/profile/${p.username || p.uid}`)}
                          className="min-w-0 flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {p.photoURL ? (
                            <img src={p.photoURL} className="w-8 h-8 rounded-full object-cover border border-slate-800 shrink-0" alt="" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-850 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                              {(p.displayName || 'Student').slice(0, 1)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-white truncate">{p.displayName || 'Student'}</h3>
                            <span className="text-[9px] text-emerald-400 font-mono block">★ {p.explanation}</span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {status === 'NONE' && (
                            <button
                              onClick={() => handleRelationshipAction(p.uid, 'NONE')}
                              disabled={isBusy}
                              className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[10px] rounded-lg transition-colors"
                            >
                              Add Friend
                            </button>
                          )}
                          {status === 'OUTGOING_PENDING' && (
                            <button
                              onClick={() => handleRelationshipAction(p.uid, 'OUTGOING_PENDING')}
                              disabled={isBusy}
                              className="px-3 py-1 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-750 font-bold text-[10px] rounded-lg transition-colors"
                              title="Click to Cancel Request"
                            >
                              Requested
                            </button>
                          )}
                          {status === 'INCOMING_PENDING' && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleRelationshipAction(p.uid, 'INCOMING_PENDING')}
                                disabled={isBusy}
                                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] rounded-lg transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                onClick={async () => {
                                  if (isBusy) return;
                                  setActionBusyUid(p.uid);
                                  try {
                                    await declineFriendRequest(currentUser?.uid ?? '', p.uid);
                                    setRelationshipMap(prev => ({ ...prev, [p.uid]: 'NONE' }));
                                    toast.success('Friend request declined.');
                                    loadDiscoveryData();
                                  } catch (err: any) {
                                    toast.error(err.message || 'Failed to decline request.');
                                  } finally {
                                    setActionBusyUid(null);
                                  }
                                }}
                                disabled={isBusy}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded-lg transition-colors"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          {status === 'FRIENDS' && (
                            <button
                              onClick={() => handleRelationshipAction(p.uid, 'FRIENDS')}
                              disabled={isBusy}
                              className="px-3 py-1 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 font-bold text-[10px] rounded-lg transition-colors"
                              title="Click to Remove Friend"
                            >
                              Friends
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Upcoming Events */}
              <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Calendar className="w-4.5 h-4.5 text-purple-400" />
                  <span>Upcoming Events</span>
                </h2>
                <div className="space-y-3">
                  {events.map((e) => (
                    <div key={e.id} className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-white truncate">{e.title}</h3>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{e.location}</p>
                        <span className="text-[9px] text-purple-400 font-mono mt-1 block">★ {e.explanation}</span>
                      </div>
                      <button
                        onClick={() => navigate(`/events`)}
                        className="px-3 py-1 bg-purple-500 text-slate-950 font-bold text-[10px] rounded-lg shrink-0 hover:bg-purple-400 transition-all"
                      >
                        RSVP
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recommended Opportunities */}
              <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Briefcase className="w-4.5 h-4.5 text-indigo-400" />
                  <span>Internships & Opportunities</span>
                </h2>
                <div className="space-y-3">
                  {opportunities.map((o) => (
                    <div key={o.id} className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-white truncate">{o.title}</h3>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{o.organization || 'AKGEC Campus'}</p>
                        <span className="text-[9px] text-indigo-400 font-mono mt-1 block">★ {o.explanation}</span>
                      </div>
                      <button
                        onClick={() => navigate(`/opportunities`)}
                        className="px-3 py-1 bg-indigo-500 text-slate-950 font-bold text-[10px] rounded-lg shrink-0 hover:bg-indigo-400 transition-all"
                      >
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Marketplace Picks */}
            <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <ShoppingBag className="w-4.5 h-4.5 text-amber-400" />
                <span>Marketplace Deals</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {listings.map((l) => (
                  <div key={l.id} className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl flex flex-col justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-white truncate">{l.title}</h3>
                      <p className="text-emerald-400 font-mono font-bold text-xs mt-1">₹{l.price}</p>
                      <span className="text-[9px] text-amber-400 font-mono mt-2 block">★ {l.explanation}</span>
                    </div>
                    <button
                      onClick={() => navigate(`/marketplace`)}
                      className="w-full py-1.5 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-lg hover:bg-amber-400 transition-all"
                    >
                      Buy Now
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          /* Friend Requests tab view */
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
            <h2 className="text-xs font-bold text-sky-400 uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Users className="w-4.5 h-4.5 text-sky-400" />
              <span>Pending Friend Requests ({pendingRequests.length})</span>
            </h2>
            {pendingRequests.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 font-mono italic">
                No friend requests yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingRequests.map((r) => (
                  <div key={r.uid} className="p-3 bg-slate-950/40 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                    <div 
                      onClick={() => navigate(`/profile/${r.username || r.uid}`)}
                      className="min-w-0 flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {r.photoURL ? (
                        <img src={r.photoURL} className="w-8 h-8 rounded-full object-cover border border-slate-800 shrink-0" alt="" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-850 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                          {(r.displayName || 'Student').slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-white truncate">{r.displayName || 'Student'}</h3>
                        <p className="text-[10px] text-slate-400 font-mono truncate">@{r.username || 'username'}</p>
                        {r.department && (
                          <p className="text-[9px] text-sky-400 font-semibold truncate mt-0.5">{r.department} {r.batchYear ? `· ${r.batchYear}` : ''}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleAcceptRequest(r.uid)}
                        className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[10px] rounded-lg transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectRequest(r.uid)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-750 font-bold text-[10px] rounded-lg transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
