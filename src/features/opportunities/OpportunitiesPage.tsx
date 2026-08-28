import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Opportunity, OpportunityType, OpportunityMode } from '../../types/opportunity';
import { getOpportunities } from '../../services/opportunityService';
import { OpportunityCard } from './OpportunityCard';
import { CreateOpportunityModal } from './CreateOpportunityModal';
import { OpportunityDiscovery } from './OpportunityDiscovery';
import { 
  Briefcase, 
  Search, 
  Plus, 
  RefreshCw, 
  Bookmark, 
  PackageCheck,
  AlertCircle
} from 'lucide-react';

type TabFilter = 'All' | 'Closing Soon' | 'Official' | OpportunityType;

const TABS: TabFilter[] = [
  'All', 'Closing Soon', 'Official', 'Placement', 'Internship',
  'Hackathon', 'Scholarship', 'Competition', 'Research', 'Workshop'
];

export const OpportunitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState<TabFilter>('All');
  const [selectedMode, setSelectedMode] = useState<'All' | OpportunityMode>('All');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  // Debounce search query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOpportunities(
        {
          closingSoon: selectedTab === 'Closing Soon',
          isOfficial: selectedTab === 'Official' ? true : undefined,
        },
        30
      );
      setOpportunities(data);
    } catch (err: any) {
      console.error('Failed to load opportunities:', err);
      setError(err.message || 'Failed to load campus opportunities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [selectedTab]);

  const handleOpportunityCreated = (newOpp: Opportunity) => {
    setOpportunities((prev) => [newOpp, ...prev]);
  };

  // Client-side filtering over fetched array
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      // Tab Type Filter
      if (selectedTab !== 'All' && selectedTab !== 'Closing Soon' && selectedTab !== 'Official') {
        if (opp.type !== selectedTab) return false;
      }

      // Mode Filter
      if (selectedMode !== 'All' && opp.mode !== selectedMode) return false;

      // Debounced Search Match
      if (debouncedSearch) {
        const titleMatch = opp.title.toLowerCase().includes(debouncedSearch);
        const orgMatch = (opp.organizationName || opp.organization || '').toLowerCase().includes(debouncedSearch);
        const descMatch = opp.description.toLowerCase().includes(debouncedSearch);
        if (!titleMatch && !orgMatch && !descMatch) return false;
      }

      return true;
    });
  }, [opportunities, selectedTab, selectedMode, debouncedSearch]);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Briefcase className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Campus Opportunity Hub</h1>
          </div>
          <p className="text-xs text-slate-400">
            Placements, internships, hackathons, scholarships, and research drives for college students.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/opportunities/applications')}
            className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-2xl text-xs font-bold flex items-center gap-1.5"
          >
            <Briefcase className="w-4 h-4 text-sky-400" />
            <span>My Applications</span>
          </button>

          <button
            onClick={() => navigate('/saved-opportunities')}
            className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-2xl text-xs font-bold flex items-center gap-1.5"
          >
            <Bookmark className="w-4 h-4 text-purple-400" />
            <span>Saved</span>
          </button>

          <button
            onClick={() => setIsFormOpen(true)}
            className="px-5 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Post Opportunity</span>
          </button>
        </div>
      </div>

      <OpportunityDiscovery />

      {/* Search Bar & Filter Tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search role, company, skills (e.g. Google, SDE, React)..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
                selectedTab === tab
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-md'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Mode Pill Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(['All', 'online', 'offline', 'hybrid'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMode(m)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border shrink-0 capitalize ${
                selectedMode === m
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Main Opportunity Cards Grid */}
      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
          <span>Loading opportunities...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-xs text-rose-300 font-semibold">{error}</p>
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <div className="p-12 bg-slate-900/60 border border-slate-800 rounded-3xl text-center space-y-3">
          <PackageCheck className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">No Opportunities Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No campus opportunities match your selected filters. Post one or clear filters!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOpportunities.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      )}

      {/* Create Opportunity Modal */}
      <CreateOpportunityModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onOpportunityCreated={handleOpportunityCreated}
      />
    </div>
  );
};
