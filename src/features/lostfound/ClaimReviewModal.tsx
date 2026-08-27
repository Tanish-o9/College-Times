import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getItemClaims, reviewClaim } from '../../services/lostFoundClaimService';
import type { LostFoundClaim } from '../../types/lostFound';
import toast from 'react-hot-toast';
import { ShieldCheck, RefreshCw, X, Check, XCircle } from 'lucide-react';

interface ClaimReviewModalProps {
  itemId: string;
  itemTitle: string;
  itemReporterId: string;
  isOpen: boolean;
  onClose: () => void;
  onClaimResolved?: () => void;
}

export const ClaimReviewModal: React.FC<ClaimReviewModalProps> = ({
  itemId,
  itemTitle,
  itemReporterId,
  isOpen,
  onClose,
  onClaimResolved,
}) => {
  const { currentUser } = useAuth();
  const [claims, setClaims] = useState<LostFoundClaim[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !itemId || !currentUser) return;
    let mounted = true;

    const loadClaims = async () => {
      setLoading(true);
      try {
        const list = await getItemClaims(itemId, itemReporterId, currentUser);
        if (mounted) setClaims(list);
      } catch (err) {
        toast.error('Failed to load claims.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadClaims();
    return () => {
      mounted = false;
    };
  }, [isOpen, itemId, itemReporterId, currentUser]);

  if (!isOpen) return null;

  const handleReview = async (claimId: string, claimantId: string, status: 'approved' | 'rejected') => {
    if (!currentUser) return;
    setReviewingId(claimId);
    try {
      await reviewClaim(itemId, claimId, status, currentUser, claimantId);
      toast.success(status === 'approved' ? 'Claim Approved! Item marked resolved.' : 'Claim Rejected.');
      setClaims((prev) =>
        prev.map((c) => (c.id === claimId ? { ...c, status } : c))
      );
      if (status === 'approved' && onClaimResolved) {
        onClaimResolved();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update claim status.');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            <span>Review Ownership Claims</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Claims submitted for <span className="font-bold text-white">"{itemTitle}"</span>.
        </p>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
            <span>Loading claims...</span>
          </div>
        ) : claims.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500 italic">No claims submitted yet.</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{claim.claimantName}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    claim.status === 'approved'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : claim.status === 'rejected'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {claim.status.toUpperCase()}
                  </span>
                </div>

                <div className="text-xs text-slate-300 space-y-1">
                  <p><span className="text-slate-500 font-semibold">Explanation:</span> {claim.explanation}</p>
                  {claim.verificationAnswer && (
                    <p className="text-purple-300">
                      <span className="text-slate-500 font-semibold">Verification Answer:</span> {claim.verificationAnswer}
                    </p>
                  )}
                </div>

                {claim.status === 'pending' && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => handleReview(claim.id, claim.claimantId, 'rejected')}
                      disabled={reviewingId === claim.id}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleReview(claim.id, claim.claimantId, 'approved')}
                      disabled={reviewingId === claim.id}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md"
                    >
                      {reviewingId === claim.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Approve Claim</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
