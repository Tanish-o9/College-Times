import React from 'react';
import { History, X, Trash2 } from 'lucide-react';

interface RecentSearchesProps {
  searches: string[];
  onSelect: (query: string) => void;
  onRemove: (query: string, e: React.MouseEvent) => void;
  onClearAll: () => void;
}

export const RecentSearches: React.FC<RecentSearchesProps> = ({
  searches,
  onSelect,
  onRemove,
  onClearAll,
}) => {
  if (!searches || searches.length === 0) return null;

  return (
    <div className="p-5 bg-slate-900/90 border border-slate-800/90 rounded-3xl space-y-3 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">
          <History className="w-4 h-4 text-sky-400" />
          <span>Recent Searches</span>
        </div>

        <button
          onClick={onClearAll}
          className="text-[11px] font-mono text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
          <span>Clear All</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {searches.map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="px-3.5 py-1.5 bg-slate-950/90 hover:bg-slate-850 border border-slate-800 hover:border-sky-500/40 rounded-xl text-xs text-slate-300 flex items-center gap-2 transition-all cursor-pointer group shadow-sm"
          >
            <span>{q}</span>
            <X
              className="w-3 h-3 text-slate-500 group-hover:text-rose-400 transition-colors"
              onClick={(e) => onRemove(q, e)}
            />
          </button>
        ))}
      </div>
    </div>
  );
};
