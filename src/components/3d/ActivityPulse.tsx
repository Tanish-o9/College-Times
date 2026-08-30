import React from 'react';
import { Activity } from 'lucide-react';

export const ActivityPulse: React.FC = () => {
  return (
    <div className="relative flex items-center justify-center p-3 rounded-2xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 border border-sky-500/20 shadow-md">
      <div className="absolute inset-0 rounded-2xl bg-sky-500/5 animate-pulse" />
      <div className="relative flex items-center gap-2 text-xs font-mono text-sky-400 font-bold">
        <Activity className="w-4 h-4 text-sky-400 animate-bounce" />
        <span>LIVE CAMPUS NETWORK PULSE</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
      </div>
    </div>
  );
};
