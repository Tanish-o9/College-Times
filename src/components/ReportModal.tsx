import React, { useState } from 'react';
import { X, Flag, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { createReport, type ReportType } from '../services/reportService';
import toast from 'react-hot-toast';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: ReportType;
  targetTitle?: string;
  parentId?: string;
}

const COMMON_REASONS = [
  'Spam or Misleading',
  'Harassment or Bullying',
  'Hate Speech or Discrimination',
  'Inappropriate or Explicit Content',
  'Impersonation or Fake Account',
  'Violence or Dangerous Behavior',
  'Other Campus Policy Violation',
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetId,
  targetType,
  targetTitle,
  parentId,
}) => {
  const { currentUser } = useAuth();
  const [reason, setReason] = useState(COMMON_REASONS[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !targetId || submitting) return;

    setSubmitting(true);
    try {
      await createReport(
        currentUser.uid,
        targetId,
        targetType,
        reason,
        description,
        parentId
      );
      setSubmitted(true);
      toast.success('Report submitted to campus moderation.');
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 relative overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-rose-400">
            <Flag className="w-5 h-5" />
            <h3 id="report-modal-title" className="text-sm font-black text-white uppercase tracking-wider">
              Report Content
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="text-base font-bold text-white">Thank You</h4>
            <p className="text-xs text-slate-400">
              Your report has been received and flagged for campus moderation review.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {targetTitle && (
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs text-slate-300">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Reporting Target:
                </span>
                <p className="font-semibold text-white truncate mt-0.5">{targetTitle}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                Select Reason *
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {COMMON_REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      reason === r
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-200 font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="accent-rose-500"
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                Additional Description (Optional)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide any context to help moderation team review..."
                maxLength={500}
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 text-white rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-rose-500 transition-all resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
                <span>Submit Report</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
