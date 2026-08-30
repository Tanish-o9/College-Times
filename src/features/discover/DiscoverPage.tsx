import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { getSuggestedFriends, type SuggestedFriend } from '../../services/peopleSuggestionService';
import { getSuggestedGroups, type SuggestedGroup } from '../../services/groupSuggestionService';
import { getTrendingPosts } from '../../services/trendingService';
import { getTrendingEvents, type TrendingEvent } from '../../services/trendingService';
import type { Post } from '../../types';
import { collection, getDocs, limit, query, doc, getDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  getRelationshipStatus,
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  
  type DiscoverTab = 'people' | 'requests' | 'suggested_friends' | 'suggested_groups' | 'trending_posts' | 'trending_events';
  const activeTab = (searchParams.get('tab') as DiscoverTab) || 'people';
  const setActiveTab = (tab: DiscoverTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  const [loadingTab, setLoadingTab] = useState(false);
  
  const [people, setPeople] = useState<RecommendedPerson[]>([]);
  const [relationshipMap, setRelationshipMap] = useState<Record<string, RelationshipStatus>>({});
  const [actionBusyUid, setActionBusyUid] = useState<string | null>(null);

  const [groups, setGroups] = useState<RecommendedGroup[]>([]);
  const [events, setEvents] = useState<RecommendedEvent[]>([]);
  const [opportunities, setOpportunities] = useState<RecommendedOpportunity[]>([]);
  const [listings, setListings] = useState<RecommendedListing[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [recentlyAccepted, setRecentlyAccepted] = useState<any[]>([]);

  // Phase 4 discovery states
  const [suggestedFriends, setSuggestedFriends] = useState<SuggestedFriend[]>([]);
  const [suggestedGroups, setSuggestedGroups] = useState<SuggestedGroup[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [trendingEvents, setTrendingEvents] = useState<TrendingEvent[]>([]);

  const loadDiscoveryData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // 1. Fetch user profile
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      const currentUserProfile = userDocSnap.exists() ? userDocSnap.data() : null;

      // 2. Fetch candidates in parallel alongside friend requests
      const [peopleSnap, groupsSnap, eventsSnap, oppsSnap, listingsSnap, incomingReqs, outgoingReqs, friendshipsSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), limit(20))),
        getDocs(query(collection(db, 'groups'), limit(20))),
        getDocs(query(collection(db, 'events'), limit(20))),
        getDocs(query(collection(db, 'opportunities'), limit(20))),
        getDocs(query(collection(db, 'marketplaceListings'), limit(20))),
        getIncomingFriendRequests(currentUser.uid),
        getOutgoingFriendRequests(currentUser.uid),
        getDocs(query(collection(db, 'friendships'), where('userUids', 'array-contains', currentUser.uid), limit(20))),
      ]);

      const rawPeople = peopleSnap.docs.map((d) => ({ uid: d.id, ...d.data() })) as any[];
      const rawGroups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const rawEvents = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const rawOpps = oppsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const rawListings = listingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      // Fetch detailed profiles of incoming requesters
      const detailedReqs: any[] = [];
      for (const requesterUid of incomingReqs.uids) {
        const uSnap = await getDoc(doc(db, 'users', requesterUid));
        if (uSnap.exists()) {
          detailedReqs.push({
            uid: uSnap.id,
            ...uSnap.data(),
          });
        }
      }
      setPendingRequests(detailedReqs);

      // Fetch detailed profiles of outgoing requesters
      const detailedSent: any[] = [];
      for (const targetUid of outgoingReqs.uids) {
        const uSnap = await getDoc(doc(db, 'users', targetUid));
        if (uSnap.exists()) {
          detailedSent.push({
            uid: uSnap.id,
            ...uSnap.data(),
          });
        }
      }
      setSentRequests(detailedSent);

      // Extract recently accepted friends
      const rawFriendships = friendshipsSnap.docs.map((d) => d.data());
      rawFriendships.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });

      const recentFriends: any[] = [];
      for (const fs of rawFriendships.slice(0, 10)) {
        const otherUid = fs.uidA === currentUser.uid ? fs.uidB : fs.uidA;
        if (otherUid) {
          const uSnap = await getDoc(doc(db, 'users', otherUid));
          if (uSnap.exists()) {
            recentFriends.push({
              uid: uSnap.id,
              ...uSnap.data(),
            });
          }
        }
      }
      setRecentlyAccepted(recentFriends);

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

  // Lazy load Phase 4 tab data on tab switch
  const loadPhase4Tab = async (tab: typeof activeTab) => {
    if (!currentUser) return;
    setLoadingTab(true);
    try {
      if (tab === 'suggested_friends' && suggestedFriends.length === 0) {
        const friends = await getSuggestedFriends(currentUser.uid, 8);
        setSuggestedFriends(friends);
      } else if (tab === 'suggested_groups' && suggestedGroups.length === 0) {
        const groups = await getSuggestedGroups(currentUser.uid, 8);
        setSuggestedGroups(groups);
      } else if (tab === 'trending_posts' && trendingPosts.length === 0) {
        const posts = await getTrendingPosts(10);
        setTrendingPosts(posts);
      } else if (tab === 'trending_events' && trendingEvents.length === 0) {
        const userDocSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const userProfile = userDocSnap.exists() ? userDocSnap.data() : null;
        const events = await getTrendingEvents(userProfile, 10);
        setTrendingEvents(events);
      }
    } catch (err) {
      console.error('Failed to load Phase 4 tab data:', err);
    } finally {
      setLoadingTab(false);
    }
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (['suggested_friends', 'suggested_groups', 'trending_posts', 'trending_events'].includes(tab)) {
      loadPhase4Tab(tab);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12 relative overflow-hidden">
      {/* Soft Background Colorful Ambient Aura */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-80 bg-gradient-to-r from-sky-500/20 via-purple-500/20 to-pink-500/20 blur-3xl opacity-80 pointer-events-none rounded-full animate-gradient-x animate-float-slow" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-2xl border-b border-slate-800/80 px-4 py-4 sm:px-6 flex items-center justify-between shadow-lg">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
            <span className="bg-gradient-to-r from-sky-300 via-purple-300 to-pink-300 bg-clip-text text-transparent font-extrabold">
              Campus Discovery Hub
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 font-mono">Personalized groups, events, opportunities, and connections</p>
        </div>
        <button
          onClick={loadDiscoveryData}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 border border-slate-800 hover:border-sky-500/40 hover:-translate-y-0.5 transition-all cursor-pointer active:scale-95"
          title="Refresh Recommendations"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {/* Main Grid content */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 relative z-10">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-800/80 pb-2">
          <button
            onClick={() => handleTabChange('people')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'people'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/40 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>People</span>
          </button>

          <button
            onClick={() => handleTabChange('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'requests'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
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

          <button
            onClick={() => handleTabChange('suggested_friends')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'suggested_friends'
                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <UserPlus className="w-4 h-4 text-purple-400" />
            <span>Suggested</span>
          </button>

          <button
            onClick={() => handleTabChange('suggested_groups')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'suggested_groups'
                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Groups</span>
          </button>

          <button
            onClick={() => handleTabChange('trending_posts')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'trending_posts'
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Flame className="w-4 h-4 text-rose-400" />
            <span>Trending</span>
          </button>

          <button
            onClick={() => handleTabChange('trending_events')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'trending_events'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Events</span>
          </button>
        </div>

        {/* Phase 4 Suggested Friends Tab */}
        {activeTab === 'suggested_friends' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-purple-400" />
              People You May Know
            </h2>
            {loadingTab ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-4">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                <span>Finding people...</span>
              </div>
            ) : suggestedFriends.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No new people to suggest right now.</p>
            ) : (
              <div className="space-y-3">
                {suggestedFriends.map((p) => (
                  <div key={p.uid} className="p-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-[0_0_18px_rgba(168,85,247,0.15)] rounded-2xl flex items-center gap-3 transition-all duration-200 shadow-lg group">
                    {p.photoURL ? (
                      <img src={p.photoURL} className="w-10 h-10 rounded-full object-cover border border-slate-700" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 font-bold text-sm">
                        {p.displayName?.charAt(0) || '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate group-hover:text-purple-300 transition-colors">{p.displayName}</p>
                      <p className="text-[11px] text-purple-400 font-mono">@{p.username}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{p.explanation}</p>
                    </div>
                    <button
                      onClick={() => navigate(`/profile/${p.uid}`)}
                      className="px-3.5 py-1.5 bg-purple-500/15 hover:bg-purple-500 text-purple-300 hover:text-slate-950 border border-purple-500/40 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Phase 4 Suggested Groups Tab */}
        {activeTab === 'suggested_groups' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Groups You May Like
            </h2>
            {loadingTab ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-4">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Finding groups...</span>
              </div>
            ) : suggestedGroups.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No new groups to suggest right now.</p>
            ) : (
              <div className="space-y-3">
                {suggestedGroups.map((g) => (
                  <div key={g.id} className="p-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 hover:border-emerald-500/40 hover:-translate-y-1 hover:shadow-[0_0_18px_rgba(52,211,153,0.15)] rounded-2xl flex items-center gap-3 transition-all duration-200 shadow-lg group">
                    {g.iconUrl ? (
                      <img src={g.iconUrl} className="w-10 h-10 rounded-xl object-cover border border-slate-700" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 font-bold text-sm">
                        {g.name?.charAt(0) || 'G'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">{g.name}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{g.description}</p>
                      <p className="text-[10px] text-emerald-400 mt-0.5">{g.explanation}</p>
                    </div>
                    <button
                      onClick={() => navigate(`/groups/${g.id}`)}
                      className="px-3.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Phase 4 Trending Posts Tab */}
        {activeTab === 'trending_posts' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              Trending Posts
            </h2>
            {loadingTab ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-4">
                <RefreshCw className="w-4 h-4 animate-spin text-orange-400" />
                <span>Loading trending posts...</span>
              </div>
            ) : trendingPosts.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No trending posts available.</p>
            ) : (
              <div className="space-y-3">
                {trendingPosts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/feed?postId=${p.id}`)}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-2xl cursor-pointer hover:border-slate-700 transition-all space-y-1"
                  >
                    <p className="text-xs font-semibold text-white line-clamp-2">{p.title || p.content}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                      <span>👍 {p.likeCount || 0}</span>
                      <span>💬 {p.commentCount || 0}</span>
                      <span className="text-orange-400">{p.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Phase 4 Trending Events Tab */}
        {activeTab === 'trending_events' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              Upcoming Events
            </h2>
            {loadingTab ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-4">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                <span>Loading events...</span>
              </div>
            ) : trendingEvents.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No upcoming events to show.</p>
            ) : (
              <div className="space-y-3">
                {trendingEvents.map((ev) => (
                  <div key={ev.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                    <p className="text-sm font-semibold text-white">{ev.title}</p>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{ev.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                      <span>📅 {ev.date}</span>
                      <span>📍 {ev.location}</span>
                      <span className="text-sky-400">👥 {ev.rsvpCount} RSVPs</span>
                    </div>
                    <p className="text-[10px] text-emerald-400">{ev.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


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
        ) : activeTab === 'requests' ? (
          /* Friend Requests Hub: Incoming, Sent, and Recently Accepted */
          <div className="space-y-6">
            {/* Incoming requests */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <h2 className="text-xs font-bold text-sky-400 uppercase font-mono tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-sky-400" />
                <span>Pending Friend Requests ({pendingRequests.length})</span>
              </h2>
              {pendingRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-mono italic">
                  No incoming friend requests.
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
                          className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[10px] rounded-lg transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectRequest(r.uid)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-750 font-bold text-[10px] rounded-lg transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sent requests */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <h2 className="text-xs font-bold text-amber-400 uppercase font-mono tracking-wider flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span>Sent Requests ({sentRequests.length})</span>
              </h2>
              {sentRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-mono italic">
                  No pending sent requests.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sentRequests.map((r) => (
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
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await cancelFriendRequest(currentUser!.uid, r.uid);
                            toast.success('Friend request cancelled.');
                            setSentRequests((prev) => prev.filter((x) => x.uid !== r.uid));
                            loadDiscoveryData();
                          } catch (err: any) {
                            toast.error(err.message || 'Action failed.');
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-750 font-bold text-[10px] rounded-lg transition-colors shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Accepted Recently */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <h2 className="text-xs font-bold text-emerald-400 uppercase font-mono tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Recently Accepted Friends</span>
              </h2>
              {recentlyAccepted.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-mono italic">
                  No recently accepted friends.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {recentlyAccepted.map((r) => (
                    <div
                      key={r.uid}
                      onClick={() => navigate(`/profile/${r.username || r.uid}`)}
                      className="p-3 bg-slate-950/40 border border-slate-800 rounded-2xl flex items-center gap-3 cursor-pointer hover:border-slate-700 hover:bg-slate-900/40 transition-all"
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};
