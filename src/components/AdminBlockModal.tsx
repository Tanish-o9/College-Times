import React, { useState } from 'react';
import { X, Ban, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { blockUser } from '../services/adminService';
import toast from 'react-hot-toast';

interface AdminBlockModalProps {
  targetUserId: string;
  targetUserName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AdminBlockModal: React.FC<AdminBlockModalProps> = ({
  targetUserId,
  targetUserName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !targetUserId) return;

    if (!reason.trim()) {
      toast.error('Please specify a reason for blocking this user.');
      return;
    }

    setSubmitting(true);
    try {
      await blockUser(targetUserId, reason.trim(), currentUser);
      toast.success(`User ${targetUserName || targetUserId} has been blocked.`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to block user.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-6 shadow-2xl space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-rose-400">
            <Ban className="w-5 h-5" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              [Admin] Block User Account
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2.5 text-rose-200 text-xs">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-rose-100">Permanent Database Restriction</h4>
            <p className="mt-0.5 text-[11px] leading-relaxed">
              Blocking <span className="font-bold text-white">{targetUserName || targetUserId}</span> will permanently restrict their ability to post content, comment, send DMs, or join campus groups.
            </p>
          </div>
        </div>

        {/* Reason Form */}
        <form onSubmit={handleBlock} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
              Moderation Reason *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Abusive behavior, spamming confessions, harassment..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 text-white rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-rose-500 transition-all resize-none"
              required
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
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
              <span>Confirm Block</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
