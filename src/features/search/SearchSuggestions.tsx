import React from 'react';
import type { SearchSuggestion } from '../../types/search';
import {
  User,
  Users,
  Calendar,
  Newspaper,
  ShoppingBag,
  Briefcase,
  HelpCircle,
  FileText,
  GraduationCap,
  ChevronRight,
  Search,
  Tag,
} from 'lucide-react';

interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  query: string;
  selectedIndex?: number;
  onSelect: (url: string) => void;
  onViewAll: () => void;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  suggestions,
  query,
  selectedIndex = -1,
  onSelect,
  onViewAll,
}) => {
  if (!query.trim() || suggestions.length === 0) return null;

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="w-4 h-4 text-sky-400" />;
      case 'group':
        return <Users className="w-4 h-4 text-indigo-400" />;
      case 'event':
        return <Calendar className="w-4 h-4 text-purple-400" />;
      case 'post':
        return <Newspaper className="w-4 h-4 text-emerald-400" />;
      case 'lost_found':
        return <HelpCircle className="w-4 h-4 text-amber-400" />;
      case 'marketplace':
        return <ShoppingBag className="w-4 h-4 text-pink-400" />;
      case 'opportunity':
        return <Briefcase className="w-4 h-4 text-orange-400" />;
      case 'resource':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      case 'academic':
        return <GraduationCap className="w-4 h-4 text-emerald-400" />;
      default:
        return <Tag className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-800/60 max-h-96 overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="p-2.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider bg-slate-950/60 flex items-center justify-between px-3.5">
        <span>Campus Suggestions</span>
        <span>{suggestions.length} matches</span>
      </div>

      <div className="divide-y divide-slate-800/40">
        {suggestions.map((item, idx) => {
          const isSelected = selectedIndex === idx;
          return (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => onSelect(item.url)}
              className={`w-full p-3 text-left transition-colors flex items-center justify-between gap-3 group cursor-pointer ${
                isSelected ? 'bg-sky-500/15 border-l-4 border-sky-500 pl-3' : 'hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                  {getEntityIcon(item.type)}
                </div>
                <div className="min-w-0">
                  <span
                    className={`text-xs font-bold block truncate transition-colors ${
                      isSelected ? 'text-sky-300' : 'text-white group-hover:text-sky-400'
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate block font-mono">
                    {item.category} • {item.subtitle || item.type}
                  </span>
                </div>
              </div>

              <ChevronRight
                className={`w-4 h-4 transition-colors shrink-0 ${
                  isSelected ? 'text-sky-400' : 'text-slate-500 group-hover:text-sky-400'
                }`}
              />
            </button>
          );
        })}
      </div>

      <button
        onClick={onViewAll}
        className="w-full p-3 bg-slate-950/80 hover:bg-slate-900 text-sky-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        <Search className="w-3.5 h-3.5" />
        <span>View all results for "{query}"</span>
      </button>
    </div>
  );
};
