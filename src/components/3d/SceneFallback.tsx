import React from 'react';
import { Compass, Users, Calendar, Briefcase, BookOpen, ShoppingBag, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SceneFallback: React.FC = () => {
  const navigate = useNavigate();

  const nodes = [
    { label: 'GROUPS', route: '/groups', icon: <Users className="w-4 h-4 text-indigo-400" />, color: 'from-indigo-500/20 to-purple-500/20 border-indigo-500/30' },
    { label: 'EVENTS', route: '/events', icon: <Calendar className="w-4 h-4 text-purple-400" />, color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30' },
    { label: 'OPPORTUNITIES', route: '/opportunities', icon: <Briefcase className="w-4 h-4 text-sky-400" />, color: 'from-sky-500/20 to-blue-500/20 border-sky-500/30' },
    { label: 'ACADEMIC', route: '/academic', icon: <BookOpen className="w-4 h-4 text-emerald-400" />, color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30' },
    { label: 'MARKETPLACE', route: '/marketplace', icon: <ShoppingBag className="w-4 h-4 text-amber-400" />, color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30' },
    { label: 'ACTIVITY', route: '/activity', icon: <Activity className="w-4 h-4 text-rose-400" />, color: 'from-rose-500/20 to-pink-500/20 border-rose-500/30' },
  ];

  return (
    <div className="relative w-full h-[360px] sm:h-[420px] rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800/80 overflow-hidden p-6 flex flex-col justify-between shadow-2xl">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Badge */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-sky-400 text-xs font-mono font-bold shadow-sm">
          <Compass className="w-4 h-4 animate-pulse text-sky-400" />
          <span>CAMPUS SPATIAL HUBS</span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">Interactive Navigation</span>
      </div>

      {/* Campus Hub Nodes Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 relative z-10 my-auto">
        {nodes.map((node) => (
          <button
            key={node.label}
            onClick={() => navigate(node.route)}
            className={`p-4 rounded-2xl bg-gradient-to-tr ${node.color} border backdrop-blur-md hover:scale-[1.02] active:scale-95 transition-all text-left group flex flex-col justify-between h-24 shadow-lg`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                {node.icon}
              </div>
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            </div>

            <span className="text-xs font-bold text-slate-200 tracking-wider group-hover:text-white transition-colors">
              {node.label}
            </span>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 text-center relative z-10 font-mono">
        Click any hub to jump directly into the College Times campus network
      </p>
    </div>
  );
};
