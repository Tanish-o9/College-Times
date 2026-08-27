import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getAlertDetail,
  retryAlertDelivery,
  cancelAlertDelivery,
} from '../../services/adminAlertService';
import type { NotificationDeliveryDoc } from '../../types/alert';
import {
  X,
  Bell,
  RefreshCw,
  RotateCcw,
  Ban
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AlertDetailProps {
  postId: string;
  onClose: () => void;
}

export const AlertDetail: React.FC<AlertDetailProps> = ({ postId, onClose }) => {
  const { currentUser, userProfile } = useAuth();
  const [alert, setAlert] = useState<NotificationDeliveryDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionBusy, setActionBusy] = useState<boolean>(false);

  const fetchDetail = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const data = await getAlertDetail(postId);
      setAlert(data);
    } catch (err) {
      toast.error('Failed to load alert detail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [postId]);

  const handleRetry = async () => {
    if (!currentUser || !alert || actionBusy) return;
    setActionBusy(true);
    try {
      await retryAlertDelivery(postId, currentUser, userProfile);
      toast.success('Queued delivery retry attempt.');
      await fetchDetail();
    } catch (err: any) {
      toast.error(err.message || 'Retry failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!currentUser || !alert || actionBusy) return;
    setActionBusy(true);
    try {
      await cancelAlertDelivery(postId, currentUser, userProfile);
      toast.success('Alert delivery cancelled.');
      await fetchDetail();
    } catch (err: any) {
      toast.error(err.message || 'Cancellation failed.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Alert Delivery Diagnostics</h3>
            <p className="text-[11px] font-mono text-slate-400 truncate max-w-[240px]">
              Post ID: {postId}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading diagnostics...</span>
          </div>
        ) : !alert ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            Alert delivery record not found.
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px] font-mono uppercase">Delivery Status</span>
                <span className="font-bold text-white uppercase text-xs">{alert.status}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-mono uppercase">FCM Topic</span>
                <span className="font-bold text-sky-400 font-mono text-xs">{alert.topic}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-mono uppercase">Audience Type</span>
                <span className="font-bold text-slate-200 uppercase text-xs">{alert.audienceType}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-mono uppercase">Priority</span>
                <span className="font-bold text-amber-400 uppercase text-xs">{alert.priority}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-mono uppercase">Attempt Count</span>
                <span className="font-bold text-slate-200 font-mono text-xs">{alert.attemptCount || 1}/3</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-mono uppercase">Invalid Tokens</span>
                <span className="font-bold text-slate-200 font-mono text-xs">{alert.invalidTokenCount || 0}</span>
              </div>
            </div>

            {alert.errorCode && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl space-y-1">
                <span className="font-bold font-mono text-[10px] uppercase block">Last Error</span>
                <p className="font-mono text-xs leading-relaxed">{alert.errorCode}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              {alert.status === 'failed' && (alert.attemptCount || 0) < 3 && (
                <button
                  onClick={handleRetry}
                  disabled={actionBusy}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Retry Delivery</span>
                </button>
              )}

              {alert.status === 'pending' && (
                <button
                  onClick={handleCancel}
                  disabled={actionBusy}
                  className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-1.5"
                >
                  <Ban className="w-4 h-4" />
                  <span>Cancel Delivery</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
