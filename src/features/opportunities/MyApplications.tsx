import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getUserApplications, updateApplicationStatus } from '../../services/opportunityApplicationService';
import type { OpportunityApplication, ApplicationStatus } from '../../types/opportunity';
import {
  Briefcase,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

const statusTabs: (ApplicationStatus | 'All')[] = [
  'All',
  'applied',
  'assessment',
  'interview',
  'selected',
  'rejected',
  'withdrawn',
];

export const MyApplications: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [selectedTab, setSelectedTab] = useState<ApplicationStatus | 'All'>('All');
  const [loading, setLoading] = useState(true);

  const loadApps = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const list = await getUserApplications(currentUser.uid, 50);
      setApplications(list);
    } catch (err) {
      console.error('Failed to load user applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApps();
  }, [currentUser]);

  const handleStatusChange = async (opportunityId: string, newStatus: ApplicationStatus) => {
    if (!currentUser) return;
    try {
      await updateApplicationStatus(currentUser.uid, opportunityId, newStatus);
      toast.success(`Application status updated to ${newStatus.toUpperCase()}`);
      setApplications((prev) =>
        prev.map((app) => (app.opportunityId === opportunityId ? { ...app, status: newStatus } : app))
      );
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  const filteredApps = applications.filter(
    (app) => selectedTab === 'All' || app.status === selectedTab
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/opportunities')} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-sky-400" />
              <span>Private Application Tracker</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Manage your career applications privately</p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {statusTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all ${
                selectedTab === tab
                  ? 'bg-sky-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Applications List */}
        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading application records...</span>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
            No applications found under this status filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredApps.map((app) => (
              <div
                key={app.id}
                className="p-4 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-between shadow-xl"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/30">
                      {app.status}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{app.organization}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1">{app.opportunityTitle}</h3>
                </div>

                {/* Status Controls */}
                <div className="flex items-center gap-2">
                  <select
                    value={app.status}
                    onChange={(e) => handleStatusChange(app.opportunityId, e.target.value as ApplicationStatus)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
                  >
                    <option value="applied">Applied</option>
                    <option value="assessment">Assessment</option>
                    <option value="interview">Interview</option>
                    <option value="selected">Selected</option>
                    <option value="rejected">Rejected</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
