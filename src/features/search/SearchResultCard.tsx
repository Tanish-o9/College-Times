import React from 'react';
import type { SearchResultItem } from '../../types/search';
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
  Lock,
  Globe,
  Tag,
} from 'lucide-react';

interface SearchResultCardProps {
  item: SearchResultItem;
  query: string;
  onNavigate: (url: string) => void;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({ item, query, onNavigate }) => {
  const getEntityIcon = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'user':
        return <User className="w-5 h-5 text-sky-400" />;
      case 'group':
        return <Users className="w-5 h-5 text-indigo-400" />;
      case 'event':
        return <Calendar className="w-5 h-5 text-purple-400" />;
      case 'post':
        return <Newspaper className="w-5 h-5 text-emerald-400" />;
      case 'lost_found':
        return <HelpCircle className="w-5 h-5 text-amber-400" />;
      case 'marketplace':
        return <ShoppingBag className="w-5 h-5 text-pink-400" />;
      case 'opportunity':
        return <Briefcase className="w-5 h-5 text-orange-400" />;
      case 'resource':
        return <FileText className="w-5 h-5 text-cyan-400" />;
      case 'academic':
        return <GraduationCap className="w-5 h-5 text-emerald-400" />;
      default:
        return <Tag className="w-5 h-5 text-slate-400" />;
    }
  };

  const renderHighlightedText = (text?: string) => {
    if (!text) return null;
    const cleanQ = query.trim();
    if (!cleanQ) return <span>{text}</span>;

    try {
      const escaped = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
      return (
        <span>
          {parts.map((part, i) =>
            part.toLowerCase() === cleanQ.toLowerCase() ? (
              <mark key={i} className="bg-sky-500/20 text-sky-300 font-bold px-0.5 rounded">
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </span>
      );
    } catch {
      return <span>{text}</span>;
    }
  };

  const getActionLabel = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'user':
        return 'View Profile';
      case 'group':
        return 'View Group';
      case 'event':
        return 'View Event';
      case 'post':
        return 'View Post';
      case 'marketplace':
        return 'View Listing';
      case 'opportunity':
        return 'View Opportunity';
      case 'lost_found':
        return 'View Record';
      case 'academic':
        return 'Open Subject';
      default:
        return 'View Detail';
    }
  };

  return (
    <div
      onClick={() => onNavigate(item.url)}
      className="p-4 bg-slate-900/90 hover:bg-slate-850 border border-slate-800/80 hover:border-sky-500/40 rounded-2xl transition-all duration-200 cursor-pointer group shadow-md hover:shadow-xl hover:-translate-y-0.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
    >
      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
        {/* Avatar or Icon */}
        <div className="w-11 h-11 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:border-sky-500/30 transition-colors">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : item.avatar ? (
            <img src={item.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            getEntityIcon(item.type)
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-sky-300 transition-colors truncate">
              {renderHighlightedText(item.title)}
            </h4>

            {item.category && (
              <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 rounded-md shrink-0">
                {item.category}
              </span>
            )}

            {item.meta?.isPrivate !== undefined && (
              <span
                className={`px-2 py-0.5 border text-[10px] font-mono rounded-md flex items-center gap-1 shrink-0 ${
                  item.meta.isPrivate
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {item.meta.isPrivate ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                <span>{item.meta.isPrivate ? 'Private' : 'Public'}</span>
              </span>
            )}
          </div>

          {item.subtitle && (
            <p className="text-[11px] text-slate-400 truncate font-mono">
              {renderHighlightedText(item.subtitle)}
            </p>
          )}

          {item.description && (
            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
              {renderHighlightedText(item.description)}
            </p>
          )}
        </div>
      </div>

      {/* Action Button / Arrow */}
      <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 w-full sm:w-auto justify-between sm:justify-start">
        <span className="text-[10px] font-mono font-bold text-sky-400 sm:hidden group-hover:underline">
          {getActionLabel(item.type)} →
        </span>
        <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800/80 group-hover:border-sky-500/40 group-hover:bg-sky-500/10 flex items-center justify-center text-slate-400 group-hover:text-sky-400 transition-all">
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
};
