import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getAlertDetail,
} from '../../services/adminAlertService';
import {
  getAlertMetrics,
} from '../../services/alertAnalyticsService';
import {
  pinActiveAlert,
  unpinActiveAlert,
  escalateAlertPriority,
} from '../../services/activeAlertService';
import type { NotificationDeliveryDoc, AlertMetricsDoc } from '../../types/alert';
import { AlertTimeline } from './AlertTimeline';
import {
  X,
  Bell,
  RefreshCw,
  AlertTriangle,
  Pin,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AlertAdminDetailProps {
  postId: string;
  onClose: () => void;
}

export const AlertAdminDetail: React.FC<AlertAdminDetailProps> = ({ postId, onClose }) => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [alertDoc, setAlertDoc] = useState<NotificationDeliveryDoc | null>(null);
  const [metrics, setMetrics] = useState<AlertMetricsDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionBusy, setActionBusy] = useState<boolean>(false);
  const [showEscalateConfirm, setShowEscalateConfirm] = useState<boolean>(false);

  const loadData = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const [detail, m] = await Promise.all([
        getAlertDetail(postId),
        getAlertMetrics(postId),
      ]);
      setAlertDoc(detail);
      setMetrics(m);
    } catch (err) {
      toast.error('Failed to load alert admin detail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [postId]);

  const handleTogglePin = async () => {
    if (!currentUser || !alertDoc || actionBusy) return;
    setActionBusy(true);
    try {
      if (alertDoc.priority === 'emergency') {
        await unpinActiveAlert(postId, currentUser, userProfile);
        toast.success('Unpinned alert.');
      } else {
        await pinActiveAlert(postId, currentUser, userProfile);
        toast.success('Pinned alert to top of feed.');
      }
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Pin action failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmEscalate = async () => {
    if (!currentUser || actionBusy) return;
    setActionBusy(true);
    try {
      await escalateAlertPriority(postId, 'emergency', currentUser, userProfile);
      toast.success('Alert priority escalated to URGENT!');
      setShowEscalateConfirm(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Escalation failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleOpenOriginalPost = () => {
    onClose();
    navigate(`/feed?postId=${postId}`);
  };

  const deliveredCount = alertDoc?.successCount || (alertDoc?.status === 'sent' ? 1 : 0);
  const openRate =
    deliveredCount > 0
      ? Math.min(100, Math.round(((metrics?.uniqueOpenedCount || 0) / deliveredCount) * 1000) / 10)
      : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
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
            <h3 className="text-base font-bold text-white">Campus Alert Control Center</h3>
            <p className="text-[11px] font-mono text-slate-400 truncate max-w-[240px]">
              Post ID: {postId}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading telemetry & metrics...</span>
          </div>
        ) : !alertDoc ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            Alert details not found.
          </div>
        ) : (
          <div className="space-y-6 text-xs">
            {/* Header Telemetry */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-950/60 rounded-2xl border border-slate-800 text-center">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono text-slate-500 uppercase block">Sent</span>
                <span className="text-sm font-bold text-white font-mono">{alertDoc.status === 'sent' ? 1 : 0}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono text-slate-500 uppercase block">Delivered</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">{deliveredCount}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono text-slate-500 uppercase block">Unique Opens</span>
                <span className="text-sm font-bold text-sky-400 font-mono">{metrics?.uniqueOpenedCount || 0}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono text-slate-500 uppercase block">Open Rate</span>
                <span className="text-sm font-bold text-amber-400 font-mono">{openRate}%</span>
              </div>
            </div>

            {/* Alert Controls */}
            <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Administrative Controls
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleOpenOriginalPost}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-all flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Feed Post</span>
                </button>

                <button
                  onClick={handleTogglePin}
                  disabled={actionBusy}
                  className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl font-bold transition-all flex items-center gap-1.5"
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span>Toggle Pin</span>
                </button>

                {alertDoc.priority !== 'emergency' && (
                  <button
                    onClick={() => setShowEscalateConfirm(true)}
                    disabled={actionBusy}
                    className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl font-bold transition-all flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Escalate to Urgent</span>
                  </button>
                )}
              </div>
            </div>

            {/* Audit Timeline */}
            <AlertTimeline postId={postId} />
          </div>
        )}

        {/* Escalation Confirmation Modal */}
        {showEscalateConfirm && (
          <div className="fixed inset-0 z-60 bg-slate-950/90 flex items-center justify-center p-4">
            <div className="max-w-sm w-full p-6 bg-slate-900 border border-rose-500/40 rounded-3xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Escalate Alert to URGENT?</h4>
              <p className="text-xs text-slate-300">
                This will elevate this alert to an Emergency Campus Alert and notify all audience subscribers immediately.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowEscalateConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmEscalate}
                  disabled={actionBusy}
                  className="flex-1 py-2.5 bg-rose-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg"
                >
                  Confirm Escalation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
