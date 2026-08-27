import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { makeOffer } from '../../services/marketplaceOfferService';
import toast from 'react-hot-toast';
import { Tag, RefreshCw, X, DollarSign } from 'lucide-react';

interface OfferModalProps {
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  sellerId: string;
  isOpen: boolean;
  onClose: () => void;
  onOfferSubmitted?: () => void;
}

export const OfferModal: React.FC<OfferModalProps> = ({
  listingId,
  listingTitle,
  listingPrice,
  sellerId,
  isOpen,
  onClose,
  onOfferSubmitted,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [amount, setAmount] = useState<string>(listingPrice ? String(listingPrice) : '');
  const [message, setMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error('You must be logged in to make an offer.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid offer amount.');
      return;
    }

    setSubmitting(true);
    try {
      await makeOffer(
        listingId,
        'Marketplace Item',
        currentUser.uid,
        userProfile?.displayName || 'Campus Buyer',
        userProfile?.photoURL || '',
        sellerId,
        numAmount
      );
      toast.success('Price offer submitted to seller!');
      if (onOfferSubmitted) onOfferSubmitted();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit offer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-400" />
            <span>Make a Price Offer</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Item: <span className="font-bold text-white">"{listingTitle}"</span> (Listed Price: ₹{listingPrice.toLocaleString()})
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Your Offer Amount (₹) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-slate-400 font-bold text-xs">₹</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 450"
                min="1"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-8 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Message to Seller (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Can pick up today near Academic Block..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
              <span>Send Offer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
