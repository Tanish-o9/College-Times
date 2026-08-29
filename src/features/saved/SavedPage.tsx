import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getUserSavedPosts } from '../../services/postBookmarkService';
import { getSavedOpportunities } from '../../services/opportunitySaveService';
import { getSavedListings } from '../../services/marketplaceService';
import { getUserGroupIds, getGroupById } from '../../services/groupService';
import { getPostById } from '../../services/postService';
import {
  Bookmark,
  Newspaper,
  ShoppingBag,
  Briefcase,
  Users,
  RefreshCw,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { toggleSavePost } from '../../services/postBookmarkService';
import { toggleSaveOpportunity } from '../../services/opportunitySaveService';
import { getSavedEvents, toggleSaveEvent } from '../../services/eventService';
import type { Post, CampusEvent } from '../../types/models';
import type { Opportunity } from '../../types/opportunity';
import type { MarketplaceListing } from '../../types/marketplace';
import type { CampusGroup } from '../../types/group';

type SavedCategory = 'posts' | 'marketplace' | 'opportunities' | 'groups' | 'events';

const CATEGORY_TABS: { id: SavedCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'posts', label: 'Posts', icon: <Newspaper className="w-4 h-4" /> },
  { id: 'marketplace', label: 'Marketplace', icon: <ShoppingBag className="w-4 h-4" /> },
  { id: 'opportunities', label: 'Opportunities', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'groups', label: 'Groups', icon: <Users className="w-4 h-4" /> },
  { id: 'events', label: 'Events', icon: <Calendar className="w-4 h-4" /> },
];

