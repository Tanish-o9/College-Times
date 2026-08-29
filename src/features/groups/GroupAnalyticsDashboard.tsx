import React, { useState, useEffect } from 'react';
import { getGroupAnalytics, type GroupAnalytics } from '../../services/groupAnalyticsService';
import { BarChart3, Users, FileText, Calendar, Megaphone, BookOpen, RefreshCw } from 'lucide-react';

interface GroupAnalyticsDashboardProps {
  groupId: string;
}

export const GroupAnalyticsDashboard: React.FC<GroupAnalyticsDashboardProps> = ({ groupId }) => {
  const [stats, setStats] = useState<GroupAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const data = await getGroupAnalytics(groupId);
      setStats(data);
    } catch (err) {
      console.error('Failed to load group stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [groupId]);

  if (loading) {
    return (
      <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
        <span>Aggregating campus statistics...</span>
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

  const maxVal = Math.max(stats.postCount, stats.eventCount, stats.announcementCount, stats.resourceCount, 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span>Group Analytics & Stats</span>
          </h3>
          <p className="text-[10px] text-slate-400 font-mono">Aggregated metric dashboard (Server-Side counts)</p>
        </div>
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-4 bg-slate-900 border border-slate-850 hover:border-emerald-500/20 rounded-2xl flex flex-col justify-between gap-1 transition-all">
          <Users className="w-4 h-4 text-emerald-400 mb-1" />
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">Members</span>
          <span className="text-xl font-extrabold text-white font-mono">{stats.memberCount}</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-850 hover:border-indigo-500/20 rounded-2xl flex flex-col justify-between gap-1 transition-all">
          <FileText className="w-4 h-4 text-indigo-400 mb-1" />
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">Posts</span>
          <span className="text-xl font-extrabold text-white font-mono">{stats.postCount}</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-850 hover:border-rose-500/20 rounded-2xl flex flex-col justify-between gap-1 transition-all">
          <Calendar className="w-4 h-4 text-rose-400 mb-1" />
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">Events</span>
          <span className="text-xl font-extrabold text-white font-mono">{stats.eventCount}</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-850 hover:border-amber-500/20 rounded-2xl flex flex-col justify-between gap-1 transition-all">
          <Megaphone className="w-4 h-4 text-amber-400 mb-1" />
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">Announcements</span>
          <span className="text-xl font-extrabold text-white font-mono">{stats.announcementCount}</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-850 hover:border-sky-500/20 rounded-2xl flex flex-col justify-between gap-1 transition-all col-span-2 sm:col-span-1">
          <BookOpen className="w-4 h-4 text-sky-400 mb-1" />
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">Resources</span>
          <span className="text-xl font-extrabold text-white font-mono">{stats.resourceCount}</span>
        </div>
      </div>

      {/* SVG Bar Chart Visualization */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
        <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Activity Distribution</h4>
        
        <div className="space-y-3">
          {[
            { label: 'Discussions / Posts', val: stats.postCount, color: 'from-indigo-500 to-cyan-400' },
            { label: 'Campus Events', val: stats.eventCount, color: 'from-rose-500 to-pink-500' },
            { label: 'Announcements', val: stats.announcementCount, color: 'from-amber-500 to-yellow-400' },
            { label: 'Study Resources', val: stats.resourceCount, color: 'from-sky-500 to-blue-600' },
          ].map((item, idx) => {
            const percentage = Math.round((item.val / maxVal) * 100);

            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="font-bold text-slate-300">{item.label}</span>
                  <span className="font-mono text-slate-455 font-semibold">{item.val} ({percentage}%)</span>
                </div>
                
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                  <div
                    className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
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
