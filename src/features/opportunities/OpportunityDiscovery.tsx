import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Opportunity2 } from '../../types/opportunity';

export const OpportunityDiscovery: React.FC = () => {
  const navigate = useNavigate();
  const [featuredOpportunities, setFeaturedOpportunities] = useState<Opportunity2[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDiscovery = async () => {
      setLoading(true);
      try {
        const colRef = collection(db, 'opportunities');
        const snap = await getDocs(query(colRef, limit(4)));
        const items: Opportunity2[] = [];
        snap.docs.forEach((d) => items.push({ id: d.id, ...d.data() } as Opportunity2));
        setFeaturedOpportunities(items);
      } catch (err) {
        console.error('Failed to load opportunity discovery items:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDiscovery();
  }, []);

  if (loading || featuredOpportunities.length === 0) return null;

  return (
    <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <span>Opportunity Discovery</span>
        </h3>
        <span className="text-[10px] text-slate-500 font-mono">Recommended Picks</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {featuredOpportunities.map((opp) => (
          <div
            key={opp.id}
            onClick={() => navigate(`/opportunities/${opp.id}`)}
            className="p-3 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer hover:border-slate-700 transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-sky-500/10 text-sky-400">
                {opp.type}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{opp.workMode || 'Remote'}</span>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white truncate">{opp.title}</h4>
              <p className="text-[11px] text-slate-400 font-mono truncate">{opp.organization}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
