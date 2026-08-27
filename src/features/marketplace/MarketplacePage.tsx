import React, { useEffect, useState, useMemo } from 'react';
import type { MarketplaceListing, MarketplaceCategory, ListingStatus } from '../../types/marketplace';
import { getMarketplaceListings } from '../../services/marketplaceService';
import { MarketplaceCard } from './MarketplaceCard';
import { CreateListingModal } from './CreateListingModal';
import { useAuth } from '../../hooks/useAuth';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  RefreshCw, 
  PackageCheck,
  AlertCircle
} from 'lucide-react';

type StatusFilter = 'All' | 'For Sale' | 'Reserved' | 'Sold' | 'My Listings';

const CATEGORIES: ('All' | MarketplaceCategory)[] = [
  'All', 'Books', 'Notes', 'Electronics', 'Laptops', 'Phones',
  'Accessories', 'Furniture', 'Cycles', 'Sports Equipment',
  'Hostel Items', 'Study Material', 'Other'
];

export const MarketplacePage: React.FC = () => {
  const { currentUser } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('For Sale');
  const [selectedCategory, setSelectedCategory] = useState<'All' | MarketplaceCategory>('All');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  // Debounce search query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchListings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMarketplaceListings(
        {
          sellerId: statusFilter === 'My Listings' ? currentUser?.uid : undefined,
        },
        30
      );
      setListings(data);
    } catch (err: any) {
      console.error('Failed to load marketplace listings:', err);
      setError(err.message || 'Failed to load marketplace listings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [statusFilter, currentUser]);

  const handleListingCreated = (newListing: MarketplaceListing) => {
    setListings((prev) => [newListing, ...prev]);
  };

  const handleListingUpdated = (listingId: string, status: string) => {
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, status: status as ListingStatus } : l))
    );
  };

  // Client-side filtering over fetched array
  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      // Status Filter
      const itemStatus = l.status || 'active';
      if (statusFilter === 'For Sale' && itemStatus !== 'active') return false;
      if (statusFilter === 'Reserved' && itemStatus !== 'reserved') return false;
      if (statusFilter === 'Sold' && itemStatus !== 'sold') return false;
      if (statusFilter === 'My Listings' && currentUser && l.sellerId !== currentUser.uid) return false;

      // Category Filter
      if (selectedCategory !== 'All' && l.category !== selectedCategory) return false;

      // Debounced Search Match
      if (debouncedSearch) {
        const titleMatch = l.title.toLowerCase().includes(debouncedSearch);
        const descMatch = l.description.toLowerCase().includes(debouncedSearch);
        if (!titleMatch && !descMatch) return false;
      }

      return true;
    });
  }, [listings, statusFilter, selectedCategory, debouncedSearch, currentUser]);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Campus Marketplace 2.0</h1>
          </div>
          <p className="text-xs text-slate-400">
            Buy & sell books, electronics, cycles, and study materials safely with campus peers.
          </p>
        </div>

        <button
          onClick={() => setIsFormOpen(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>List Item for Sale</span>
        </button>
      </div>

      {/* Search Bar & Status Tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search books, laptops, cycles, hostel items..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(['For Sale', 'Reserved', 'Sold', 'My Listings', 'All'] as StatusFilter[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
                statusFilter === tab
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-md'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Category Pill Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border shrink-0 ${
                selectedCategory === cat
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading campus listings...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-xs text-rose-300 font-semibold">{error}</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="p-12 bg-slate-900/60 border border-slate-800 rounded-3xl text-center space-y-3">
          <PackageCheck className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">No Listings Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No marketplace items match your selected filters. Be the first to list an item!
          </p>
          <button
            onClick={() => setIsFormOpen(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-semibold"
          >
            Create New Listing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredListings.map((listing) => (
            <MarketplaceCard
              key={listing.id}
              listing={listing}
              onListingUpdated={handleListingUpdated}
            />
          ))}
        </div>
      )}

      {/* Create Listing Modal */}
      <CreateListingModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onListingCreated={handleListingCreated}
      />
    </div>
  );
};
