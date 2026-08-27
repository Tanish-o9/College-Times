import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { subscribeToActiveIncidents } from '../../services/incidentService';
import { getUserGroupIds } from '../../services/groupService';
import type { Incident } from '../../types/incident';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export const ActiveIncidentStrip: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setIncidents([]);
      return;
    }

    let isMounted = true;
    let unsub: (() => void) | null = null;

    getUserGroupIds(currentUser.uid)
      .then((gIds) => {
        if (!isMounted) return;
        unsub = subscribeToActiveIncidents(currentUser, userProfile, gIds, (activeItems) => {
          setIncidents(activeItems);
        });
      })
      .catch(() => {
        setIncidents([]);
      });

    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, [currentUser, userProfile]);

  if (!currentUser || incidents.length === 0) return null;

  const urgentIncidents = incidents.filter(
    (inc) => inc.severity === 'high' || inc.severity === 'critical'
  );
  if (urgentIncidents.length === 0) return null;

  const displayList = urgentIncidents.slice(0, 3);

  return (
    <div className="w-full space-y-2 mb-4">
      {displayList.map((inc) => {
        const isCritical = inc.severity === 'critical';

        return (
          <div
            key={inc.id}
            onClick={() => navigate(`/incidents/${inc.id}`)}
            className={`w-full p-3.5 sm:p-4 rounded-2xl border backdrop-blur-xl shadow-xl transition-all cursor-pointer flex items-center justify-between gap-3 group relative overflow-hidden ${
              isCritical
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-100 shadow-rose-500/10'
                : 'bg-amber-950/90 border-amber-500/40 text-amber-100 shadow-amber-500/10'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  isCritical
                    ? 'bg-rose-500/20 border-rose-400/30 text-rose-400 animate-pulse'
                    : 'bg-amber-500/20 border-amber-400/30 text-amber-400'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-black/40 border border-white/10">
                    🚨 {inc.severity.toUpperCase()} INCIDENT
                  </span>
                  <span className="text-[10px] font-mono opacity-75 uppercase">
                    {inc.locationName}
                  </span>
                </div>

                <p className="text-xs font-bold text-white truncate mt-0.5">{inc.title}</p>
              </div>
            </div>

            <button
              onClick={() => navigate(`/incidents/${inc.id}`)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 border ${
                isCritical
                  ? 'bg-rose-500 text-slate-950 border-rose-400 hover:bg-rose-400'
                  : 'bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400'
              }`}
            >
              <span>View Incident</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
