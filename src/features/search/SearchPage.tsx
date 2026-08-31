import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampusSearch } from './useCampusSearch';
import { SearchInput } from './SearchInput';
import { SearchTabs } from './SearchTabs';
import { SearchFilters } from './SearchFilters';
import { SearchResults } from './SearchResults';
import { RecentSearches } from './RecentSearches';
import { TrendingTopics } from './TrendingTopics';
import { SearchSuggestions } from './SearchSuggestions';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    query,
    setQuery,
    activeCategory,
    setActiveCategory,
    filters,
    setFilter,
    clearAllFilters,
    results,
    suggestions,
    loading,
    errors,
    recentSearches,
    trendingTopics,
    handleRemoveRecent,
    handleClearAllRecent,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
  } = useCampusSearch();

  const [showSuggestionsOverlay, setShowSuggestionsOverlay] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close suggestions overlay on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestionsOverlay(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowSuggestionsOverlay(true);
      setSelectedSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setShowSuggestionsOverlay(true);
      setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
        e.preventDefault();
        setShowSuggestionsOverlay(false);
        navigate(suggestions[selectedSuggestionIndex].url);
      } else {
        setShowSuggestionsOverlay(false);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestionsOverlay(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  const handleSelectRecent = (q: string) => {
    setQuery(q);
    setShowSuggestionsOverlay(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col selection:bg-sky-500/30">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3 sm:px-6 flex items-center gap-3 shadow-lg">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 border border-slate-800/80 transition-all shrink-0 active:scale-95 cursor-pointer"
          title="Back"
          aria-label="Navigate back"
        >
          <ArrowLeft className="w-5 h-5 text-sky-400" />
        </button>

        {/* Global Search Input Container with Suggestions Overlay */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-4xl">
          <SearchInput
            query={query}
            onChange={(val) => {
              setQuery(val);
              setShowSuggestionsOverlay(Boolean(val.trim()));
            }}
            loading={loading}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestionsOverlay(true);
            }}
            placeholder="Search students, groups, posts, events, marketplace..."
          />

          {showSuggestionsOverlay && (
            <SearchSuggestions
              suggestions={suggestions}
              query={query}
              selectedIndex={selectedSuggestionIndex}
              onSelect={(url) => {
                setShowSuggestionsOverlay(false);
                navigate(url);
              }}
              onViewAll={() => setShowSuggestionsOverlay(false)}
            />
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Category Tabs */}
        <SearchTabs
          activeCategory={activeCategory}
          onSelectTab={setActiveCategory}
        />

        {/* Contextual Filters */}
        <SearchFilters
          category={activeCategory}
          filters={filters}
          onFilterChange={setFilter}
          onClearFilters={clearAllFilters}
        />

        {/* Recent Searches & Trending Topics (Shown when search input is empty) */}
        {!query.trim() && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <RecentSearches
              searches={recentSearches}
              onSelect={handleSelectRecent}
              onRemove={handleRemoveRecent}
              onClearAll={handleClearAllRecent}
            />

            <TrendingTopics
              topics={trendingTopics}
              onSelect={handleSelectRecent}
            />
          </div>
        )}

        {/* Loading Spinner Indicator */}
        {loading && (
          <div className="p-12 bg-slate-900/40 border border-slate-800/80 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs font-mono shadow-xl">
            <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
            <span>Querying campus records and computing relevance scores...</span>
          </div>
        )}

        {/* Search Results Display */}
        {!loading && query.trim() && (
          <SearchResults
            query={query}
            activeCategory={activeCategory}
            results={results}
            errors={errors}
            onNavigate={(url) => navigate(url)}
            onSelectCategory={setActiveCategory}
          />
        )}
      </main>
    </div>
  );
};
