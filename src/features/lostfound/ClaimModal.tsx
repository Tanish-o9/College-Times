import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { submitClaim } from '../../services/lostFoundClaimService';
import toast from 'react-hot-toast';
import { ShieldAlert, RefreshCw, X, CheckCircle2 } from 'lucide-react';

interface ClaimModalProps {
  itemId: string;
  itemTitle: string;
  itemReporterId: string;
  isOpen: boolean;
  onClose: () => void;
  onClaimSubmitted?: () => void;
}

export const ClaimModal: React.FC<ClaimModalProps> = ({
  itemId,
  itemTitle,
  itemReporterId,
  isOpen,
  onClose,
  onClaimSubmitted,
}) => {
  const { currentUser } = useAuth();
  const [explanation, setExplanation] = useState<string>('');
  const [verificationAnswer, setVerificationAnswer] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error('You must be logged in to claim an item.');
      return;
    }
    if (!explanation.trim()) {
      toast.error('Please provide an explanation of ownership.');
      return;
    }

    setSubmitting(true);
    try {
      await submitClaim(itemId, itemReporterId, explanation, verificationAnswer, currentUser);
      toast.success('Ownership claim submitted to reporter!');
      if (onClaimSubmitted) onClaimSubmitted();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit claim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <span>Claim This Item</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Submitting a claim for: <span className="font-bold text-white">"{itemTitle}"</span>. Your response is kept private between you and the reporter.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Ownership Context / Explanation <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="e.g. I lost this black wallet near C-Block around 2:00 PM..."
              rows={3}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Verification Answer (Optional)
            </label>
            <input
              type="text"
              value={verificationAnswer}
              onChange={(e) => setVerificationAnswer(e.target.value)}
              placeholder="e.g. Contains a blue keycard inside right pocket..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <span className="text-[10px] text-slate-500">
              Mention unique marks or features that only the true owner would know.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Submit Claim</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
