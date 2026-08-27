import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  subscribeToIncidentUpdates,
  verifyIncident,
  updateIncidentStatus,
  addIncidentUpdate,
  acknowledgeIncident,
  recordIncidentRead,
} from '../../services/incidentService';
import type { Incident, IncidentUpdate, IncidentStatus } from '../../types/incident';
import { formatTimestamp } from '../../utils/format';
import {
  MapPin,
  Clock,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  Send,
  ChevronLeft,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const IncidentDetail: React.FC = () => {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [updates, setUpdates] = useState<IncidentUpdate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionBusy, setActionBusy] = useState<boolean>(false);
  const [newUpdateMsg, setNewUpdateMsg] = useState<string>('');
  const [resolutionSummary, setResolutionSummary] = useState<string>('');
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);
  const [acknowledged, setAcknowledged] = useState<boolean>(false);

  const fetchIncident = async () => {
    if (!incidentId) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'incidents', incidentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const item = { ...(snap.data() as Incident), id: snap.id };
        setIncident(item);

        if (currentUser) {
          await recordIncidentRead(incidentId, currentUser.uid);
        }
      } else {
        toast.error('Campus incident not found.');
      }
    } catch (err) {
      toast.error('Failed to load incident details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncident();
  }, [incidentId, currentUser]);

  // Subscribe to real-time live incident status updates
  useEffect(() => {
    if (!incidentId) return;
    const unsub = subscribeToIncidentUpdates(incidentId, (liveUpdates) => {
      setUpdates(liveUpdates);
    });
    return () => unsub();
  }, [incidentId]);

  const handleVerify = async () => {
    if (!currentUser || !incidentId || actionBusy) return;
    setActionBusy(true);
    try {
      await verifyIncident(incidentId, currentUser, userProfile);
      toast.success('Incident verified!');
      await fetchIncident();
    } catch (err: any) {
      toast.error(err.message || 'Verification failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleStatusChange = async (newStatus: IncidentStatus) => {
    if (!currentUser || !incidentId || !incident || actionBusy) return;
    if (newStatus === 'resolved') {
      setShowResolveModal(true);
      return;
    }

    setActionBusy(true);
    try {
      await updateIncidentStatus(incidentId, newStatus, incident, currentUser, userProfile);
      toast.success(`Incident status updated to '${newStatus}'.`);
      await fetchIncident();
    } catch (err: any) {
      toast.error(err.message || 'Status update failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmResolve = async () => {
    if (!currentUser || !incidentId || !incident || actionBusy) return;
    setActionBusy(true);
    try {
      await updateIncidentStatus(
        incidentId,
        'resolved',
        incident,
        currentUser,
        userProfile,
        resolutionSummary
      );
      toast.success('Incident resolved successfully!');
      setShowResolveModal(false);
      await fetchIncident();
    } catch (err: any) {
      toast.error(err.message || 'Resolution failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !incidentId || !incident || !newUpdateMsg.trim() || actionBusy) return;
    setActionBusy(true);
    try {
      await addIncidentUpdate(incidentId, newUpdateMsg.trim(), incident.status, currentUser, userProfile);
      toast.success('Status update posted!');
      setNewUpdateMsg('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to post update.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!currentUser || !incidentId || acknowledged) return;
    try {
      await acknowledgeIncident(incidentId, currentUser.uid);
      setAcknowledged(true);
      toast.success("Acknowledged: 'I've seen this alert.'");
    } catch (err) {
      toast.error('Failed to acknowledge incident.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-400 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
          <span>Loading live incident telemetry...</span>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <AlertOctagon className="w-12 h-12 text-slate-600" />
        <p className="text-slate-400 text-xs">Incident not found or has been removed.</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-slate-800 text-sky-400 rounded-xl text-xs font-bold"
        >
          Return to Feed
        </button>
      </div>
    );
  }

  const isCritical = incident.severity === 'critical';
  const isHigh = incident.severity === 'high';
  const isAdmin = userProfile?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                  isCritical
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                    : isHigh
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                }`}
              >
                {incident.severity.toUpperCase()} INCIDENT
              </span>

              <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] font-mono uppercase">
                STATUS: {incident.status}
              </span>
            </div>

            <h1 className="text-base sm:text-lg font-bold text-white mt-0.5">{incident.title}</h1>
          </div>
        </div>

        {/* User Acknowledgement Action */}
        <button
          onClick={handleAcknowledge}
          disabled={acknowledged}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            acknowledged
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{acknowledged ? "Seen Alert" : "Acknowledge"}</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Incident Summary Card */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-slate-200">{incident.locationName}</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Reported {formatTimestamp(incident.createdAt)}</span>
            </div>
          </div>

          <p className="text-sm text-slate-200 leading-relaxed font-sans">{incident.summary}</p>

          {/* Emergency Instructions Box */}
          {incident.emergencyInstructions && (
            <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-2xl space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase text-rose-400 tracking-wider block">
                🚨 Emergency Instructions
              </span>
              <p className="text-xs font-semibold text-rose-100">{incident.emergencyInstructions}</p>
            </div>
          )}

          {/* Resolution Summary Box */}
          {incident.status === 'resolved' && incident.resolutionSummary && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 tracking-wider block">
                ✔ Resolution Details
              </span>
              <p className="text-xs text-emerald-100">{incident.resolutionSummary}</p>
            </div>
          )}

          {/* Admin Control Strip */}
          {isAdmin && (
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
              {incident.status === 'reported' && (
                <button
                  onClick={handleVerify}
                  disabled={actionBusy}
                  className="px-3 py-1.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-amber-400 transition-all"
                >
                  Verify Incident
                </button>
              )}

              {incident.status === 'verifying' && (
                <button
                  onClick={() => handleStatusChange('active')}
                  disabled={actionBusy}
                  className="px-3 py-1.5 bg-rose-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-rose-400 transition-all"
                >
                  Activate Emergency Alert
                </button>
              )}

              {incident.status === 'active' && (
                <button
                  onClick={() => handleStatusChange('monitoring')}
                  disabled={actionBusy}
                  className="px-3 py-1.5 bg-sky-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-sky-400 transition-all"
                >
                  Move to Monitoring
                </button>
              )}

              {(incident.status === 'active' || incident.status === 'monitoring') && (
                <button
                  onClick={() => handleStatusChange('resolved')}
                  disabled={actionBusy}
                  className="px-3 py-1.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-all"
                >
                  Resolve Incident
                </button>
              )}
            </div>
          )}
        </div>

        {/* Live Status Updates Feed */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <span>Live Status Updates Timeline</span>
          </h3>

          {/* Admin Post Update Form */}
          {isAdmin && incident.status !== 'resolved' && (
            <form onSubmit={handleAddUpdate} className="flex gap-2">
              <input
                type="text"
                value={newUpdateMsg}
                onChange={(e) => setNewUpdateMsg(e.target.value)}
                placeholder="Post live status update..."
                maxLength={300}
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all"
              />
              <button
                type="submit"
                disabled={actionBusy || !newUpdateMsg.trim()}
                className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post Update</span>
              </button>
            </form>
          )}

          {/* Updates List */}
          {updates.length === 0 ? (
            <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-slate-500 text-xs">
              No live updates posted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {updates.map((update) => (
                <div
                  key={update.id}
                  className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="font-bold text-sky-400">{update.createdByName || 'Admin'}</span>
                    <span className="font-mono">{formatTimestamp(update.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-200">{update.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Resolution Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-white">Resolve Incident</h4>
            <p className="text-xs text-slate-400">
              Provide a summary of the resolution for historical record.
            </p>
            <textarea
              value={resolutionSummary}
              onChange={(e) => setResolutionSummary(e.target.value)}
              placeholder="e.g. Fire extinguished by emergency personnel. Area cleared for normal access."
              maxLength={500}
              rows={3}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs resize-none"
            />
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowResolveModal(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolve}
                disabled={actionBusy}
                className="flex-1 py-2 bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
