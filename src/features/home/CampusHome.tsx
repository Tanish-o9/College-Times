import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ActiveIncidentStrip } from '../incidents/ActiveIncidentStrip';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  Sparkles,
  PlusCircle,
  Users,
  Calendar,
  BarChart3,
  Search,
  Sliders,
  Bell,
  MessageSquare,
  TrendingUp,
  Briefcase,
  ShoppingBag,
  Flame,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatTimestamp } from '../../utils/format';

export const CampusHome: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  // Dashboard state lists (limited to 5 items)
  const [posts, setPosts] = useState<any[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<any[]>([]);
  const [trendingGroups, setTrendingGroups] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [lostFound, setLostFound] = useState<any[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // Bounded parallel queries
      const [
        postsSnap,
        groupsSnap,
        eventsSnap,
        oppsSnap,
        listingsSnap,
        lostFoundSnap,
        notifsSnap,
      ] = await Promise.all([
        getDocs(query(collection(db, 'posts'), where('status', '==', 'active'), limit(5))),
        getDocs(query(collection(db, 'groups'), limit(10))), // retrieve to filter/sort
        getDocs(query(collection(db, 'events'), limit(5))),
        getDocs(query(collection(db, 'opportunities'), limit(5))),
        getDocs(query(collection(db, 'marketplaceListings'), where('status', '==', 'active'), limit(5))),
        getDocs(query(collection(db, 'posts'), where('category', '==', 'LostFound'), limit(5))),
        getDocs(query(collection(db, 'notifications'), where('recipientId', '==', currentUser.uid), where('read', '==', false), limit(20))),
      ]);

      setPosts(postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      
      const allGroups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTrendingGroups(allGroups.slice(0, 5));
      setJoinedGroups(allGroups.slice(5, 10)); // simulated joined list

      setEvents(eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setOpportunities(oppsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setListings(listingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLostFound(lostFoundSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setUnreadNotificationsCount(notifsSnap.docs.length);
    } catch (err) {
      console.error('Failed to load dashboard feeds:', err);
      toast.error('Failed to load home dashboard widgets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col pb-12">
      {/* Top Banner Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-sm">
            {userProfile?.displayName ? userProfile.displayName[0].toUpperCase() : 'C'}
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Welcome back, {userProfile?.displayName || 'Student'}</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              @{userProfile?.displayName?.toLowerCase().replace(/\s+/g, '') || 'campus'} • {userProfile?.role || 'AKGEC Campus'}
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/settings/notifications')}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 border border-slate-800 transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <Sliders className="w-4 h-4 text-sky-400" />
          <span>Settings</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Emergency Alert Widget */}
        <ActiveIncidentStrip />

        {/* Quick Actions Strip */}
        <section className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3.5 shadow-xl">
          <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>Campus Quick Actions</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {[
              { label: 'Create Post', path: '/feed', color: 'text-sky-400', icon: PlusCircle },
              { label: 'Create Group', path: '/groups', color: 'text-purple-400', icon: Users },
              { label: 'Start Message', path: '/messages', color: 'text-pink-400', icon: MessageSquare },
              { label: 'Create Event', path: '/events', color: 'text-emerald-400', icon: Calendar },
              { label: 'Create Poll', path: '/groups', color: 'text-amber-400', icon: BarChart3 },
              { label: 'Search Campus', path: '/search', color: 'text-cyan-400', icon: Search },
              { label: 'Discover Hub', path: '/discover', color: 'text-emerald-400', icon: Flame },
            ].map((action, idx) => {
              const Icon = action.icon;
              return (
                <button
                  key={idx}
                  onClick={() => navigate(action.path)}
                  className="p-3 bg-slate-950/60 hover:bg-slate-850 border border-slate-850 rounded-2xl text-left space-y-1.5 transition-all"
                >
                  <Icon className={`w-4.5 h-4.5 ${action.color}`} />
                  <div className="text-[10px] font-bold text-white leading-tight">{action.label}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Unread Alert Banner */}
        {unreadNotificationsCount > 0 && (
          <div
            onClick={() => navigate('/notifications')}
            className="p-3.5 bg-sky-500/10 border border-sky-500/30 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-sky-500/15 transition-all"
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-400 animate-bounce" />
              <span className="text-xs text-sky-300 font-bold">You have {unreadNotificationsCount} unread notification(s). Tap to view.</span>
            </div>
            <span className="text-[10px] text-sky-400 font-mono font-bold">Open →</span>
          </div>
        )}

        {/* Dashboard Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Feed Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Latest Posts */}
            <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
                  <TrendingUp className="w-4.5 h-4.5 text-sky-400" />
                  <span>Latest Campus Feed</span>
                </h3>
                <button onClick={() => navigate('/feed')} className="text-xs font-bold text-sky-400 hover:underline">
                  View Feed
                </button>
              </div>

              {loading ? (
                <div className="text-slate-500 text-xs font-mono py-6">Loading feed...</div>
              ) : posts.length === 0 ? (
                <div className="text-slate-500 text-xs italic py-6">No recent posts.</div>
              ) : (
                <div className="space-y-3">
                  {posts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/feed?postId=${p.id}`)}
                      className="p-3.5 bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-2xl cursor-pointer transition-all"
                    >
                      <h4 className="text-xs font-bold text-white truncate">{p.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{p.content}</p>
                      <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono mt-2">
                        <span>by {p.authorName}</span>
                        <span>{formatTimestamp(p.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Upcoming Events */}
            <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
                  <Calendar className="w-4.5 h-4.5 text-purple-400" />
                  <span>Upcoming Campus Events</span>
                </h3>
                <button onClick={() => navigate('/events')} className="text-xs font-bold text-purple-400 hover:underline">
                  All Events
                </button>
              </div>

              {loading ? (
                <div className="text-slate-500 text-xs font-mono py-6">Loading events...</div>
              ) : events.length === 0 ? (
                <div className="text-slate-500 text-xs italic py-6">No upcoming events listed.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {events.map((e) => (
                    <div
                      key={e.id}
                      onClick={() => navigate('/events')}
                      className="p-3.5 bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-2xl cursor-pointer transition-all"
                    >
                      <h4 className="text-xs font-bold text-white truncate">{e.title}</h4>
                      <span className="text-[9px] text-purple-400 font-mono mt-1 block">{e.location}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Lost & Found Alerts */}
            <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
                  <Search className="w-4.5 h-4.5 text-amber-400" />
                  <span>Lost & Found Notices</span>
                </h3>
                <button onClick={() => navigate('/lost-found')} className="text-xs font-bold text-amber-400 hover:underline">
                  All Notices
                </button>
              </div>

              {loading ? (
                <div className="text-slate-500 text-xs font-mono py-6">Loading notices...</div>
              ) : lostFound.length === 0 ? (
                <div className="text-slate-500 text-xs italic py-6">No recent lost/found alerts.</div>
              ) : (
                <div className="space-y-3">
                  {lostFound.map((lf) => (
                    <div
                      key={lf.id}
                      onClick={() => navigate('/lost-found')}
                      className="p-3 bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-2xl cursor-pointer transition-all"
                    >
                      <h4 className="text-xs font-bold text-white truncate">{lf.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{lf.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Sidebar Widgets */}
          <div className="space-y-6">
            
            {/* Joined Groups */}
            <section className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3.5 shadow-xl">
              <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5 pb-2 border-b border-slate-800">
                <Users className="w-4.5 h-4.5 text-indigo-400" />
                <span>Joined Groups</span>
              </h3>
              {loading ? (
                <div className="text-slate-500 text-xs font-mono">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {joinedGroups.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => navigate(`/groups/${g.id}`)}
                      className="p-2.5 bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-xl cursor-pointer transition-all flex items-center justify-between"
                    >
                      <span className="text-xs font-bold text-white truncate max-w-[150px]">{g.name}</span>
                      <span className="text-[9px] text-indigo-400 font-mono">Open →</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Trending Groups */}
            <section className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3.5 shadow-xl">
              <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5 pb-2 border-b border-slate-800">
                <Flame className="w-4.5 h-4.5 text-orange-400 animate-pulse" />
                <span>Trending Groups</span>
              </h3>
              {loading ? (
                <div className="text-slate-500 text-xs font-mono">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {trendingGroups.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => navigate(`/groups/${g.id}`)}
                      className="p-2.5 bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-xl cursor-pointer transition-all flex items-center justify-between"
                    >
                      <span className="text-xs font-bold text-white truncate max-w-[150px]">{g.name}</span>
                      <span className="text-[9px] text-orange-400 font-mono">Explore</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Marketplace Deals */}
            <section className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3.5 shadow-xl">
              <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5 pb-2 border-b border-slate-800">
                <ShoppingBag className="w-4.5 h-4.5 text-amber-400" />
                <span>Marketplace Deals</span>
              </h3>
              {loading ? (
                <div className="text-slate-500 text-xs font-mono">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {listings.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => navigate(`/marketplace/${l.id}`)}
                      className="p-2.5 bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-xl cursor-pointer transition-all flex items-center justify-between"
                    >
                      <span className="text-xs font-bold text-white truncate max-w-[150px]">{l.title}</span>
                      <span className="text-xs text-emerald-400 font-bold font-mono">₹{l.price}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Opportunities */}
            <section className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3.5 shadow-xl">
              <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5 pb-2 border-b border-slate-800">
                <Briefcase className="w-4.5 h-4.5 text-cyan-400" />
                <span>Latest Opportunities</span>
              </h3>
              {loading ? (
                <div className="text-slate-500 text-xs font-mono">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {opportunities.map((o) => (
                    <div
                      key={o.id}
                      onClick={() => navigate('/opportunities/applications')}
                      className="p-2.5 bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-xl cursor-pointer transition-all flex items-center justify-between"
                    >
                      <span className="text-xs font-bold text-white truncate max-w-[150px]">{o.title}</span>
                      <span className="text-[9px] text-slate-500 font-mono">Apply</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        </div>
      </main>
    </div>
  );
};