export const SavedPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [activeCategory, setActiveCategory] = useState<SavedCategory>('posts');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedMarketplace, setSavedMarketplace] = useState<MarketplaceListing[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<Opportunity[]>([]);
  const [savedGroups, setSavedGroups] = useState<CampusGroup[]>([]);
  const [savedEvents, setSavedEvents] = useState<CampusEvent[]>([]);

  const loadCategory = useCallback(async (category: SavedCategory) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      switch (category) {
        case 'posts': {
          const postIds = await getUserSavedPosts(currentUser.uid);
          const posts = await Promise.all(
            postIds.map((id) => getPostById(id).catch(() => null))
          );
          setSavedPosts(posts.filter((p): p is Post => p !== null));
          break;
        }
        case 'marketplace': {
          const listings = await getSavedListings(currentUser);
          setSavedMarketplace(listings);
          break;
        }
        case 'opportunities': {
          const opps = await getSavedOpportunities(currentUser);
          setSavedOpportunities(opps);
          break;
        }
        case 'groups': {
          // Saved / joined groups
          const groupIds = await getUserGroupIds(currentUser.uid);
          const groups = await Promise.all(
            groupIds.map((id) => getGroupById(id).catch(() => null))
          );
          setSavedGroups(groups.filter((g): g is CampusGroup => g !== null));
          break;
        }
        case 'events': {
          const evs = await getSavedEvents(currentUser);
          setSavedEvents(evs);
          break;
        }
      }
    } catch (err) {
      toast.error('Failed to load saved content.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadCategory(activeCategory);
  }, [activeCategory, loadCategory]);

  const handleUnsavePost = async (postId: string) => {
    if (!currentUser) return;
    try {
      await toggleSavePost(postId, currentUser);
      setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success('Post removed from saved.');
    } catch {
      toast.error('Failed to unsave post.');
    }
  };

  const handleUnsaveOpportunity = async (oppId: string) => {
    if (!currentUser) return;
    try {
      await toggleSaveOpportunity(oppId, currentUser);
      setSavedOpportunities((prev) => prev.filter((o) => (o as any).id !== oppId));
      toast.success('Opportunity removed from saved.');
    } catch {
      toast.error('Failed to unsave.');
    }
  };

  const handleUnsaveEvent = async (eventId: string) => {
    if (!currentUser) return;
    try {
      await toggleSaveEvent(eventId, currentUser);
      setSavedEvents((prev) => prev.filter((e) => e.id !== eventId));
      toast.success('Event removed from saved.');
    } catch {
      toast.error('Failed to unsave event.');
    }
  };

  const filteredPosts = savedPosts.filter((p) =>
    !searchQuery || p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredMarketplace = savedMarketplace.filter((l) =>
    !searchQuery || l.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredOpportunities = savedOpportunities.filter((o) =>
    !searchQuery || o.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredGroups = savedGroups.filter((g) =>
    !searchQuery || g.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredEvents = savedEvents.filter((e) =>
    !searchQuery || e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const countForCategory = (cat: SavedCategory) => {
    switch (cat) {
      case 'posts': return savedPosts.length;
      case 'marketplace': return savedMarketplace.length;
      case 'opportunities': return savedOpportunities.length;
      case 'groups': return savedGroups.length;
      case 'events': return savedEvents.length;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col pb-12">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-sky-400" />
            <span>Saved</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-mono">Your bookmarked content</p>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter saved content..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-800 pb-2">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeCategory === tab.id
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {countForCategory(tab.id) > 0 && (
                <span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 text-[9px] font-bold rounded-full">
                  {countForCategory(tab.id)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-8 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading saved content...</span>
          </div>
        )}

        {/* Posts */}
        {!loading && activeCategory === 'posts' && (
          <div className="space-y-3">
            {filteredPosts.length === 0 ? (
              <EmptyState
                icon={<Newspaper className="w-8 h-8 text-slate-600" />}
                title="No saved posts"
                description="Posts you bookmark will appear here."
              />
            ) : filteredPosts.map((post) => (
              <div
                key={post.id}
                className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-start justify-between gap-3 hover:border-slate-700 transition-all cursor-pointer"
                onClick={() => navigate(`/feed?postId=${post.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white line-clamp-2">{post.title || post.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-500 font-mono">{post.authorName}</span>
                    <span className="text-[10px] text-slate-600">·</span>
                    <span className="text-[10px] text-slate-500">{post.category}</span>
                  </div>
                  {post.content && post.title && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{post.content}</p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnsavePost(post.id!); }}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                  title="Remove from saved"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Marketplace */}
        {!loading && activeCategory === 'marketplace' && (
          <div className="space-y-3">
            {filteredMarketplace.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="w-8 h-8 text-slate-600" />}
                title="No saved listings"
                description="Marketplace items you save will appear here."
              />
            ) : filteredMarketplace.map((listing) => (
              <div
                key={(listing as any).id}
                onClick={() => navigate(`/marketplace/${(listing as any).id}`)}
                className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-start gap-3 hover:border-slate-700 transition-all cursor-pointer"
              >
                {listing.images?.[0] && (
                  <img src={listing.images[0]} className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0" alt="" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{listing.title}</p>
                  <p className="text-[11px] text-sky-400 font-bold mt-0.5">₹{listing.price?.toLocaleString?.() ?? listing.price}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{listing.category}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* Opportunities */}
        {!loading && activeCategory === 'opportunities' && (
          <div className="space-y-3">
            {filteredOpportunities.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="w-8 h-8 text-slate-600" />}
                title="No saved opportunities"
                description="Job and internship listings you save will appear here."
              />
            ) : filteredOpportunities.map((opp) => (
              <div
                key={(opp as any).id}
                className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-start justify-between gap-3 hover:border-slate-700 transition-all cursor-pointer"
                onClick={() => navigate(`/discover?tab=opportunities&id=${(opp as any).id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{opp.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{opp.organizationName}</p>
                  {opp.deadline && (
                    <p className="text-[10px] text-amber-400 font-mono mt-1">
                      Deadline: {new Date(opp.deadline).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnsaveOpportunity((opp as any).id!); }}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                  title="Remove from saved"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Groups */}
        {!loading && activeCategory === 'groups' && (
          <div className="space-y-3">
            {filteredGroups.length === 0 ? (
              <EmptyState
                icon={<Users className="w-8 h-8 text-slate-600" />}
                title="No joined groups"
                description="Groups you join will appear here."
              />
            ) : filteredGroups.map((group) => (
              <div
                key={group.id}
                onClick={() => navigate(`/groups/${group.id}`)}
                className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3 hover:border-slate-700 transition-all cursor-pointer"
              >
                {group.iconUrl ? (
                  <img src={group.iconUrl} className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 font-bold text-sm shrink-0">
                    {group.name?.charAt(0) || 'G'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{group.name}</p>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{group.description}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{group.memberCount} members</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* Events */}
        {!loading && activeCategory === 'events' && (
          <div className="space-y-3">
            {filteredEvents.length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-8 h-8 text-slate-600" />}
                title="No saved events"
                description="Events you bookmark will appear here."
              />
            ) : filteredEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`)}
                className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-start justify-between gap-3 hover:border-slate-700 transition-all cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{event.title}</p>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{event.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                    <span>📍 {event.location}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnsaveEvent(event.id!); }}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all shrink-0"
                  title="Remove from saved"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

// ─── Reusable Empty State ──────────────────────────────────────────────────────
const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
    <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
      {icon}
    </div>
    <p className="text-sm font-bold text-slate-300">{title}</p>
    <p className="text-xs text-slate-500 max-w-xs">{description}</p>
  </div>
);
