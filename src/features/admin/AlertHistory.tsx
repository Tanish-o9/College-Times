import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getAlertHistoryPage,
  retryAlertDelivery,
  cancelAlertDelivery,
} from '../../services/adminAlertService';
import type { NotificationDeliveryDoc } from '../../types/alert';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import {
  Bell,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RotateCcw,
  Ban
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AlertHistoryProps {
  onSelectAlert?: (postId: string) => void;
}

export const AlertHistory: React.FC<AlertHistoryProps> = ({ onSelectAlert }) => {
  const { currentUser, userProfile } = useAuth();
  const [alerts, setAlerts] = useState<NotificationDeliveryDoc[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [actionBusyPostId, setActionBusyPostId] = useState<string | null>(null);

  const loadAlerts = async (isInitial = true) => {
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const result = await getAlertHistoryPage(20, isInitial ? null : lastDoc);
      setAlerts((prev) => (isInitial ? result.alerts : [...prev, ...result.alerts]));
      setLastDoc(result.lastDoc);
      setHasMore(result.alerts.length === 20 && result.lastDoc !== null);
    } catch (err) {
      toast.error('Failed to load alert history.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadAlerts(true);
  }, []);

  const handleRetry = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || actionBusyPostId) return;
    setActionBusyPostId(postId);

    try {
      await retryAlertDelivery(postId, currentUser, userProfile);
      toast.success(`Queued retry attempt for alert ${postId.slice(0, 8)}`);
      setAlerts((prev) =>
        prev.map((a) =>
          a.postId === postId ? { ...a, status: 'pending', attemptCount: (a.attemptCount || 0) + 1 } : a
        )
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to retry alert.');
    } finally {
      setActionBusyPostId(null);
    }
  };

  const handleCancel = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || actionBusyPostId) return;
    setActionBusyPostId(postId);

    try {
      await cancelAlertDelivery(postId, currentUser, userProfile);
      toast.success(`Cancelled pending alert ${postId.slice(0, 8)}`);
      setAlerts((prev) =>
        prev.map((a) => (a.postId === postId ? { ...a, status: 'cancelled' } : a))
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel alert.');
    } finally {
      setActionBusyPostId(null);
    }
  };

  const getStatusBadge = (status: NotificationDeliveryDoc['status']) => {
    switch (status) {
      case 'sent':
        return (
          <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-mono text-[10px] font-bold uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Sent</span>
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full font-mono text-[10px] font-bold uppercase flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      case 'pending':
      case 'sending':
        return (
          <span className="px-2 py-0.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-full font-mono text-[10px] font-bold uppercase flex items-center gap-1 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>{status}</span>
          </span>
        );
      case 'cancelled':
      default:
        return (
          <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-full font-mono text-[10px] font-bold uppercase flex items-center gap-1">
            <Ban className="w-3 h-3" />
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-sky-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Campus Alert Log</h2>
        </div>
        <button
          onClick={() => loadAlerts(true)}
          className="p-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition-all"
          title="Refresh History"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-2xl flex items-center justify-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Loading campus alert delivery logs...</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-2xl text-center text-slate-400 text-xs">
          No campus push alerts recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.postId}
              onClick={() => onSelectAlert?.(alert.postId)}
              className="p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(alert.status)}

                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px] font-bold">
                    {alert.topic || alert.audienceType}
                  </span>

                  {alert.priority === 'emergency' && (
                    <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 font-mono text-[9px] font-bold uppercase rounded border border-rose-500/30">
                      Emergency
                    </span>
                  )}
                </div>

                <p className="text-xs font-bold text-white truncate">
                  {alert.postTitle || `Alert for Post (${alert.postId.slice(0, 8)})`}
                </p>

                <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 pt-0.5">
                  <span>Attempts: {alert.attemptCount || 1}/3</span>
                  {alert.errorCode && (
                    <span className="text-rose-400 truncate max-w-[180px]">
                      Error: {alert.errorCode}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {alert.status === 'failed' && (alert.attemptCount || 0) < 3 && (
                  <button
                    onClick={(e) => handleRetry(alert.postId, e)}
                    disabled={actionBusyPostId === alert.postId}
                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                )}

                {alert.status === 'pending' && (
                  <button
                    onClick={(e) => handleCancel(alert.postId, e)}
                    disabled={actionBusyPostId === alert.postId}
                    className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                )}

                <ChevronRight className="w-4 h-4 text-slate-600" />
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => loadAlerts(false)}
              disabled={loadingMore}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-xs font-semibold text-sky-400 transition-all flex items-center justify-center gap-2"
            >
              {loadingMore ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Load Older Alert Logs</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
