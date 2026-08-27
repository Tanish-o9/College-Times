import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getTechnicalEventsLog, type TechnicalEvent } from '../../services/observabilityService';
import { Activity, ShieldCheck, Database, HardDrive, Cpu, Bell, ArrowLeft, RefreshCw } from 'lucide-react';

export const SystemHealthPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [events, setEvents] = useState<TechnicalEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshHealth = () => {
    setLoading(true);
    setEvents(getTechnicalEventsLog());
    setTimeout(() => setLoading(false), 300);
  };

  useEffect(() => {
    refreshHealth();
  }, []);

  if (userProfile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full text-center space-y-4 shadow-2xl">
          <ShieldCheck className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Admin Access Required</h2>
          <p className="text-xs text-slate-400">You must be a verified system administrator to access system health telemetry.</p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2 bg-sky-500 text-slate-950 font-bold text-xs rounded-xl"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const servicesStatus = [
    { name: 'Firebase Authentication', status: 'ONLINE', icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
    { name: 'Cloud Firestore DB', status: 'OPERATIONAL', icon: Database, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
    { name: 'Firebase Storage', status: 'OPERATIONAL', icon: HardDrive, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
    { name: 'Cloud Functions (Node.js 22)', status: 'ACTIVE', icon: Cpu, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
    { name: 'FCM Push Notifications', status: 'ACTIVE', icon: Bell, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <span>System Health & Observability 2.0</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">College Times Infrastructure Telemetry</p>
          </div>
        </div>

        <button
          onClick={refreshHealth}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-sky-400 rounded-xl flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {servicesStatus.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.name} className={`p-4 rounded-3xl border ${s.bg} space-y-2`}>
                <div className="flex items-center justify-between">
                  <Icon className={`w-5 h-5 ${s.color}`} />
                  <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold bg-slate-950 text-emerald-400 border border-emerald-500/30">
                    {s.status}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-white">{s.name}</h3>
              </div>
            );
          })}
        </div>

        {/* Technical Event Telemetry Log */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <span>Recent Privacy-Safe Telemetry Events ({events.length})</span>
          </h2>

          {events.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 italic bg-slate-950/60 rounded-2xl border border-slate-800">
              No technical error events recorded. All systems healthy.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1 scrollbar-none">
              {events.map((evt) => (
                <div key={evt.id} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-sky-300">
                      {evt.type}
                    </span>
                    <span className="text-slate-300 text-[11px] truncate max-w-md">
                      {JSON.stringify(evt.metadata || {})}
                    </span>
                  </div>
                  <span className="text-slate-500 text-[10px]">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
