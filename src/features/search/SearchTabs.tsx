import React from 'react';
import type { SearchCategory } from '../../types/search';
import {
  Sparkles,
  User,
  Users,
  Calendar,
  Newspaper,
  ShoppingBag,
  Briefcase,
  HelpCircle,
  FileText,
  GraduationCap,
} from 'lucide-react';

interface CategoryTabOption {
  id: SearchCategory;
  label: string;
  icon: React.ReactNode;
}

const CATEGORY_TABS: CategoryTabOption[] = [
  { id: 'all', label: 'All Results', icon: <Sparkles className="w-3.5 h-3.5 text-sky-400" /> },
  { id: 'people', label: 'People', icon: <User className="w-3.5 h-3.5 text-sky-400" /> },
  { id: 'groups', label: 'Groups', icon: <Users className="w-3.5 h-3.5 text-indigo-400" /> },
  { id: 'posts', label: 'Feed Posts', icon: <Newspaper className="w-3.5 h-3.5 text-emerald-400" /> },
  { id: 'events', label: 'Events', icon: <Calendar className="w-3.5 h-3.5 text-purple-400" /> },
  { id: 'lost_found', label: 'Lost & Found', icon: <HelpCircle className="w-3.5 h-3.5 text-amber-400" /> },
  { id: 'marketplace', label: 'Marketplace', icon: <ShoppingBag className="w-3.5 h-3.5 text-pink-400" /> },
  { id: 'opportunities', label: 'Opportunities', icon: <Briefcase className="w-3.5 h-3.5 text-orange-400" /> },
  { id: 'resources', label: 'Resources', icon: <FileText className="w-3.5 h-3.5 text-cyan-400" /> },
  { id: 'academics', label: 'Academics', icon: <GraduationCap className="w-3.5 h-3.5 text-emerald-400" /> },
];

interface SearchTabsProps {
  activeCategory: SearchCategory;
  onSelectTab: (cat: SearchCategory) => void;
  resultCounts?: Record<string, number>;
}

export const SearchTabs: React.FC<SearchTabsProps> = ({
  activeCategory,
  onSelectTab,
  resultCounts,
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800/80 -mx-4 px-4 sm:mx-0 sm:px-0">
      {CATEGORY_TABS.map((tab) => {
        const isActive = activeCategory === tab.id;
        const count = resultCounts?.[tab.id];

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
              isActive
                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/40 shadow-[0_0_15px_rgba(56,189,248,0.25)]'
                : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800/60'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {count !== undefined && count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                isActive ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-800 text-slate-400'
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
