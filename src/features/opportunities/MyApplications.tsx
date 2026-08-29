import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getUserApplications, updateApplicationStatus } from '../../services/opportunityApplicationService';
import type { OpportunityApplication, ApplicationStatus } from '../../types/opportunity';
import {
  Briefcase,
  ArrowLeft,
  RefreshCw,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';

const statusTabs: (ApplicationStatus | 'All')[] = [
  'All',
  'saved',
  'applied',
  'assessment',
  'interview',
  'selected',
  'rejected',
  'withdrawn',
];

const lifecycleStages: { key: ApplicationStatus; label: string }[] = [
  { key: 'saved', label: 'Saved' },
  { key: 'applied', label: 'Applied' },
  { key: 'assessment', label: 'Test' },
  { key: 'interview', label: 'Interview' },
  { key: 'selected', label: 'Decision' },
];

export const MyApplications: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [selectedTab, setSelectedTab] = useState<ApplicationStatus | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');

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

  const handleStatusChange = async (opportunityId: string, newStatus: ApplicationStatus, currentNotes?: string) => {
    if (!currentUser) return;
    try {
      await updateApplicationStatus(currentUser.uid, opportunityId, newStatus, currentNotes);
      toast.success(`Application status updated to ${newStatus.toUpperCase()}`);
      setApplications((prev) =>
        prev.map((app) => (app.opportunityId === opportunityId ? { ...app, status: newStatus } : app))
      );
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  const handleNotesSave = async (opportunityId: string, currentStatus: ApplicationStatus) => {
    if (!currentUser) return;
    try {
      await updateApplicationStatus(currentUser.uid, opportunityId, currentStatus, tempNotes);
      toast.success('Application logs updated.');
      setApplications((prev) =>
        prev.map((app) => (app.opportunityId === opportunityId ? { ...app, notes: tempNotes } : app))
      );
      setEditingNotesId(null);
    } catch (err) {
      toast.error('Failed to save notes.');
    }
  };

  const filteredApps = applications.filter(
    (app) => selectedTab === 'All' || app.status === selectedTab
  );

  const getStatusColor = (status: ApplicationStatus) => {
    switch (status) {
      case 'selected':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'rejected':
        return 'text-rose-455 bg-rose-500/10 border-rose-500/20';
      case 'withdrawn':
        return 'text-slate-400 bg-slate-800 border-slate-700';
      default:
        return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/opportunities')} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-sky-400 animate-pulse" />
              <span>Career Lifecycle Tracker</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono uppercase">Monitor opportunity stages privately</p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {statusTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all border ${
                selectedTab === tab
                  ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
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
            No application lifecycles match the selected filter.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApps.map((app) => {
              const currentStageIdx = lifecycleStages.findIndex((s) => s.key === app.status);

              return (
                <div
                  key={app.id}
                  className="p-5 bg-slate-900/60 border border-slate-850 hover:border-slate-800 rounded-3xl space-y-5 shadow-xl transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-mono font-black uppercase border ${getStatusColor(app.status)}`}>
                          {app.status}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">🏢 {app.organization}</span>
                      </div>
                      <h3 className="text-sm font-black text-white mt-1">{app.opportunityTitle}</h3>
                    </div>

                    {/* Status Select dropdown */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-slate-500 uppercase">Change Stage</span>
                      <select
                        value={app.status}
                        onChange={(e) => handleStatusChange(app.opportunityId, e.target.value as ApplicationStatus, app.notes)}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
                      >
                        <option value="saved">Saved</option>
                        <option value="applied">Applied</option>
                        <option value="assessment">Assessment</option>
                        <option value="interview">Interview</option>
                        <option value="selected">Selected</option>
                        <option value="rejected">Rejected</option>
                        <option value="withdrawn">Withdrawn</option>
                      </select>
                    </div>
                  </div>

                  {/* Lifecycle Stages visual pipeline */}
                  {app.status !== 'withdrawn' && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-mono text-slate-500 uppercase">Application Progress Pipeline</p>
                      <div className="grid grid-cols-5 gap-2 relative">
                        {/* Connecting Line */}
                        <div className="absolute top-2.5 left-0 right-0 h-0.5 bg-slate-800 -z-10" />

                        {lifecycleStages.map((stage, sIdx) => {
                          const isCompleted = sIdx <= currentStageIdx;
                          const isActive = sIdx === currentStageIdx;
                          const isSpecialState = app.status === 'rejected' && stage.key === 'selected';

                          return (
                            <div key={stage.key} className="flex flex-col items-center text-center space-y-1">
                              <div
                                className={`w-5.5 h-5.5 rounded-full flex items-center justify-center border text-[9px] font-black transition-all ${
                                  isActive
                                    ? isSpecialState || app.status === 'rejected'
                                      ? 'bg-rose-500 border-rose-400 text-slate-950 scale-110 shadow-lg shadow-rose-500/20'
                                      : 'bg-sky-500 border-sky-400 text-slate-950 scale-110 shadow-lg shadow-sky-500/20'
                                    : isCompleted
                                    ? 'bg-slate-800 border-slate-700 text-slate-400'
                                    : 'bg-slate-950 border-slate-850 text-slate-600'
                                }`}
                              >
                                {isCompleted && !isActive ? '✓' : sIdx + 1}
                              </div>
                              <span className={`text-[8px] font-bold uppercase tracking-wider font-mono ${isActive ? 'text-sky-400' : 'text-slate-505'}`}>
                                {isSpecialState ? 'Rejected' : stage.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Application Notes and Checklist */}
                  <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-850 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-850/60 pb-2">
                      <span className="text-[9px] uppercase font-bold text-slate-450 font-mono flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-sky-450" />
                        <span>Application Notes & Action Log</span>
                      </span>
                      {editingNotesId !== app.opportunityId ? (
                        <button
                          onClick={() => {
                            setEditingNotesId(app.opportunityId);
                            setTempNotes(app.notes || '');
                          }}
                          className="text-[9px] uppercase font-bold text-sky-400 hover:text-sky-350"
                        >
                          Edit Notes
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleNotesSave(app.opportunityId, app.status)}
                            className="text-[9px] uppercase font-bold text-emerald-400 hover:text-emerald-350"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingNotesId(null)}
                            className="text-[9px] uppercase font-bold text-slate-500"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {editingNotesId === app.opportunityId ? (
                      <textarea
                        value={tempNotes}
                        onChange={(e) => setTempNotes(e.target.value)}
                        placeholder="Add tasks, follow up dates, or questions asked..."
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none h-20 resize-none font-mono"
                      />
                    ) : (
                      <p className="text-xs text-slate-350 leading-relaxed italic">
                        {app.notes || 'No tracking notes added yet. Record deadlines or checklist items here.'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
