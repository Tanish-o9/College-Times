import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { BackButton } from '../../components/BackButton';
import { getIncidentReportById } from '../../services/incidentReportService';
import type { IncidentReport } from '../../types/incidentReport';
import { formatTimestamp } from '../../utils/format';
import {
  FileText,
  Clock,
  MapPin,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const IncidentReportDetail: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState<IncidentReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!reportId || !currentUser) return;
    setLoading(true);
    getIncidentReportById(reportId, currentUser, userProfile)
      .then((data) => setReport(data))
      .catch((err) => toast.error(err.message || 'Failed to load report detail.'))
      .finally(() => setLoading(false));
  }, [reportId, currentUser, userProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
          <span>Loading report detail...</span>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <FileText className="w-12 h-12 text-slate-600" />
        <p className="text-slate-400 text-xs">Incident report not found.</p>
        <button
          onClick={() => navigate('/my-reports')}
          className="px-4 py-2 bg-slate-800 text-amber-400 rounded-xl text-xs font-bold"
        >
          Return to My Reports
        </button>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton customFallback="/my-reports" />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white">Incident Report Detail</h1>
            <p className="text-[11px] font-mono text-slate-400">Report ID: {report.id}</p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full font-mono text-xs font-bold uppercase bg-slate-800 text-slate-300">
          {report.status}
        </span>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-slate-200">{report.locationName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Submitted {formatTimestamp(report.createdAt)}</span>
            </div>
          </div>

          <p className="text-sm text-slate-200 leading-relaxed font-sans">{report.description}</p>

          {/* Evidence Attachments Gallery */}
          {report.evidence && report.evidence.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Evidence Attachments ({report.evidence.length})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {report.evidence.map((item, idx) => (
                  <div key={idx} className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                    {item.type === 'video' ? (
                      <video src={item.downloadUrl} controls className="w-full h-32 object-cover" />
                    ) : (
                      <img src={item.downloadUrl} alt="Evidence" className="w-full h-32 object-cover" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Details Box */}
          {report.reviewNote && (
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">
                Admin Review Note
              </span>
              <p className="text-xs text-slate-300">{report.reviewNote}</p>
            </div>
          )}

          {/* Linked Incident Action */}
          {report.incidentId && (
            <div className="pt-2">
              <button
                onClick={() => navigate(`/incidents/${report.incidentId}`)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg"
              >
                <span>View Verified Campus Incident</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
