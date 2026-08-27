import React, { useState, useEffect } from 'react';
import { getGroupMembersPage } from '../../services/groupMemberManagementService';
import type { GroupMember } from '../../types/group';
import { Trophy, Award, Medal, Sparkles, RefreshCw } from 'lucide-react';

interface GroupLeaderboardProps {
  groupId: string;
}

export const GroupLeaderboard: React.FC<GroupLeaderboardProps> = ({ groupId }) => {
  const [topMembers, setTopMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await getGroupMembersPage(groupId, 10);
      setTopMembers(res.members);
    } catch (err) {
      console.error('Failed to load group leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [groupId]);

  const getRankBadge = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-amber-400" />;
    if (index === 1) return <Award className="w-5 h-5 text-slate-300" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="font-mono text-xs font-bold text-slate-500">#{index + 1}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>Community Engagement Leaderboard</span>
        </h2>
        <span className="text-[10px] text-slate-400 font-mono">Non-sensitive Activity Metric</span>
      </div>

      {loading ? (
        <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
          <span>Loading leaderboard...</span>
        </div>
      ) : topMembers.length === 0 ? (
        <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
          No leaderboard data available.
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl divide-y divide-slate-800/60 overflow-hidden">
          {topMembers.map((m, idx) => (
            <div key={m.uid} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 flex items-center justify-center shrink-0">{getRankBadge(idx)}</div>
                {m.photoURL ? (
                  <img src={m.photoURL} alt={m.displayName || 'Member'} className="w-10 h-10 rounded-2xl object-cover border border-slate-700" />
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm">
                    {(m.displayName || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-bold text-white">{m.displayName || 'Campus Member'}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">Role: {m.role || 'Member'}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 border border-slate-800 rounded-xl text-amber-400 text-xs font-mono font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Top Contributor</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
