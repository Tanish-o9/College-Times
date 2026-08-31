import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useGlobalCache } from '../../context/GlobalCacheContext';
import {
  searchUnifiedCampus,
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  fetchTrendingCampusTopics,
} from '../../services/searchService';
import {
  getSearchHistory,
  saveSearchHistory,
  clearSearchHistory,
} from '../../services/recommendationService';
import type {
  SearchCategory,
  SearchResultItem,
  SearchSuggestion,
  SearchFilterState,
  SearchError,
} from '../../types/search';

export const useCampusSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { joinedGroupIds } = useGlobalCache();

  // Extract params from URL
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = (searchParams.get('category') as SearchCategory) || 'all';
  const initialDept = searchParams.get('dept') || '';
  const initialBatch = searchParams.get('batch') || '';
  const initialPrivacy = (searchParams.get('privacy') as any) || 'all';
  const initialPrice = (searchParams.get('price') as any) || 'all';
  const initialOppType = searchParams.get('oppType') || '';

  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState<SearchCategory>(initialCategory);
  const [filters, setFilters] = useState<SearchFilterState>({
    department: initialDept,
    batch: initialBatch,
    groupPrivacy: initialPrivacy,
    priceRange: initialPrice,
    opportunityType: initialOppType,
  });

  const [rawResults, setRawResults] = useState<SearchResultItem[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<SearchError[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);

  // Load Recent Searches & Dynamic Trending Topics
  useEffect(() => {
    if (currentUser) {
      getSearchHistory(currentUser.uid).then((history) => {
        setRecentSearches(history.length > 0 ? history : getRecentSearches());
      });
    } else {
      setRecentSearches(getRecentSearches());
    }

    fetchTrendingCampusTopics().then(setTrendingTopics);
  }, [currentUser]);

  // Sync Search state to URL params cleanly
  const syncUrlParams = useCallback(
    (newQuery: string, newCat: SearchCategory, newFilters: SearchFilterState) => {
      const params: Record<string, string> = {};
      if (newQuery.trim()) params.q = newQuery.trim();
      if (newCat !== 'all') params.category = newCat;
      if (newFilters.department) params.dept = newFilters.department;
      if (newFilters.batch) params.batch = newFilters.batch;
      if (newFilters.groupPrivacy && newFilters.groupPrivacy !== 'all') params.privacy = newFilters.groupPrivacy;
      if (newFilters.priceRange && newFilters.priceRange !== 'all') params.price = newFilters.priceRange;
      if (newFilters.opportunityType) params.oppType = newFilters.opportunityType;

      setSearchParams(params, { replace: true });
    },
    [setSearchParams]
  );

  // Debounced search trigger (250ms)
  useEffect(() => {
    const clean = query.trim();

    if (!clean || clean.length < 2) {
      setRawResults([]);
      setSuggestions([]);
      setErrors([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await searchUnifiedCampus(clean, activeCategory, 60, currentUser, joinedGroupIds);
        setRawResults(res.items);
        setSuggestions(res.suggestions);
        setErrors(res.errors || []);

        if (currentUser) {
          await saveSearchHistory(currentUser.uid, clean);
          const history = await getSearchHistory(currentUser.uid);
          setRecentSearches(history);
        } else {
          saveRecentSearch(clean);
          setRecentSearches(getRecentSearches());
        }
      } catch (err: any) {
        console.error('Campus Search execution error:', err);
        setErrors([{ category: activeCategory, message: err?.message || 'Search service failure.' }]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, activeCategory, currentUser, joinedGroupIds]);

  // Filter raw results according to active contextual filters
  const filteredResults = useCallback(() => {
    return rawResults.filter((item) => {
      // Department filter
      if (filters.department && item.meta?.department) {
        if (item.meta.department.toLowerCase() !== filters.department.toLowerCase()) {
          return false;
        }
      }

      // Batch filter
      if (filters.batch && item.meta?.batch) {
        if (String(item.meta.batch) !== String(filters.batch)) {
          return false;
        }
      }

      // Group Privacy filter
      if (filters.groupPrivacy && filters.groupPrivacy !== 'all' && item.type === 'group') {
        if (filters.groupPrivacy === 'private' && !item.meta?.isPrivate) return false;
        if (filters.groupPrivacy === 'public' && item.meta?.isPrivate) return false;
      }

      // Price Range filter for Marketplace
      if (filters.priceRange && filters.priceRange !== 'all' && item.type === 'marketplace' && item.meta?.price !== undefined) {
        const p = item.meta.price;
        if (filters.priceRange === 'under500' && p >= 500) return false;
        if (filters.priceRange === '500to2000' && (p < 500 || p > 2000)) return false;
        if (filters.priceRange === 'above2000' && p <= 2000) return false;
      }

      // Opportunity Type filter
      if (filters.opportunityType && item.type === 'opportunity' && item.meta?.type) {
        if (item.meta.type.toLowerCase() !== filters.opportunityType.toLowerCase()) return false;
      }

      return true;
    });
  }, [rawResults, filters]);

  // Actions
  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSelectedSuggestionIndex(-1);
    syncUrlParams(val, activeCategory, filters);
  };

  const handleCategoryChange = (cat: SearchCategory) => {
    setActiveCategory(cat);
    setSelectedSuggestionIndex(-1);
    syncUrlParams(query, cat, filters);
  };

  const handleFilterChange = (key: keyof SearchFilterState, value: string) => {
    const nextFilters = { ...filters, [key]: value || undefined };
    setFilters(nextFilters);
    syncUrlParams(query, activeCategory, nextFilters);
  };

  const clearAllFilters = () => {
    const emptyFilters: SearchFilterState = {};
    setFilters(emptyFilters);
    syncUrlParams(query, activeCategory, emptyFilters);
  };

  const handleRemoveRecent = (qStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentSearch(qStr);
    setRecentSearches(getRecentSearches());
  };

  const handleClearAllRecent = async () => {
    if (currentUser) {
      await clearSearchHistory(currentUser.uid);
    } else {
      clearRecentSearches();
    }
    setRecentSearches([]);
  };

  return {
    query,
    setQuery: handleQueryChange,
    activeCategory,
    setActiveCategory: handleCategoryChange,
    filters,
    setFilter: handleFilterChange,
    clearAllFilters,
    results: filteredResults(),
    rawCount: rawResults.length,
    suggestions,
    loading,
    errors,
    recentSearches,
    trendingTopics,
    handleRemoveRecent,
    handleClearAllRecent,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
  };
};
