import React, { useEffect, useState } from 'react';
import type { User } from '../../types';
import { getTopUsersByTimeframe, getUserRankByTimeframe } from '../../services/userService';
import { useAuth } from '../../hooks/useAuth';
import { Trophy, Medal, Award, User as UserIcon, RefreshCw } from 'lucide-react';

export const Leaderboard: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const profile = userProfile as any;
  const [topUsers, setTopUsers] = useState<User[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeframe, setTimeframe] = useState<'all_time' | 'weekly' | 'monthly'>('all_time');

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const users = await getTopUsersByTimeframe(timeframe, 10);
      setTopUsers(users);

      if (profile) {
        let pts = profile.points || 0;
        if (timeframe === 'weekly') pts = profile.weeklyPoints || 0;
        else if (timeframe === 'monthly') pts = profile.monthlyPoints || 0;

        const rank = await getUserRankByTimeframe(timeframe, pts);
        setUserRank(rank);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [userProfile, timeframe]);

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-black text-sm shadow-lg shadow-amber-500/20">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
        );
      case 1:
        return (
          <div className="w-9 h-9 rounded-2xl bg-slate-300/20 border border-slate-300/40 text-slate-200 flex items-center justify-center font-black text-sm shadow-md">
            <Medal className="w-5 h-5 text-slate-300" />
          </div>
        );
      case 2:
        return (
          <div className="w-9 h-9 rounded-2xl bg-amber-700/20 border border-amber-600/40 text-amber-500 flex items-center justify-center font-black text-sm shadow-md">
            <Award className="w-5 h-5 text-amber-600" />
          </div>
        );
      default:
        return (
          <div className="w-9 h-9 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-400 flex items-center justify-center font-mono font-bold text-xs">
            #{index + 1}
          </div>
        );
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Trophy className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Campus Leaderboard</h1>
          </div>
          <p className="text-xs text-slate-400">
            Top campus contributors (+10 pts per post, +2 pts per comment).
          </p>
        </div>

        {/* Current User Card */}
        {profile && (
          <div className="px-4 py-3 bg-slate-950/80 border border-amber-500/30 rounded-2xl flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Your Rank</span>
              <span className="text-lg font-black text-amber-400 font-mono">#{userRank ?? '-'}</span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Your Points</span>
              <span className="text-lg font-black text-white font-mono">
                {timeframe === 'weekly'
                  ? profile.weeklyPoints || 0
                  : timeframe === 'monthly'
                  ? profile.monthlyPoints || 0
                  : profile.points || 0}{' '}
                pts
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Timeframe Filters */}
      <div className="flex gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl max-w-xs sm:max-w-sm">
        {(['all_time', 'weekly', 'monthly'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTimeframe(t)}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all capitalize ${
              timeframe === t
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Leaderboard Table List */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-3">
        <div className="flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">
          <span>Rank & Student</span>
          <span>Points</span>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-slate-400 text-xs font-semibold">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-400 mr-2" />
            <span>Loading leaderboard standings...</span>
          </div>
        ) : topUsers.length === 0 ? (
          <p className="text-center py-8 text-xs text-slate-500">No active students on leaderboard yet.</p>
        ) : (
          topUsers.map((user, idx) => {
            const isSelf = currentUser?.uid === user.uid;
            return (
              <div
                key={user.uid || idx}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                  isSelf
                    ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Rank Badge & User Avatar */}
                <div className="flex items-center gap-3 min-w-0">
                  {getRankBadge(idx)}

                  <div className="w-9 h-9 rounded-2xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white truncate max-w-[160px] sm:max-w-[220px]">
                        {user.displayName || 'Campus Student'}
                      </span>
                      {isSelf && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full border border-amber-500/30">
                          YOU
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 capitalize">{user.role || 'Student'}</span>
                  </div>
                </div>

                {/* Points Counter */}
                <div className="px-4 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-amber-400 font-extrabold text-sm font-mono shrink-0 shadow-inner">
                  {timeframe === 'weekly'
                    ? (user as any).weeklyPoints || 0
                    : timeframe === 'monthly'
                    ? (user as any).monthlyPoints || 0
                    : user.points || 0} <span className="text-[10px] text-slate-505 font-normal">pts</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
