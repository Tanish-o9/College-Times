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
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  Search,
  Users,
  Calendar,
  Briefcase,
  ShoppingBag,
  UserCheck,
  Flame,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const DiscoverPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<RecommendedPerson[]>([]);
  const [groups, setGroups] = useState<RecommendedGroup[]>([]);
  const [events, setEvents] = useState<RecommendedEvent[]>([]);
  const [opportunities, setOpportunities] = useState<RecommendedOpportunity[]>([]);
  const [listings, setListings] = useState<RecommendedListing[]>([]);

  const loadDiscoveryData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // 1. Fetch user profile
      const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
      const currentUserProfile = userSnap.docs[0]?.data() as any;

      // 2. Fetch candidates in parallel
      const [peopleSnap, groupsSnap, eventsSnap, oppsSnap, listingsSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), limit(20))),
        getDocs(query(collection(db, 'groups'), limit(20))),
        getDocs(query(collection(db, 'events'), limit(20))),
        getDocs(query(collection(db, 'opportunities'), limit(20))),
        getDocs(query(collection(db, 'marketplaceListings'), limit(20))),
      ]);

      const rawPeople = peopleSnap.docs.map((d) => ({ uid: d.id, ...d.data() })) as any[];
      const rawGroups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const rawEvents = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const rawOpps = oppsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const rawListings = listingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      // 3. Rank them using deterministic discovery engine
      const rankedPeople = rankPeople(rawPeople, currentUserProfile || currentUser);
      const rankedGroups = rankGroups(rawGroups, undefined, currentUserProfile?.departmentId);
      const rankedEvents = rankEvents(rawEvents, undefined, []);
      const rankedOpps = rankOpportunities(rawOpps, undefined, []);
      const rankedListings = rankListings(rawListings, undefined);

      setPeople(rankedPeople.slice(0, 5));
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
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
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
                    className="px-3 py-1 bg-sky-500 text-slate-950 font-bold text-[10px] rounded-lg shrink-0"
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
              <UserCheck className="w-4.5 h-4.5 text-emerald-400" />
              <span>People You May Know</span>
            </h2>
            <div className="space-y-3">
              {people.map((p) => (
                <div key={p.uid} className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2.5">
                    {p.photoURL ? (
                      <img src={p.photoURL} className="w-8 h-8 rounded-full object-cover border border-slate-800 shrink-0" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-850 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                        {p.displayName.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-white truncate">{p.displayName}</h3>
                      <span className="text-[9px] text-emerald-400 font-mono block">★ {p.explanation}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/profile/${p.displayName}`)}
                    className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold text-[10px] rounded-lg shrink-0"
                  >
                    Connect
                  </button>
                </div>
              ))}
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
                    className="px-3 py-1 bg-purple-500 text-slate-950 font-bold text-[10px] rounded-lg shrink-0"
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
                    className="px-3 py-1 bg-indigo-500 text-slate-950 font-bold text-[10px] rounded-lg shrink-0"
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
                  className="w-full py-1.5 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-lg"
                >
                  Buy Now
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
