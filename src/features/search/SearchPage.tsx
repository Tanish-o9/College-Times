import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  searchUnifiedCampus,
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../../services/searchService';
import type { SearchCategory, SearchResultItem } from '../../types/search';
import {
  Search as SearchIcon,
  X,
  User,
  Users,
  Calendar,
  Newspaper,
  Tag,
  ShoppingBag,
  HelpCircle,
  Briefcase,
  Sparkles,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

const TRENDING_TOPICS = ['Hackathon', 'Freshers', 'Placement', 'Sports', 'Robotics', 'CSE'];

const CATEGORY_TABS: { id: SearchCategory; label: string }[] = [
  { id: 'all', label: 'All Results' },
  { id: 'people', label: 'People' },
  { id: 'groups', label: 'Groups' },
  { id: 'posts', label: 'Feed Posts' },
  { id: 'events', label: 'Events' },
  { id: 'lost_found', label: 'Lost & Found' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'resources', label: 'Resources' },
];

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const initialQuery = searchParams.get('q') || '';
  const initialCategory = (searchParams.get('category') as SearchCategory) || 'all';

  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState<SearchCategory>(initialCategory);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Debounced search trigger (300ms)
  useEffect(() => {
    const clean = query.trim();

    if (!clean || clean.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await searchUnifiedCampus(clean, activeCategory, 20, currentUser);
        setResults(res.items);
        saveRecentSearch(clean);
        setRecentSearches(getRecentSearches());
      } catch (err) {
        toast.error('Search failed.');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeCategory, currentUser]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (val.trim()) {
      setSearchParams({ q: val, category: activeCategory });
    } else {
      setSearchParams({});
    }
  };

  const handleCategoryTabChange = (cat: SearchCategory) => {
    setActiveCategory(cat);
    if (query.trim()) {
      setSearchParams({ q: query, category: cat });
    }
  };

  const handleSelectRecent = (q: string) => {
    setQuery(q);
    setSearchParams({ q, category: activeCategory });
  };

  const handleRemoveRecent = (q: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentSearch(q);
    setRecentSearches(getRecentSearches());
  };

  const handleClearAllRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const getItemIcon = (type: string) => {
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
        return <FileText className="w-5 h-5 text-sky-400" />;
      default:
        return <Tag className="w-5 h-5 text-slate-400" />;
    }
  };

  // Safe highlighted rendering
  const renderHighlightedText = (text?: string) => {
    if (!text) return null;
    if (!query.trim()) return <span>{text}</span>;

    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.trim().toLowerCase() ? (
            <mark key={i} className="bg-sky-500/20 text-sky-300 font-bold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Search Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Search Input Box */}
        <div className="relative flex-1">
          <SearchIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search students, groups, posts, events, marketplace..."
            autoFocus
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
          {query && (
            <button
              onClick={() => handleQueryChange('')}
              className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleCategoryTabChange(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === tab.id
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Recent & Trending Section (Shown when no query typed) */}
        {!query.trim() && (
          <div className="space-y-6">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Recent Searches</span>
                  <button
                    onClick={handleClearAllRecent}
                    className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors font-mono"
                  >
                    Clear All
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSelectRecent(q)}
                      className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-center gap-2 transition-all group"
                    >
                      <span>{q}</span>
                      <X
                        className="w-3 h-3 text-slate-500 group-hover:text-rose-400 transition-colors"
                        onClick={(e) => handleRemoveRecent(q, e)}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Campus Topics */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white">Trending on Campus</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {TRENDING_TOPICS.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => handleSelectRecent(topic)}
                    className="px-3.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-semibold transition-all"
                  >
                    #{topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results List */}
        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Searching campus records...</span>
          </div>
        ) : query.trim() && results.length === 0 ? (
          /* Smart Empty State */
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-4">
            <SearchIcon className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">No matches found for "{query}"</h3>
              <p className="text-slate-400 text-xs">Try adjusting your query or browse campus categories below.</p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                onClick={() => navigate('/groups')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-sky-400 font-semibold"
              >
                Browse Groups
              </button>
              <button
                onClick={() => navigate('/events')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-purple-400 font-semibold"
              >
                Browse Events
              </button>
              <button
                onClick={() => navigate('/marketplace')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-pink-400 font-semibold"
              >
                Marketplace
              </button>
            </div>
          </div>
        ) : (
          /* Result Cards */
          query.trim() && (
            <div className="space-y-3">
              <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between px-1">
                <span>Showing results for "{query}"</span>
                <span>{results.length} matches</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl divide-y divide-slate-800/60 overflow-hidden">
                {results.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => navigate(item.url)}
                    className="w-full p-4 text-left hover:bg-slate-850 flex items-center justify-between gap-4 transition-colors group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                        {item.avatar ? (
                          <img src={item.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          getItemIcon(item.type)
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white group-hover:text-sky-400 transition-colors truncate">
                            {renderHighlightedText(item.title)}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 rounded shrink-0">
                            {item.category}
                          </span>
                        </div>
                        {item.subtitle && (
                          <span className="text-[11px] text-slate-400 block truncate">
                            {renderHighlightedText(item.subtitle)}
                          </span>
                        )}
                        {item.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {renderHighlightedText(item.description)}
                          </p>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
};
