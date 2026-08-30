import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketplaceDiscovery } from './MarketplaceDiscovery';
import { CreateListingModal } from './CreateListingModal';
import type { MarketplaceListing3, MarketplaceCategory } from '../../types/marketplace';
import {
  ShoppingBag,
  Plus,
  Search,
  ArrowLeft,
  RefreshCw,
  Bookmark,
  DollarSign,
  SlidersHorizontal,
} from 'lucide-react';
import { collection, query, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { getSavedListings } from '../../services/marketplaceService';
import { useScrollRestoration } from '../../hooks/useScrollRestoration';

const categories: (MarketplaceCategory | 'All')[] = [
  'All',
  'Electronics',
  'Books',
  'Notes',
  'Furniture',
  'Cycles',
  'Bikes',
  'Clothing',
  'Hostel Items',
  'Study Material',
  'Accessories',
  'Services',
  'Other',
];

export const MarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory | 'All'>('All');
  const [listings, setListings] = useState<MarketplaceListing3[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [viewSaved, setViewSaved] = useState(false);
  const [viewMyListings, setViewMyListings] = useState(false);

  useScrollRestoration('marketplace', !loading);

  const loadListings = async () => {
    setLoading(true);
    try {
      if (viewSaved && currentUser) {
        const savedList = await getSavedListings(currentUser);
        setListings(savedList);
      } else if (viewMyListings && currentUser) {
        const colRef = collection(db, 'marketplaceListings');
        const snap = await getDocs(query(colRef, where('sellerId', '==', currentUser.uid), limit(40)));
        const items: MarketplaceListing3[] = [];
        snap.docs.forEach((d) => items.push({ id: d.id, ...d.data() } as MarketplaceListing3));
        setListings(items);
      } else {
        const colRef = collection(db, 'marketplaceListings');
        const snap = await getDocs(query(colRef, limit(40)));
        const items: MarketplaceListing3[] = [];
        snap.docs.forEach((d) => items.push({ id: d.id, ...d.data() } as MarketplaceListing3));
        setListings(items);
      }
    } catch (err) {
      console.error('Failed to load marketplace listings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, [viewSaved, viewMyListings, currentUser]);

  const filteredAndSortedListings = React.useMemo(() => {
    let result = listings.filter((l) => {
      const matchesCat = selectedCategory === 'All' || l.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.description.toLowerCase().includes(searchQuery.toLowerCase());

      const priceNum = l.price;
      const minNum = parseFloat(minPrice);
      const maxNum = parseFloat(maxPrice);
      const matchesMin = isNaN(minNum) || priceNum >= minNum;
      const matchesMax = isNaN(maxNum) || priceNum <= maxNum;

      // Only display active listings, unless it's own listing or saved listings
      const isVisible = l.status === 'active' || l.sellerId === currentUser?.uid || viewSaved || viewMyListings;

      return matchesCat && matchesSearch && matchesMin && matchesMax && isVisible;
    });

    if (sortBy === 'price_asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => b.price - a.price);
    } else {
      // newest first
      result.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });
    }

    return result;
  }, [listings, selectedCategory, searchQuery, minPrice, maxPrice, sortBy, currentUser, viewSaved, viewMyListings]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-2xl border-b border-slate-800/80 px-4 py-3.5 sm:px-6 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 border border-slate-800 hover:border-slate-700 hover:-translate-y-0.5 transition-all cursor-pointer active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-400 animate-pulse" />
              <span className="bg-gradient-to-r from-amber-300 via-rose-300 to-purple-300 bg-clip-text text-transparent font-extrabold">
                Campus Marketplace
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Buy & Sell within College Community</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentUser && (
            <>
              <button
                onClick={() => {
                  setViewSaved(!viewSaved);
                  setViewMyListings(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition-all duration-200 cursor-pointer active:scale-95 ${
                  viewSaved
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${viewSaved ? 'fill-amber-400 text-amber-400' : ''}`} />
                <span className="hidden sm:inline">Saved</span>
              </button>

              <button
                onClick={() => {
                  setViewMyListings(!viewMyListings);
                  setViewSaved(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition-all duration-200 cursor-pointer active:scale-95 ${
                  viewMyListings
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <span className="hidden sm:inline">My Listings</span>
              </button>
            </>
          )}

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.3)] hover:-translate-y-0.5 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Sell Item</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative">
        {/* Soft Background Colorful Ambient Aura */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-72 bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-purple-500/20 blur-3xl opacity-80 pointer-events-none rounded-full animate-gradient-x animate-float-slow" />
        {/* Discovery Component */}
        <MarketplaceDiscovery />

        {/* Filters and Inputs Toolbar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search marketplace items, textbooks, cycles..."
              className="w-full bg-slate-950 border border-slate-850 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Min Price */}
            <div className="relative flex items-center">
              <DollarSign className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
              <input
                type="number"
                placeholder="Min Price (₹)"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Max Price */}
            <div className="relative flex items-center">
              <DollarSign className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
              <input
                type="number"
                placeholder="Max Price (₹)"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="relative flex items-center">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 appearance-none font-medium"
              >
                <option value="newest">Sort: Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-t border-slate-800/80 pt-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-850'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            <span>Loading marketplace listings...</span>
          </div>
        ) : filteredAndSortedListings.length === 0 ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
            No listings found matching the filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredAndSortedListings.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/marketplace/${item.id}`)}
                className="p-5 bg-slate-900 border-2 border-slate-800 rounded-3xl cursor-pointer hover:border-amber-500/50 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-500/15 transition-all duration-200 ease-out space-y-3 shadow-2xl flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {item.images && item.images.length > 0 ? (
                    <img src={item.images[0]} alt={item.title} className="w-full h-40 rounded-2xl object-cover" />
                  ) : (
                    <div className="w-full h-40 rounded-2xl bg-slate-950 flex items-center justify-center text-slate-700">
                      <ShoppingBag className="w-12 h-12" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-slate-800 text-amber-400">
                        {item.category}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{item.condition}</span>
                    </div>

                    <h3 className="text-sm font-bold text-white truncate">{item.title}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2">{item.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 mt-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-mono font-bold text-amber-400">₹{item.price}</p>
                    {viewMyListings && (
                      <p className="text-[10px] text-slate-500 font-mono">
                        👀 {item.viewCount || 0} views • 💾 {item.saveCount || 0} saves
                      </p>
                    )}
                  </div>
                  {item.status !== 'active' && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {item.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <CreateListingModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={loadListings}
      />
    </div>
  );
};
