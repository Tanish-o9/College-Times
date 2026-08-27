import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Sparkles } from 'lucide-react';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { MarketplaceListing3 } from '../../types/marketplace';

export const MarketplaceDiscovery: React.FC = () => {
  const navigate = useNavigate();
  const [featuredListings, setFeaturedListings] = useState<MarketplaceListing3[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFeatured = async () => {
      setLoading(true);
      try {
        const colRef = collection(db, 'marketplaceListings');
        const snap = await getDocs(query(colRef, limit(4)));
        const items: MarketplaceListing3[] = [];
        snap.docs.forEach((d) => items.push({ id: d.id, ...d.data() } as MarketplaceListing3));
        setFeaturedListings(items);
      } catch (err) {
        console.error('Failed to load discovery items:', err);
      } finally {
        setLoading(false);
      }
    };
    loadFeatured();
  }, []);

  if (loading || featuredListings.length === 0) return null;

  return (
    <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Marketplace Discovery</span>
        </h3>
        <span className="text-[10px] text-slate-500 font-mono">Featured Picks</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {featuredListings.map((item) => (
          <div
            key={item.id}
            onClick={() => navigate(`/marketplace/${item.id}`)}
            className="p-3 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer hover:border-slate-700 transition-all space-y-2"
          >
            {item.images && item.images.length > 0 ? (
              <img src={item.images[0]} alt={item.title} className="w-full h-28 rounded-xl object-cover" />
            ) : (
              <div className="w-full h-28 rounded-xl bg-slate-900 flex items-center justify-center text-slate-600">
                <ShoppingBag className="w-8 h-8" />
              </div>
            )}
            <div>
              <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
              <p className="text-xs font-mono font-bold text-amber-400 mt-0.5">₹{item.price}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
