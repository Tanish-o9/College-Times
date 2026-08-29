import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getReporterReports } from '../../services/reportService';
import type { Report } from '../../services/reportService';
import { ArrowLeft, Flag, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const fetchReports = async () => {
      try {
        const res = await getReporterReports(currentUser.uid);
        setReports(res);
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [currentUser]);

  const getStatusBadge = (status: Report['status']) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
            Open
          </span>
        );
      case 'REVIEWING':
        return (
          <span className="px-2.5 py-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
            Reviewing
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span>Resolved</span>
          </span>
        );
      case 'DISMISSED':
        return (
          <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
            Dismissed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col pb-12">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-white">Your Safety Reports</h1>
          <p className="text-[10px] text-slate-500 font-mono">Track status of content reported by you</p>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading report statuses...</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3 bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
            <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center">
              <Flag className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-sm font-bold text-slate-300">Clean Slate!</p>
            <p className="text-xs text-slate-500 max-w-xs">You have not submitted any safety reports. Keep helping AKGEC stay safe and friendly!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3.5 shadow-lg">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-950 border border-slate-850 rounded text-[9px] font-bold text-slate-400 uppercase font-mono">
                        {report.targetType} Report
                      </span>
                      {report.createdAt && (
                        <span className="text-[10px] text-slate-500">
                          {report.createdAt.toDate ? report.createdAt.toDate().toLocaleDateString() : new Date(report.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs font-bold text-slate-200">Reason: {report.reason}</h3>
                  </div>
                  <div>{getStatusBadge(report.status)}</div>
                </div>

                {report.description && (
                  <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-slate-800/40">
                    {report.description}
                  </p>
                )}

                {report.status === 'RESOLVED' && (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-start gap-2.5 text-[11px] text-emerald-300">
                    <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Moderator Action Taken</span>
                      <p className="mt-0.5 text-emerald-400/80 leading-relaxed">
                        This issue has been resolved. The content has been reviewed, and appropriate action has been applied. Thank you for making our campus safer!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
