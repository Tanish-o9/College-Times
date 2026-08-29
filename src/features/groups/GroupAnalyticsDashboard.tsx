import React, { useState, useEffect } from 'react';
import { getGroupAnalytics, type GroupAnalytics } from '../../services/groupAnalyticsService';
import {
  BarChart3,
  Users,
  RefreshCw,
  TrendingUp,
  Award,
  Zap
} from 'lucide-react';

interface GroupAnalyticsDashboardProps {
  groupId: string;
}

type TimeRange = 7 | 30 | 90;

export const GroupAnalyticsDashboard: React.FC<GroupAnalyticsDashboardProps> = ({ groupId }) => {
  const [stats, setStats] = useState<GroupAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<TimeRange>(30);

  const loadStats = async (range: TimeRange) => {
    if (!groupId) return;
    setLoading(true);
    try {
      const data = await getGroupAnalytics(groupId, range);
      setStats(data);
    } catch (err) {
      console.error('Failed to load group stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats(selectedRange);
  }, [groupId, selectedRange]);

  if (loading) {
    return (
      <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
        <span>Aggregating group statistics for {selectedRange} days...</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
        Failed to load analytics dashboard.
      </div>
    );
  }

  const maxVal = Math.max(stats.postCount, stats.eventCount, stats.rsvpCount, stats.resourceCount, 1);

  return (
    <div className="space-y-6">
      {/* Header with TimeRange Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span>Group Analytics Dashboard</span>
          </h3>
          <p className="text-[10px] text-slate-400 font-mono">Server-side stats with retention indices</p>
        </div>

        {/* Range Buttons */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {([7, 30, 90] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRange(r)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                selectedRange === r
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                  : 'bg-slate-950 text-slate-500 border-slate-900 hover:text-white'
              }`}
            >
              {r} Days
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 bg-slate-900 border border-slate-850 hover:border-emerald-500/20 rounded-2xl flex flex-col justify-between gap-1 transition-all">
          <Users className="w-4 h-4 text-emerald-400 mb-1" />
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">Total Members</span>
          <span className="text-xl font-extrabold text-white font-mono">{stats.memberCount}</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-850 hover:border-sky-500/20 rounded-2xl flex flex-col justify-between gap-1 transition-all">
          <Zap className="w-4 h-4 text-sky-400 mb-1 animate-pulse" />
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">New Members ({selectedRange}d)</span>
          <span className="text-xl font-extrabold text-white font-mono">+{stats.newMembers}</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-850 hover:border-purple-500/20 rounded-2xl flex flex-col justify-between gap-1 transition-all">
          <Award className="w-4 h-4 text-purple-400 mb-1" />
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">Contribution Points</span>
          <span className="text-xl font-extrabold text-white font-mono">{stats.contributionPoints} XP</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-850 hover:border-amber-500/20 rounded-2xl flex flex-col justify-between gap-1 transition-all">
          <TrendingUp className="w-4 h-4 text-amber-400 mb-1" />
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">Retention Index</span>
          <span className="text-xl font-extrabold text-white font-mono">{stats.memberRetentionRate}%</span>
        </div>
      </div>

      {/* Extended Stats Metrics Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Members', val: stats.activeMembers, labelColor: 'text-emerald-450' },
          { label: 'Discussions', val: stats.postCount, labelColor: 'text-indigo-400' },
          { label: 'Events RSVPs', val: stats.rsvpCount, labelColor: 'text-pink-400' },
          { label: 'Resources Shared', val: stats.resourceCount, labelColor: 'text-sky-400' },
        ].map((item, idx) => (
          <div key={idx} className="p-3.5 bg-slate-950/60 border border-slate-900 rounded-xl space-y-1 text-center">
            <span className="text-[10px] text-slate-500 block uppercase font-mono">{item.label}</span>
            <span className={`text-base font-black ${item.labelColor}`}>{item.val}</span>
          </div>
        ))}
      </div>

      {/* SVG Bar Chart Visualization */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
        <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Activity Distribution</h4>
        
        <div className="space-y-3">
          {[
            { label: 'Group Discussions', val: stats.postCount, color: 'from-indigo-500 to-cyan-400' },
            { label: 'Rsvps attending', val: stats.rsvpCount, color: 'from-rose-500 to-pink-500' },
            { label: 'Chat Messages sent', val: stats.chatCount, color: 'from-purple-500 to-pink-600' },
            { label: 'Shared Files & Links', val: stats.resourceCount, color: 'from-sky-500 to-blue-600' },
          ].map((item, idx) => {
            const percentage = Math.round((item.val / maxVal) * 100);

            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="font-bold text-slate-300">{item.label}</span>
                  <span className="font-mono text-slate-400 font-semibold">{item.val}</span>
                </div>
                
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                  <div
                    className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
