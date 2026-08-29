import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getPendingVerificationRequests,
  approveVerificationRequest,
  rejectVerificationRequest,
  type VerificationRequest
} from '../../services/identityService';
import { ShieldCheck, UserCheck, RefreshCw, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const VerificationQueue: React.FC = () => {
  const { userProfile } = useAuth();

  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  // Reject Dialog state
  const [rejectRequestId, setRejectRequestId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    try {
      const pending = await getPendingVerificationRequests();
      setRequests(pending);
    } catch {
      toast.error('Failed to load verification queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (id: string) => {
    setActionBusy(id);
    try {
      await approveVerificationRequest(id);
      toast.success('Identity verification approved! Badges updated. 🎖️');
      loadRequests();
    } catch (err: any) {
      toast.error(err.message || 'Approval process failed.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectRequestId || !rejectReason.trim()) return;

    setActionBusy(rejectRequestId);
    try {
      await rejectVerificationRequest(rejectRequestId, rejectReason.trim());
      toast.success('Verification request rejected.');
      setRejectRequestId(null);
      setRejectReason('');
      loadRequests();
    } catch {
      toast.error('Rejection process failed.');
    } finally {
      setActionBusy(null);
    }
  };

  if (userProfile?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-xs text-rose-500 font-bold bg-slate-900 border border-slate-850 rounded-3xl">
        Access Denied: Admin authorization required.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="relative p-6 rounded-3xl bg-slate-900 border border-slate-805 shadow-xl overflow-hidden flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-wider font-mono">Identity Verification Queue</h1>
            <p className="text-[10px] text-slate-500 font-mono">Verify student email, departments, and batches</p>
          </div>
        </div>

        <button
          onClick={loadRequests}
          className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-300 rounded-xl transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Reject Reason Form Dialog */}
      {rejectRequestId && (
        <form onSubmit={handleReject} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3.5 shadow-xl">
          <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1">
            <AlertCircle className="w-4 h-4 text-rose-455" />
            <span>Rejection coordinates</span>
          </h3>
          <div>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. ID card upload is blurry / Email domain does not match college registry..."
              className="w-full bg-slate-950 border border-slate-805 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setRejectRequestId(null);
                setRejectReason('');
              }}
              className="px-3.5 py-1.5 bg-slate-950 border border-slate-850 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-455 text-slate-950 text-xs font-black uppercase rounded-xl transition-all"
            >
              Confirm Rejection
            </button>
          </div>
        </form>
      )}

      {/* Pending List */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs">Loading verifications queue...</div>
      ) : requests.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs italic bg-slate-900 border border-slate-850 rounded-3xl">
          No pending verification requests in queue.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="p-5 bg-slate-900 border border-slate-855 rounded-3xl space-y-4 shadow-md"
            >
              <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                <div className="space-y-1.5 min-w-0">
                  <h3 className="text-xs font-black text-white">{req.userDisplayName}</h3>
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-450 font-mono">
                    <span>Email: <span className="text-white font-bold">{req.collegeEmail}</span></span>
                    <span>•</span>
                    <span>Dept: <span className="text-white font-bold">{req.departmentId}</span></span>
                    <span>•</span>
                    <span>Batch: <span className="text-white font-bold">{req.batchYear}</span></span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(req.id!)}
                    disabled={actionBusy === req.id}
                    className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-405 text-slate-950 text-xs font-black uppercase rounded-xl transition-all flex items-center gap-1 shadow-md"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Approve</span>
                  </button>

                  <button
                    onClick={() => setRejectRequestId(req.id!)}
                    disabled={actionBusy === req.id}
                    className="px-3.5 py-1.5 bg-slate-950 hover:bg-rose-500/10 border border-slate-850 hover:border-rose-500/20 text-slate-400 hover:text-rose-455 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>

              {req.idImageUrl && (
                <div className="border border-slate-800 rounded-2xl overflow-hidden max-w-sm">
                  <p className="p-2 bg-slate-950 text-[9px] font-bold text-slate-500 font-mono border-b border-slate-800">
                    ATTACHED STUDENT ID CARD
                  </p>
                  <img src={req.idImageUrl} alt="Student ID Document" className="w-full max-h-48 object-cover" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
