import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToActiveCampusBroadcasts } from '../services/broadcastService';
import type { CampusBroadcastDoc } from '../types/broadcast';
import { formatTimestamp } from '../utils/format';
import { AlertTriangle, ShieldAlert, ChevronRight, X } from 'lucide-react';

export const CampusAlertBanner: React.FC = () => {
  const navigate = useNavigate();
  const [broadcasts, setBroadcasts] = useState<CampusBroadcastDoc[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = subscribeToActiveCampusBroadcasts((items) => {
      setBroadcasts(items);
    });
    return () => unsub();
  }, []);

  const activeAlerts = broadcasts.filter((b) => b.id && !dismissedIds.has(b.id));

  if (activeAlerts.length === 0) return null;

  const current = activeAlerts[0];

  const handleDismiss = (id?: string) => {
    if (!id) return;
    setDismissedIds((prev) => new Set([...Array.from(prev), id]));
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-rose-950/90 border-rose-600/50 text-rose-200',
          badge: 'bg-rose-600 text-white font-bold',
          icon: <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse shrink-0" />,
        };
      case 'high':
        return {
          bg: 'bg-amber-950/90 border-amber-500/50 text-amber-200',
          badge: 'bg-amber-500 text-slate-950 font-bold',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
        };
      case 'moderate':
        return {
          bg: 'bg-sky-950/90 border-sky-500/50 text-sky-200',
          badge: 'bg-sky-500 text-slate-950 font-bold',
          icon: <AlertTriangle className="w-5 h-5 text-sky-400 shrink-0" />,
        };
      default:
        return {
          bg: 'bg-slate-900/90 border-slate-700 text-slate-200',
          badge: 'bg-slate-700 text-white font-bold',
          icon: <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0" />,
        };
    }
  };

  const styles = getSeverityStyles(current.severity);

  return (
    <div className="w-full mb-4">
      <div
        className={`p-4 rounded-3xl border ${styles.bg} backdrop-blur-xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all`}
      >
        <div className="flex items-start gap-3 min-w-0">
          {styles.icon}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${styles.badge}`}>
                CAMPUS ALERT: {current.severity}
              </span>
              <span className="text-[11px] opacity-70 font-mono">
                {formatTimestamp(current.createdAt)}
              </span>
            </div>

            <h4 className="text-sm font-bold truncate">{current.title}</h4>
            <p className="text-xs opacity-90 line-clamp-2">{current.body}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate(`/incidents/${current.incidentId}`)}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1 backdrop-blur-md"
          >
            <span>View Incident</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleDismiss(current.id)}
            className="p-2 text-white/60 hover:text-white rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
