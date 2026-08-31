import React from 'react';
import type { SearchCategory, SearchResultItem, SearchError } from '../../types/search';
import { SearchResultCard } from './SearchResultCard';
import { Search as SearchIcon, AlertTriangle, ArrowRight } from 'lucide-react';

interface SearchResultsProps {
  query: string;
  activeCategory: SearchCategory;
  results: SearchResultItem[];
  errors: SearchError[];
  onNavigate: (url: string) => void;
  onSelectCategory: (cat: SearchCategory) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  query,
  activeCategory,
  results,
  errors,
  onNavigate,
  onSelectCategory,
}) => {
  if (!query.trim()) return null;

  // Render Partial Backend Error Banners if any category query failed
  const errorBanner = errors.length > 0 && (
    <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-200 shadow-md">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>Some search sources could not be fetched due to network or access restrictions.</span>
      </div>
      <span className="text-[10px] font-mono text-amber-400 font-bold shrink-0">
        {errors.length} warning(s)
      </span>
    </div>
  );

  // Smart Empty State
  if (results.length === 0) {
    return (
      <div className="space-y-4">
        {errorBanner}
        <div className="p-12 bg-slate-900/60 border border-slate-800 rounded-3xl text-center space-y-4 shadow-xl">
          <SearchIcon className="w-10 h-10 text-slate-600 mx-auto animate-bounce" />
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-white">No matches found for "{query}"</h3>
            <p className="text-slate-400 text-xs max-w-md mx-auto">
              Check for typos or try searching for general campus topics like "Hackathon", "Placement", or "Robotics".
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              onClick={() => onSelectCategory('groups')}
              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-indigo-400 font-bold transition-all"
            >
              Browse Groups
            </button>
            <button
              onClick={() => onSelectCategory('events')}
              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-purple-400 font-bold transition-all"
            >
              Browse Events
            </button>
            <button
              onClick={() => onSelectCategory('marketplace')}
              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-pink-400 font-bold transition-all"
            >
              Marketplace
            </button>
            <button
              onClick={() => onSelectCategory('opportunities')}
              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-orange-400 font-bold transition-all"
            >
              Opportunities
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Unified All Results View sectioned by category
  if (activeCategory === 'all') {
    // Group results by category
    const categoryGroups: { [key: string]: { label: string; catId: SearchCategory; items: SearchResultItem[] } } = {
      People: { label: 'People & Students', catId: 'people', items: [] },
      Groups: { label: 'Campus Groups & Clubs', catId: 'groups', items: [] },
      'Feed Posts': { label: 'Feed Posts & Updates', catId: 'posts', items: [] },
      Events: { label: 'Upcoming & Campus Events', catId: 'events', items: [] },
      'Lost & Found': { label: 'Lost & Found Records', catId: 'lost_found', items: [] },
      Marketplace: { label: 'Marketplace Listings', catId: 'marketplace', items: [] },
      Opportunities: { label: 'Career Opportunities & Hackathons', catId: 'opportunities', items: [] },
      Resources: { label: 'Group Study Resources', catId: 'resources', items: [] },
      Academics: { label: 'Academic Subjects', catId: 'academics', items: [] },
    };

    results.forEach((item) => {
      const catKey = item.category || 'Feed Posts';
      if (categoryGroups[catKey]) {
        categoryGroups[catKey].items.push(item);
      } else {
        if (!categoryGroups['Feed Posts']) {
          categoryGroups['Feed Posts'] = { label: 'Feed Posts', catId: 'posts', items: [] };
        }
        categoryGroups['Feed Posts'].items.push(item);
      }
    });

    const activeSections = Object.values(categoryGroups).filter((g) => g.items.length > 0);

    return (
      <div className="space-y-6">
        {errorBanner}

        <div className="text-xs text-slate-400 font-mono flex items-center justify-between px-1">
          <span>Search results for "{query}"</span>
          <span>{results.length} total matches</span>
        </div>

        <div className="space-y-6">
          {activeSections.map((section) => (
            <div key={section.catId} className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 font-mono">
                    {section.label}
                  </h3>
                  <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-[10px] font-mono text-sky-400 rounded-full font-bold">
                    {section.items.length}
                  </span>
                </div>

                {section.items.length > 3 && (
                  <button
                    onClick={() => onSelectCategory(section.catId)}
                    className="text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>View all ({section.items.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {section.items.slice(0, 4).map((item) => (
                  <SearchResultCard
                    key={`${item.type}-${item.id}`}
                    item={item}
                    query={query}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Dedicated Category Tab List View
  return (
    <div className="space-y-4">
      {errorBanner}

      <div className="text-xs text-slate-400 font-mono flex items-center justify-between px-1">
        <span>Showing {activeCategory} matches for "{query}"</span>
        <span>{results.length} results</span>
      </div>

      <div className="space-y-2.5">
        {results.map((item) => (
          <SearchResultCard
            key={`${item.type}-${item.id}`}
            item={item}
            query={query}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
};
