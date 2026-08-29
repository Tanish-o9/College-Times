import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { Opportunity } from '../../types/opportunity';
import { getSavedOpportunities } from '../../services/opportunitySaveService';
import { OpportunityCard } from './OpportunityCard';
import { Bookmark, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SavedOpportunitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    let mounted = true;

    const loadSaved = async () => {
      setLoading(true);
      try {
        const list = await getSavedOpportunities(currentUser);
        if (mounted) setOpportunities(list);
      } catch (err: any) {
        if (mounted) setError('Failed to load saved opportunities.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSaved();
    return () => {
      mounted = false;
    };
  }, [currentUser]);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <button
        onClick={() => navigate('/opportunities')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Opportunities</span>
      </button>

      <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <span className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
          <Bookmark className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Saved Opportunities</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Bookmarked placements, internships, hackathons, and scholarships.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
          <span>Loading saved opportunities...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-xs text-rose-300 font-semibold">{error}</p>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="p-12 bg-slate-900/60 border border-slate-800 rounded-3xl text-center space-y-3">
          <Bookmark className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">No Saved Opportunities</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click the bookmark icon on any opportunity card to save it here for quick access.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              onOpportunityDeleted={(id) => setOpportunities((prev) => prev.filter((o) => o.id !== id))}
              onOpportunityUpdated={() => {
                // reload
                getSavedOpportunities(currentUser!).then(setOpportunities);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
