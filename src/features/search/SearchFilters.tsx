import React from 'react';
import type { SearchCategory, SearchFilterState } from '../../types/search';
import { Filter, RotateCcw } from 'lucide-react';

interface SearchFiltersProps {
  category: SearchCategory;
  filters: SearchFilterState;
  onFilterChange: (key: keyof SearchFilterState, value: string) => void;
  onClearFilters: () => void;
}

const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Electronics & Comm',
  'Electrical & Electronics',
  'Mechanical Engg',
  'Civil Engg',
];

const BATCHES = ['2025', '2026', '2027', '2028', '2029'];

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  category,
  filters,
  onFilterChange,
  onClearFilters,
}) => {
  const hasActiveFilters = Boolean(
    filters.department ||
      filters.batch ||
      (filters.groupPrivacy && filters.groupPrivacy !== 'all') ||
      (filters.priceRange && filters.priceRange !== 'all') ||
      filters.opportunityType
  );

  return (
    <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex flex-wrap items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5 text-slate-400 font-bold font-mono uppercase text-[10px] pr-2 border-r border-slate-800 shrink-0">
        <Filter className="w-3.5 h-3.5 text-sky-400" />
        <span>Filters</span>
      </div>

      {/* People / Academic / Group Department Filter */}
      {(category === 'all' || category === 'people' || category === 'groups' || category === 'academics') && (
        <select
          value={filters.department || ''}
          onChange={(e) => onFilterChange('department', e.target.value)}
          className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-sky-500/50"
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
      )}

      {/* Batch Filter */}
      {(category === 'all' || category === 'people' || category === 'groups' || category === 'academics') && (
        <select
          value={filters.batch || ''}
          onChange={(e) => onFilterChange('batch', e.target.value)}
          className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-sky-500/50"
        >
          <option value="">All Batches</option>
          {BATCHES.map((batch) => (
            <option key={batch} value={batch}>
              Batch {batch}
            </option>
          ))}
        </select>
      )}

      {/* Group Privacy Filter */}
      {(category === 'all' || category === 'groups') && (
        <select
          value={filters.groupPrivacy || 'all'}
          onChange={(e) => onFilterChange('groupPrivacy', e.target.value)}
          className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-sky-500/50"
        >
          <option value="all">Public & Private Groups</option>
          <option value="public">Public Groups Only</option>
          <option value="private">Private Groups Only</option>
        </select>
      )}

      {/* Marketplace Price Filter */}
      {(category === 'all' || category === 'marketplace') && (
        <select
          value={filters.priceRange || 'all'}
          onChange={(e) => onFilterChange('priceRange', e.target.value)}
          className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-sky-500/50"
        >
          <option value="all">All Prices</option>
          <option value="under500">Under ₹500</option>
          <option value="500to2000">₹500 - ₹2,000</option>
          <option value="above2000">Above ₹2,000</option>
        </select>
      )}

      {/* Opportunity Type Filter */}
      {(category === 'all' || category === 'opportunities') && (
        <select
          value={filters.opportunityType || ''}
          onChange={(e) => onFilterChange('opportunityType', e.target.value)}
          className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-sky-500/50"
        >
          <option value="">All Opportunity Types</option>
          <option value="Internship">Internship</option>
          <option value="Job">Job / Placement</option>
          <option value="Hackathon">Hackathon</option>
          <option value="Competition">Competition</option>
          <option value="Scholarship">Scholarship</option>
        </select>
      )}

      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="ml-auto text-[11px] font-mono text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Filters</span>
        </button>
      )}
    </div>
  );
};
