import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { AdminAuditLogDoc } from '../../types/alert';
import { formatTimestamp } from '../../utils/format';
import {
  Clock,
  Pin,
  AlertTriangle,
  RotateCcw,
  Ban,
  CheckCircle2,
  Activity,
  UserCheck
} from 'lucide-react';

interface AlertTimelineProps {
  postId: string;
}

export const AlertTimeline: React.FC<AlertTimelineProps> = ({ postId }) => {
  const [logs, setLogs] = useState<AdminAuditLogDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!postId) return;
    const fetchTimeline = async () => {
      setLoading(true);
      try {
        const colRef = collection(db, 'adminAuditLogs');
        const q = query(colRef, where('targetId', '==', postId), orderBy('timestamp', 'asc'), limit(20));
        const snap = await getDocs(q);

        const items = snap.docs.map((d) => ({
          ...(d.data() as AdminAuditLogDoc),
          id: d.id,
        }));

        setLogs(items);
      } catch (err) {
        console.error(`Error fetching timeline for ${postId}:`, err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [postId]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'ALERT_CREATED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'ALERT_PINNED':
      case 'pin_alert':
        return <Pin className="w-3.5 h-3.5 text-amber-400" />;
      case 'ALERT_ESCALATED':
      case 'escalate_alert':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
      case 'retry_alert':
        return <RotateCcw className="w-3.5 h-3.5 text-sky-400" />;
      case 'cancel_alert':
      case 'ALERT_DEACTIVATED':
        return <Ban className="w-3.5 h-3.5 text-slate-400" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-sky-400" />
        <span>Administrative Audit Timeline</span>
      </h4>

      {loading ? (
        <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">
          Loading audit events...
        </div>
      ) : logs.length === 0 ? (
        <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">
          No audit timeline events recorded for this alert.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {logs.map((log) => (
            <div key={log.id || `${log.action}-${log.timestamp}`} className="relative group">
              <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                {getActionIcon(log.action)}
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white font-mono uppercase text-[10px]">
                    {log.action.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-slate-500" />
                  <span>Actor: {log.actorName || log.actorId.slice(0, 8)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
