import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getMyIncidentReports } from '../../services/incidentReportService';
import type { IncidentReport } from '../../types/incidentReport';
import { formatTimestamp } from '../../utils/format';
import {
  FileText,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const MyIncidentReports: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadReports = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const items = await getMyIncidentReports(currentUser);
      setReports(items);
    } catch (err) {
      toast.error('Failed to load incident reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [currentUser]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            VERIFIED
          </span>
        );
      case 'under_review':
        return (
          <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
            UNDER REVIEW
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            REJECTED
          </span>
        );
      case 'dismissed':
        return (
          <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            DISMISSED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            PENDING VERIFICATION
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white">My Incident Reports</h1>
            <p className="text-[11px] text-slate-400">Track verification status of submitted campus reports</p>
          </div>
        </div>

        <button
          onClick={loadReports}
          className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            <span>Loading submitted reports...</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-3">
            <FileText className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-xs font-semibold">You have not submitted any incident reports yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                onClick={() => navigate(`/my-reports/${report.id}`)}
                className="p-5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(report.status)}
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded font-mono text-[10px] font-bold uppercase">
                      {report.category}
                    </span>
                  </div>

                  <p className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors truncate">
                    {report.description}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span>Location: {report.locationName}</span>
                    <span>•</span>
                    <span>{formatTimestamp(report.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1">
                    <span>Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
