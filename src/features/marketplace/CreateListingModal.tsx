import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { createListing, checkProhibitedKeywords } from '../../services/marketplaceService';
import type { MarketplaceCategory, ProductCondition, MarketplaceListing } from '../../types/marketplace';
import toast from 'react-hot-toast';
import { ShoppingBag, RefreshCw, X, Plus } from 'lucide-react';

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onListingCreated?: (listing: MarketplaceListing) => void;
}

const CATEGORIES: MarketplaceCategory[] = [
  'Books', 'Notes', 'Electronics', 'Laptops', 'Phones',
  'Accessories', 'Furniture', 'Cycles', 'Sports Equipment',
  'Clothing', 'Bags', 'Study Material', 'Hostel Items', 'Instruments', 'Other'
];

const CONDITIONS: { label: string; value: ProductCondition }[] = [
  { label: 'Brand New', value: 'new' },
  { label: 'Like New', value: 'like_new' },
  { label: 'Good', value: 'good' },
  { label: 'Fair', value: 'fair' },
  { label: 'Used', value: 'used' },
];

export const CreateListingModal: React.FC<CreateListingModalProps> = ({
  isOpen,
  onClose,
  onListingCreated,
}) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<MarketplaceCategory>('Books');
  const [price, setPrice] = useState<string>('');
  const [negotiable, setNegotiable] = useState<boolean>(true);
  const [condition, setCondition] = useState<ProductCondition>('good');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [locationArea, setLocationArea] = useState<string>('Academic Block');
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error('You must be logged in to create a listing.');
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error('Please enter a valid price.');
      return;
    }

    const prohibitedTerm = checkProhibitedKeywords(title, description);
    if (prohibitedTerm) {
      toast.error(`Listing contains prohibited term ("${prohibitedTerm}").`);
      return;
    }

    setSubmitting(true);
    try {
      const listing = await createListing(
        {
          title,
          description,
          category,
          price: numPrice,
          negotiable,
          condition,
          images: imageUrl.trim() ? [imageUrl.trim()] : [],
          locationArea,
        },
        currentUser
      );
      toast.success('Marketplace listing published! 🎉');
      if (onListingCreated) onListingCreated(listing);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            <span>Create Campus Listing</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Listing Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Engineering Mathematics Textbook (3rd Ed)"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MarketplaceCategory)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Condition *</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as ProductCondition)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Price (₹) *</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 500"
                min="0"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono font-bold"
              />
            </div>

            <div className="space-y-1 flex flex-col justify-end">
              <label className="flex items-center gap-2 px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer text-xs font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={negotiable}
                  onChange={(e) => setNegotiable(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0"
                />
                <span>Price Negotiable</span>
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe condition, edition, accessories included..."
              rows={3}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Product Image URL (Optional)</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Pickup Area</label>
              <input
                type="text"
                value={locationArea}
                onChange={(e) => setLocationArea(e.target.value)}
                placeholder="e.g. Block C / Girls Hostel"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
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
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Publish Listing</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
