import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { BackButton } from '../../components/BackButton';
import { makeOffer } from '../../services/marketplaceOfferService';
import type { MarketplaceListing3 } from '../../types/marketplace';
import {
  ShoppingBag,
  MessageSquare,
  Tag,
  RefreshCw,
  Bookmark,
  Flag,
  Trash2,
  Edit,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getOrCreateConversation } from '../../services/directMessageService';
import {
  toggleSaveListing,
  checkListingIsSaved,
  reportListing,
  deleteListing,
} from '../../services/marketplaceService';
import { CreateListingModal } from './CreateListingModal';

export const ListingDetailPage: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [listing, setListing] = useState<MarketplaceListing3 | null>(null);
  const [loading, setLoading] = useState(true);
  const [offerAmount, setOfferAmount] = useState('');
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Bookmark / Report / Edit Modal states
  const [saved, setSaved] = useState<boolean>(false);
  const [togglingSave, setTogglingSave] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>('');
  const [reporting, setReporting] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  const loadListing = async () => {
    if (!listingId) return;
    setLoading(true);
    try {
      const ref = doc(db, 'marketplaceListings', listingId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setListing({ id: snap.id, ...snap.data() } as MarketplaceListing3);
      } else {
        setListing(null);
      }

      if (currentUser) {
        const isSaved = await checkListingIsSaved(listingId, currentUser.uid);
        setSaved(isSaved);
      }
    } catch (err) {
      console.error('Failed to load listing detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListing();
  }, [listingId, currentUser]);

  const handleChatToBuy = async () => {
    if (!listing || !currentUser) return;
    try {
      // Fix Chat to Buy Bug: Navigate to correct conversation ID
      const conv = await getOrCreateConversation(
        listing.sellerId,
        currentUser,
        listing.sellerName || 'Seller'
      );
      navigate(`/messages/${conv.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to open conversation.');
    }
  };

  const handleMakeOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing || !currentUser || !offerAmount || submitting) return;

    const numAmount = parseFloat(offerAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid offer amount.');
      return;
    }

    setSubmitting(true);
    try {
      await makeOffer(
        listing.id,
        listing.title,
        currentUser.uid,
        userProfile?.displayName || 'Campus Buyer',
        userProfile?.photoURL || '',
        listing.sellerId,
        numAmount
      );
      toast.success('Offer submitted to seller!');
      setShowOfferModal(false);
      setOfferAmount('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit offer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'reserved' | 'sold') => {
    if (!listing || !currentUser || currentUser.uid !== listing.sellerId) return;
    try {
      const ref = doc(db, 'marketplaceListings', listing.id);
      await updateDoc(ref, { status: newStatus });
      setListing((prev) => (prev ? { ...prev, status: newStatus } : null));
      toast.success(`Listing status updated to ${newStatus.toUpperCase()}`);
    } catch (err) {
      toast.error('Failed to update listing status.');
    }
  };

  const handleSaveToggle = async () => {
    if (!listing || !currentUser || togglingSave) return;
    setTogglingSave(true);
    try {
      const active = await toggleSaveListing(listing.id, currentUser);
      setSaved(active);
      setListing((prev) => (prev ? { ...prev, saveCount: prev.saveCount + (active ? 1 : -1) } : null));
      toast.success(active ? 'Listing saved to bookmarks!' : 'Listing unsaved.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle save.');
    } finally {
      setTogglingSave(false);
    }
  };

  const handleReportListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing || !currentUser || !reportReason.trim() || reporting) return;
    setReporting(true);
    try {
      const res = await reportListing(listing.id, currentUser.uid, reportReason);
      if (res.alreadyReported) {
        toast.error('You have already reported this listing.');
      } else {
        toast.success('Listing reported successfully.');
        setShowReportModal(false);
        setReportReason('');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to report listing.');
    } finally {
      setReporting(false);
    }
  };

  const handleDeleteListing = async () => {
    if (!listing || !currentUser) return;
    if (!window.confirm('Are you sure you want to permanently delete this listing? This cannot be undone.')) return;
    try {
      await deleteListing(listing.id, currentUser.uid);
      toast.success('Listing deleted successfully.');
      navigate('/marketplace');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete listing.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-400 text-xs font-mono">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
          <span>Loading listing details...</span>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full text-center space-y-4">
          <p className="text-slate-400 text-xs">Listing not found or has been removed.</p>
          <button onClick={() => navigate('/marketplace')} className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl">
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const isSeller = currentUser?.uid === listing.sellerId;
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton customFallback="/marketplace" />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white truncate max-w-xs">{listing.title}</h1>
            <p className="text-[11px] text-amber-400 font-mono font-bold">₹{listing.price}</p>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center gap-2">
            {/* Bookmark button */}
            <button
              onClick={handleSaveToggle}
              disabled={togglingSave}
              className={`p-2 border rounded-xl transition-all ${
                saved
                  ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Save Listing"
            >
              <Bookmark className={`w-4 h-4 ${saved ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>

            {/* Report button */}
            {!isSeller && (
              <button
                onClick={() => setShowReportModal(true)}
                className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-rose-400 rounded-xl transition-all"
                title="Report Listing"
              >
                <Flag className="w-4 h-4" />
              </button>
            )}

            {/* Seller controls: Edit/Delete */}
            {isSeller && (
              <>
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-sky-400 rounded-xl transition-all"
                  title="Edit Listing"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDeleteListing}
                  className="p-2 bg-slate-900 border border-slate-800 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-all"
                  title="Delete Listing"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Images */}
          <div className="space-y-3">
            {listing.images && listing.images.length > 0 ? (
              <img src={listing.images[0]} alt={listing.title} className="w-full h-80 rounded-3xl object-cover border border-slate-800 shadow-xl" />
            ) : (
              <div className="w-full h-80 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                <ShoppingBag className="w-16 h-16" />
              </div>
            )}
          </div>

          {/* Listing Meta */}
          <div className="space-y-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {listing.status}
                </span>
                <span className="text-xs text-slate-400 font-mono">{listing.condition}</span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">{listing.title}</h2>
                <p className="text-2xl font-bold font-mono text-amber-400 mt-1">₹{listing.price}</p>
              </div>

              {listing.description && (
                <p className="text-xs text-slate-300 leading-relaxed pt-2 border-t border-slate-800">{listing.description}</p>
              )}

              {/* Seller Controls */}
              {isSeller && (
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">Update Status:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusChange('active')}
                      className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-xl"
                    >
                      Active
                    </button>
                    <button
                      onClick={() => handleStatusChange('reserved')}
                      className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-xl"
                    >
                      Reserved
                    </button>
                    <button
                      onClick={() => handleStatusChange('sold')}
                      className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-bold rounded-xl"
                    >
                      Sold
                    </button>
                  </div>
                </div>
              )}

              {/* Buyer Actions */}
              {!isSeller && currentUser && listing.status === 'active' && (
                <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                  <button
                    onClick={handleChatToBuy}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Chat to Buy</span>
                  </button>

                  <button
                    onClick={() => setShowOfferModal(true)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <Tag className="w-4 h-4 text-amber-400" />
                    <span>Make Offer</span>
                  </button>
                </div>
              )}
            </div>

            {/* Seller Card */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                {listing.sellerAvatar ? (
                  <img src={listing.sellerAvatar} alt={listing.sellerName} className="w-10 h-10 rounded-2xl object-cover border border-slate-700" />
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm">
                    {listing.sellerName[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-bold text-white">{listing.sellerName}</h4>
                  {listing.sellerUsername && <p className="text-[10px] text-amber-400 font-mono">@{listing.sellerUsername}</p>}
                </div>
              </div>

              <button
                onClick={() => navigate(`/profile/${listing.sellerUsername || listing.sellerId}`)}
                className="px-3 py-1.5 bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl"
              >
                Profile
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-400" />
              <span>Make an Offer</span>
            </h3>

            <form onSubmit={handleMakeOffer} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Your Offer Price (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  placeholder={`Asking ₹${listing.price}`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowOfferModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl"
                >
                  Submit Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-rose-500" />
                <span>Report Listing</span>
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReportListing} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Reason for report</label>
                <textarea
                  required
                  rows={3}
                  maxLength={300}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Explain why this listing violates campus guidelines (prohibited item, scam, etc.)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reporting}
                  className="flex-1 py-2 bg-rose-500 hover:bg-rose-450 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1"
                >
                  {reporting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Report</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Listing Modal */}
      <CreateListingModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        listing={listing}
        onCreated={loadListing}
      />
    </div>
  );
};
