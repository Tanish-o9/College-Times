import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getListingOffers, reviewOffer } from '../../services/marketplaceOfferService';
import type { MarketplaceOffer } from '../../types/marketplace';
import toast from 'react-hot-toast';
import { Tag, RefreshCw, X, Check, XCircle } from 'lucide-react';

interface OfferListModalProps {
  listingId: string;
  listingTitle: string;
  sellerId: string;
  isOpen: boolean;
  onClose: () => void;
  onOfferAccepted?: () => void;
}

export const OfferListModal: React.FC<OfferListModalProps> = ({
  listingId,
  listingTitle,
  sellerId,
  isOpen,
  onClose,
  onOfferAccepted,
}) => {
  const { currentUser } = useAuth();
  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !listingId || !currentUser) return;
    let mounted = true;

    const loadOffers = async () => {
      setLoading(true);
      try {
        const list = await getListingOffers(listingId, 20);
        if (mounted) setOffers(list);
      } catch (err) {
        toast.error('Failed to load offers.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadOffers();
    return () => {
      mounted = false;
    };
  }, [isOpen, listingId, sellerId, currentUser]);

  if (!isOpen) return null;

  const handleReview = async (offerId: string, _buyerId: string, status: 'accepted' | 'rejected') => {
    if (!currentUser) return;
    setReviewingId(offerId);
    try {
      await reviewOffer(offerId, status, currentUser.uid);
      toast.success(status === 'accepted' ? 'Offer Accepted! Listing marked reserved.' : 'Offer Rejected.');
      setOffers((prev) =>
        prev.map((o) => (o.id === offerId ? { ...o, status } : o))
      );
      if (status === 'accepted' && onOfferAccepted) {
        onOfferAccepted();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to review offer.');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-400" />
            <span>Review Price Offers</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Offers received for <span className="font-bold text-white">"{listingTitle}"</span>.
        </p>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Loading offers...</span>
          </div>
        ) : offers.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500 italic">No price offers received yet.</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{offer.buyerName}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-emerald-400 font-mono">₹{offer.amount.toLocaleString()}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      offer.status === 'accepted'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : offer.status === 'rejected'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {offer.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {offer.status === 'pending' && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => handleReview(offer.id, offer.buyerId, 'rejected')}
                      disabled={reviewingId === offer.id}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleReview(offer.id, offer.buyerId, 'accepted')}
                      disabled={reviewingId === offer.id}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md"
                    >
                      {reviewingId === offer.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Accept Offer</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
