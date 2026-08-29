import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getUserPersonalMetrics, type UserPersonalMetrics } from '../../services/personalAnalyticsService';
import {
  TrendingUp,
  Award,
  Sparkles,
  RefreshCw,
  BarChart3,
  Calendar,
  Layers,
  ShoppingBag,
  Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';

export const PersonalAnalyticsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [metrics, setMetrics] = useState<UserPersonalMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMetrics = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await getUserPersonalMetrics(currentUser.uid);
      setMetrics(data);
    } catch {
      toast.error('Failed to load activity metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center gap-2.5 text-xs text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
        <span>Aggregating campus activity metrics...</span>
      </div>
    );
  }

  const cards = [
    { label: 'Campus Posts', val: metrics?.postsCreated || 0, color: 'from-sky-500 to-blue-600', icon: Sparkles },
    { label: 'Total Comments', val: metrics?.commentsCount || 0, color: 'from-purple-500 to-indigo-600', icon: Layers },
    { label: 'Likes & Reactions', val: metrics?.reactionsCount || 0, color: 'from-pink-500 to-rose-600', icon: TrendingUp },
    { label: 'Contribution Points', val: metrics?.contributionPoints || 0, color: 'from-amber-500 to-orange-600', icon: Award },
    { label: 'Groups Contributions', val: metrics?.groupsJoined || 0, color: 'from-emerald-500 to-teal-600', icon: BarChart3 },
    { label: 'Events Attended', val: metrics?.eventsAttended || 0, color: 'from-fuchsia-500 to-pink-600', icon: Calendar },
    { label: 'Marketplace Offers', val: metrics?.marketplaceListings || 0, color: 'from-yellow-500 to-amber-600', icon: ShoppingBag },
    { label: 'Saved Career Roles', val: metrics?.opportunitiesSaved || 0, color: 'from-cyan-500 to-teal-600', icon: Briefcase },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 space-y-8">
      {/* Title Header */}
      <div className="max-w-5xl mx-auto space-y-1">
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-sky-400" />
          <span>Personal Campus Analytics</span>
        </h2>
        <p className="text-xs text-slate-400">
          Realtime summary of your contributions, social compatibility score, and campus involvement metrics.
        </p>
      </div>

      {/* Grid Cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <div
              key={idx}
              className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-2 relative overflow-hidden group hover:border-slate-700 transition-all shadow-xl"
            >
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${c.color} opacity-[0.03] rounded-full blur-2xl group-hover:opacity-[0.08] transition-all`} />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 font-mono tracking-wider">{c.label}</span>
                <Icon className="w-4 h-4 text-slate-500 shrink-0" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white">{c.val}</p>
            </div>
          );
        })}
      </div>

      {/* Interactive Activity Chart (SVG Rendered) */}
      <div className="max-w-5xl mx-auto p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Engagement Distribution</h3>
          <span className="text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 border border-sky-500/20 rounded-full font-black">Live Sync</span>
        </div>

        {/* SVGs Bar Chart */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-8 pt-4">
          <div className="w-full sm:w-1/2 space-y-3.5">
            {[
              { label: 'Social & Feed Posts', count: metrics?.postsCreated || 0, max: 20, barColor: 'bg-sky-500' },
              { label: 'Resource Uploads', count: metrics?.resourcesShared || 0, max: 10, barColor: 'bg-emerald-500' },
              { label: 'Events Participated', count: metrics?.eventsAttended || 0, max: 15, barColor: 'bg-purple-500' },
              { label: 'Discussions & Comments', count: metrics?.commentsCount || 0, max: 50, barColor: 'bg-pink-500' },
            ].map((bar, bIdx) => {
              const percent = Math.min(100, Math.round((bar.count / (bar.max || 1)) * 100));
              return (
                <div key={bIdx} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                    <span>{bar.label}</span>
                    <span className="font-mono text-white">{bar.count}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 border border-slate-850 rounded-full overflow-hidden">
                    <div className={`h-full ${bar.barColor} rounded-full transition-all duration-1000`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="w-full sm:w-1/2 flex items-center justify-center p-4 bg-slate-950/40 border border-slate-850 rounded-2xl relative">
            {/* Circular Progress Gauge */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="72" cy="72" r="58" stroke="#1e293b" strokeWidth="10" fill="transparent" />
                <circle
                  cx="72"
                  cy="72"
                  r="58"
                  stroke="#0ea5e9"
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray={364}
                  strokeDashoffset={364 - (364 * Math.min(100, (metrics?.contributionPoints || 0))) / 1000}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Level</span>
                <span className="text-xl font-black text-white">{Math.floor((metrics?.contributionPoints || 0) / 100) + 1}</span>
                <span className="text-[9px] text-sky-400 font-mono mt-0.5">{metrics?.contributionPoints} / 1000 XP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
