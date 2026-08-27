import React, { useEffect, useState } from 'react';
import type { Post } from '../../types';
import type { MatchSuggestionResult } from '../../types/lostFound';
import { findMatchesForItem } from '../../services/lostFoundMatchingService';
import { Sparkles, MapPin, Tag } from 'lucide-react';

interface MatchSuggestionsProps {
  item: Post;
}

export const MatchSuggestions: React.FC<MatchSuggestionsProps> = ({ item }) => {
  const [matches, setMatches] = useState<MatchSuggestionResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!item) return;
    let mounted = true;

    const loadMatches = async () => {
      setLoading(true);
      try {
        const list = await findMatchesForItem(item, 30);
        if (mounted) setMatches(list);
      } catch (err) {
        // Silent catch for suggestions
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadMatches();
    return () => {
      mounted = false;
    };
  }, [item]);

  if (loading || matches.length === 0) return null;

  return (
    <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">
          Smart Match Suggestions ({matches.length})
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {matches.map((m) => (
          <div
            key={m.itemId}
            className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 hover:border-purple-500/40 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-white truncate max-w-[150px]">{m.title}</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                m.confidenceBand === 'High Match'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              }`}>
                {m.confidenceBand} ({m.matchScore}%)
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-purple-400" />
                {m.category}
              </span>
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 text-rose-400" />
                {m.location}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
