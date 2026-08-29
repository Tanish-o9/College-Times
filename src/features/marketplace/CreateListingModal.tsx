import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { MarketplaceCategory, MarketplaceListing3 } from '../../types/marketplace';
import { ShoppingBag, X, Upload, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { editListing } from '../../services/marketplaceService';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  listing?: MarketplaceListing3 | null;
}

const categories: MarketplaceCategory[] = [
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

export const CreateListingModal: React.FC<CreateListingModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  listing = null,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory>('Electronics');
  const [condition, setCondition] = useState<'Brand New' | 'Like New' | 'Good' | 'Fair' | 'Poor'>('Like New');
  const [locationArea, setLocationArea] = useState('');
  const [negotiable, _setNegotiable] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasChanges = (
    title !== (listing?.title || '') ||
    description !== (listing?.description || '') ||
    price !== (listing?.price ? String(listing.price) : '') ||
    locationArea !== (listing?.locationArea || '') ||
    selectedFile !== null
  );

  const handleCloseSafe = () => {
    if (hasChanges) {
      if (window.confirm('Discard unsaved changes?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  useOverlayBackHandler(isOpen, handleCloseSafe);

  useEffect(() => {
    if (isOpen) {
      setTitle(listing?.title || '');
      setDescription(listing?.description || '');
      setPrice(listing?.price ? String(listing.price) : '');
      setCategory(listing?.category || 'Electronics');
      setCondition(listing?.condition || 'Like New');
      setLocationArea(listing?.locationArea || '');
      setSelectedFile(null);
    }
  }, [isOpen, listing]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !title.trim() || !price || submitting) return;

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error('Please enter a valid price.');
      return;
    }

    setSubmitting(true);
    try {
      if (listing) {
        // Edit mode
        let imageUrls = listing.images || [];
        if (selectedFile) {
          const fileRef = ref(
            storage,
            `marketplaceMedia/${listing.id}/${currentUser.uid}/${Date.now()}_${selectedFile.name}`
          );
          await uploadBytes(fileRef, selectedFile);
          const url = await getDownloadURL(fileRef);
          imageUrls = [url]; // Overwrite or add to image array
        }

        await editListing(listing.id, currentUser.uid, {
          title: title.trim(),
          description: description.trim(),
          price: numPrice,
          category,
          condition,
          images: imageUrls,
          locationArea: locationArea.trim(),
          negotiable,
        });

        toast.success('Listing updated successfully!');
      } else {
        // Create mode
        const listingId = `list_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        let imageUrls: string[] = [];

        if (selectedFile) {
          const fileRef = ref(
            storage,
            `marketplaceMedia/${listingId}/${currentUser.uid}/${Date.now()}_${selectedFile.name}`
          );
          await uploadBytes(fileRef, selectedFile);
          const url = await getDownloadURL(fileRef);
          imageUrls.push(url);
        }

        const listingRef = doc(db, 'marketplaceListings', listingId);
        await setDoc(listingRef, {
          id: listingId,
          title: title.trim(),
          description: description.trim(),
          price: numPrice,
          category,
          condition,
          images: imageUrls,
          sellerId: currentUser.uid,
          sellerName: userProfile?.displayName || 'Campus Student',
          sellerUsername: (userProfile as any)?.username || '',
          sellerAvatar: userProfile?.photoURL || '',
          locationArea: locationArea.trim(),
          negotiable,
          status: 'active',
          viewCount: 0,
          saveCount: 0,
          createdAt: serverTimestamp(),
        });

        toast.success('Listing published successfully!');
      }

      if (onCreated) onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
            <span>Create Campus Listing</span>
          </h3>
          <button onClick={handleCloseSafe} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 scrollbar-none">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Engineering Physics Textbook 2nd Ed"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Price (₹) *</label>
              <input
                type="number"
                required
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 450"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MarketplaceCategory)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide details about condition, usage, reason for selling..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
              >
                <option value="Brand New">Brand New</option>
                <option value="Like New">Like New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Location Area</label>
              <input
                type="text"
                value={locationArea}
                onChange={(e) => setLocationArea(e.target.value)}
                placeholder="e.g. Hostel 3 / CS Block"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Listing Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-amber-400 hover:file:bg-slate-700"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleCloseSafe}
              className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>Publish Listing</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
