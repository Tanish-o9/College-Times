import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  takeReportReview,
  verifyIncidentReport,
  rejectOrDismissReport,
} from '../../services/incidentReportService';
import { initiateCampusBroadcast } from '../../services/broadcastService';
import type { IncidentReport, ReportSeverity } from '../../types/incidentReport';
import { formatTimestamp } from '../../utils/format';
import {
  CheckCircle2,
  MapPin,
  UserCheck,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface IncidentReportCardProps {
  report: IncidentReport;
  onRefresh: () => void;
}

export const IncidentReportCard: React.FC<IncidentReportCardProps> = ({ report, onRefresh }) => {
  const { currentUser, userProfile } = useAuth();

  const [actionBusy, setActionBusy] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Verification Form State
  const [severity, setSeverity] = useState<ReportSeverity>('moderate');
  const [incidentTitle, setIncidentTitle] = useState(report.description.slice(0, 80));
  const [incidentSummary, setIncidentSummary] = useState(report.description);
  const [locationName, setLocationName] = useState(report.locationName);
  const [affectedArea, setAffectedArea] = useState<'campus' | 'department' | 'building' | 'batch' | 'community'>('campus');
  const [existingIncidentId, setExistingIncidentId] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [broadcastToCampus, setBroadcastToCampus] = useState(false);

  const handleTakeReview = async () => {
    if (!currentUser || actionBusy) return;
    setActionBusy(true);
    try {
      await takeReportReview(report.id, currentUser, userProfile);
      toast.success('Under review status assigned.');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to take review.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmVerify = async () => {
    if (!currentUser || actionBusy) return;
    setActionBusy(true);
    try {
      const targetId = await verifyIncidentReport(
        report.id,
        severity,
        reviewNote,
        !existingIncidentId
          ? {
              title: incidentTitle.trim() || 'Campus Incident',
              summary: incidentSummary.trim() || report.description,
              locationName: locationName.trim() || report.locationName,
              affectedArea,
            }
          : null,
        existingIncidentId.trim() || undefined,
        currentUser,
        userProfile
      );

      if (broadcastToCampus && targetId) {
        await initiateCampusBroadcast(
          targetId,
          incidentTitle.trim() || 'Campus Incident Alert',
          incidentSummary.trim() || report.description,
          severity === 'unknown' ? 'moderate' : severity,
          currentUser,
          userProfile
        );
        toast.success('Campus push notification broadcast initiated!');
      } else {
        toast.success('Incident report verified successfully!');
      }

      setShowVerifyModal(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Verification failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmReject = async (status: 'rejected' | 'dismissed') => {
    if (!currentUser || actionBusy) return;
    setActionBusy(true);
    try {
      await rejectOrDismissReport(report.id, status, reviewNote, currentUser, userProfile);
      toast.success(`Report marked as ${status}.`);
      setShowRejectModal(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
            {report.category}
          </span>
          <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
            STATUS: {report.status}
          </span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          {formatTimestamp(report.createdAt)}
        </span>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <UserCheck className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-bold text-slate-200">{report.reporterDisplayName || 'Student'}</span>
          <span>•</span>
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-300">{report.locationName}</span>
        </div>
        <p className="text-slate-200 font-sans leading-relaxed pt-1">{report.description}</p>
      </div>

      {report.evidence && report.evidence.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pt-1">
          {report.evidence.map((item, idx) => (
            <a
              key={idx}
              href={item.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="w-16 h-16 rounded-xl border border-slate-800 overflow-hidden shrink-0 bg-slate-950 block"
            >
              {item.type === 'video' ? (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-purple-400 bg-purple-950/40">
                  VIDEO
                </div>
              ) : (
                <img src={item.downloadUrl} alt="Evidence" className="w-full h-full object-cover" />
              )}
            </a>
          ))}
        </div>
      )}

      {/* Admin Actions */}
      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2 text-xs">
        {report.status === 'pending' && (
          <button
            onClick={handleTakeReview}
            disabled={actionBusy}
            className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl font-bold transition-all"
          >
            Take Review
          </button>
        )}

        {(report.status === 'pending' || report.status === 'under_review') && (
          <>
            <button
              onClick={() => setShowVerifyModal(true)}
              disabled={actionBusy}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold transition-all flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verify Report</span>
            </button>

            <button
              onClick={() => setShowRejectModal(true)}
              disabled={actionBusy}
              className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl font-bold transition-all"
            >
              Reject / Dismiss
            </button>
          </>
        )}
      </div>

      {/* Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 text-xs shadow-2xl">
            <h4 className="text-base font-bold text-white">Verify Incident Report</h4>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Assigned Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as ReportSeverity)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              >
                <option value="low">🟢 Low</option>
                <option value="moderate">🟡 Moderate</option>
                <option value="high">🟠 High</option>
                <option value="critical">🔴 Critical</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Incident Title</label>
              <input
                type="text"
                value={incidentTitle}
                onChange={(e) => setIncidentTitle(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Incident Summary</label>
              <textarea
                value={incidentSummary}
                onChange={(e) => setIncidentSummary(e.target.value)}
                maxLength={500}
                rows={2}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold text-slate-300 block">Location Name</label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  maxLength={150}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 block">Affected Area</label>
                <select
                  value={affectedArea}
                  onChange={(e) => setAffectedArea(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                >
                  <option value="campus">Campus</option>
                  <option value="department">Department</option>
                  <option value="building">Building</option>
                  <option value="batch">Batch</option>
                  <option value="community">Community</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Link Existing Incident ID (Optional)</label>
              <input
                type="text"
                value={existingIncidentId}
                onChange={(e) => setExistingIncidentId(e.target.value)}
                placeholder="Leave blank to create a new incident"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
            </div>

            {/* Broadcast Checkbox & Prominent Confirmation */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={broadcastToCampus}
                  onChange={(e) => setBroadcastToCampus(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0"
                />
                <span className="font-bold text-white text-xs">Broadcast Instant Alert to Campus</span>
              </label>

              {broadcastToCampus && (severity === 'high' || severity === 'critical') && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 text-[11px] text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    <strong>Instant Push Warning:</strong> This will send an instant FCM push notification to 10,000+ subscribed campus members.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowVerifyModal(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVerify}
                disabled={actionBusy}
                className="flex-1 py-2 bg-emerald-500 text-slate-950 rounded-xl font-bold"
              >
                Confirm Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 text-xs shadow-2xl">
            <h4 className="text-base font-bold text-white">Reject or Dismiss Report</h4>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Add optional review note for reporter..."
              maxLength={300}
              rows={3}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs resize-none"
            />
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmReject('rejected')}
                disabled={actionBusy}
                className="flex-1 py-2 bg-rose-500 text-slate-950 rounded-xl font-bold"
              >
                Reject
              </button>
              <button
                onClick={() => handleConfirmReject('dismissed')}
                disabled={actionBusy}
                className="flex-1 py-2 bg-slate-700 text-slate-200 rounded-xl font-bold"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
