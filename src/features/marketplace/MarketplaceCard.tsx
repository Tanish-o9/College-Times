import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MarketplaceListing } from '../../types/marketplace';
import { useAuth } from '../../hooks/useAuth';
import { markListingStatus } from '../../services/marketplaceService';
import { toggleListingInterest, hasUserInterest } from '../../services/marketplaceOfferService';
import { OfferModal } from './OfferModal';
import { OfferListModal } from './OfferListModal';
import toast from 'react-hot-toast';
import { 
  Tag, 
  Heart, 
  MapPin, 
  User, 
  MessageCircle, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  ShieldCheck,
  PackageCheck
} from 'lucide-react';

interface MarketplaceCardProps {
  listing: MarketplaceListing;
  onListingUpdated?: (listingId: string, status: string) => void;
}

export const MarketplaceCard: React.FC<MarketplaceCardProps> = ({ listing, onListingUpdated }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<string>(listing.status || 'active');
  const [interestCount, setInterestCount] = useState<number>(listing.interestCount || 0);
  const [isInterested, setIsInterested] = useState<boolean>(false);
  const [togglingInterest, setTogglingInterest] = useState<boolean>(false);

  // Modals state
  const [isOfferModalOpen, setIsOfferModalOpen] = useState<boolean>(false);
  const [isOfferListOpen, setIsOfferListOpen] = useState<boolean>(false);

  const isSeller = currentUser?.uid === listing.sellerId;
  const isSold = status === 'sold';
  const isReserved = status === 'reserved';

  useEffect(() => {
    if (!listing.id || !currentUser) return;
    let mounted = true;

    hasUserInterest(listing.id, currentUser.uid).then((val) => {
      if (mounted) setIsInterested(val);
    });

    return () => {
      mounted = false;
    };
  }, [listing.id, currentUser]);

  const handleInterestToggle = async () => {
    if (!currentUser || !listing.id || togglingInterest) return;
    setTogglingInterest(true);

    try {
      const active = await toggleListingInterest(listing.id, listing.sellerId, currentUser);
      setIsInterested(active);
      setInterestCount((prev) => (active ? prev + 1 : Math.max(0, prev - 1)));
      toast.success(active ? 'Saved to interested items!' : 'Removed interest.');
    } catch (err: any) {
      toast.error('Failed to toggle interest.');
    } finally {
      setTogglingInterest(false);
    }
  };

  const handleMarkSold = async () => {
    if (!currentUser || !listing.id) return;
    try {
      await markListingStatus(listing.id, 'sold', currentUser);
      setStatus('sold');
      toast.success('Listing marked as Sold!');
      if (onListingUpdated) onListingUpdated(listing.id, 'sold');
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark listing as sold.');
    }
  };

  return (
    <article className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 relative overflow-hidden transition-all hover:border-slate-700">
      {/* Header Badges */}
      <div className="flex items-center justify-between gap-2">
        <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full text-xs font-bold flex items-center gap-1">
          <Tag className="w-3.5 h-3.5" />
          <span>{listing.category}</span>
        </span>

        <div className="flex items-center gap-2">
          {isSold ? (
            <span className="px-3 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-full text-xs font-bold flex items-center gap-1">
              <PackageCheck className="w-3.5 h-3.5" />
              <span>SOLD</span>
            </span>
          ) : isReserved ? (
            <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>RESERVED</span>
            </span>
          ) : (
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>ACTIVE</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Image */}
      {listing.images && listing.images.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-slate-800 max-h-52 bg-slate-950">
          <img src={listing.images[0]} alt={listing.title} loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Title & Price */}
      <div className="space-y-1">
        <h3 className="text-lg font-extrabold text-white tracking-tight leading-snug">
          {listing.title}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xl font-black text-emerald-400 font-mono">₹{listing.price.toLocaleString()}</span>
          {listing.negotiable && (
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-bold rounded-md">
              Negotiable
            </span>
          )}
          <span className="text-xs text-slate-400 uppercase font-semibold pl-1">
            Condition: {listing.condition.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">
        {listing.description}
      </p>

      {/* Details Row (Location & Seller) */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs text-slate-400">
        <span className="flex items-center gap-1 truncate">
          <MapPin className="w-3.5 h-3.5 text-rose-400" />
          {listing.locationArea || 'Campus'}
        </span>
        <span className="flex items-center gap-1 shrink-0 font-medium text-slate-300">
          <User className="w-3.5 h-3.5 text-slate-500" />
          {listing.sellerName}
        </span>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Interest Toggle Button */}
        <button
          onClick={handleInterestToggle}
          disabled={togglingInterest}
          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
            isInterested
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isInterested ? 'text-rose-400 fill-rose-400' : ''}`} />
          <span>{interestCount} Interested</span>
        </button>

        {/* Dynamic Controls based on Seller vs Buyer */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isSold && (
            isSeller ? (
              <>
                <button
                  onClick={() => setIsOfferListOpen(true)}
                  className="px-3.5 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  <span>Review Offers</span>
                </button>
                <button
                  onClick={handleMarkSold}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-600/20 hover:text-emerald-300 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold"
                >
                  Mark Sold
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsOfferModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Make Offer</span>
                </button>

                <button
                  onClick={() => navigate('/chat')}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Chat Seller</span>
                </button>
              </>
            )
          )}
        </div>
      </div>

      {/* Offer Modal */}
      {listing.id && (
        <OfferModal
          listingId={listing.id}
          listingTitle={listing.title}
          listingPrice={listing.price}
          sellerId={listing.sellerId}
          isOpen={isOfferModalOpen}
          onClose={() => setIsOfferModalOpen(false)}
        />
      )}

      {/* Offer List Modal */}
      {listing.id && (
        <OfferListModal
          listingId={listing.id}
          listingTitle={listing.title}
          sellerId={listing.sellerId}
          isOpen={isOfferListOpen}
          onClose={() => setIsOfferListOpen(false)}
          onOfferAccepted={() => setStatus('reserved')}
        />
      )}
    </article>
  );
};
