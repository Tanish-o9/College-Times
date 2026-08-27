import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getUserPollVote, votePoll } from '../../services/pollService';
import type { PollData } from '../../types/poll';
import { formatTimestamp } from '../../utils/format';
import { BarChart3, CheckCircle2, Clock, Lock, RefreshCw, Vote } from 'lucide-react';
import toast from 'react-hot-toast';

interface PollCardProps {
  postId: string;
  poll: PollData;
  onPollUpdated?: (updated: PollData) => void;
}

export const PollCard: React.FC<PollCardProps> = ({ postId, poll, onPollUpdated }) => {
  const { currentUser } = useAuth();
  const [pollData, setPollData] = useState<PollData>(poll);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [userVotedIds, setUserVotedIds] = useState<string[]>([]);
  const [voting, setVoting] = useState(false);
  const [loadingVote, setLoadingVote] = useState(true);

  // Check if poll is expired
  let expMs = pollData.expiresAt;
  if (typeof expMs === 'object' && expMs !== null && typeof expMs.toMillis === 'function') {
    expMs = expMs.toMillis();
  }
  const isExpired = Date.now() >= expMs;

  useEffect(() => {
    setPollData(poll);
  }, [poll]);

  useEffect(() => {
    if (!currentUser || !postId) {
      setLoadingVote(false);
      return;
    }
    getUserPollVote(postId, currentUser.uid)
      .then((record) => {
        if (record && record.optionIds) {
          setUserVotedIds(record.optionIds);
          setSelectedOptionIds(record.optionIds);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingVote(false));
  }, [currentUser, postId]);

  const handleOptionToggle = (optionId: string) => {
    if (isExpired || voting) return;

    if (pollData.allowMultiple) {
      if (selectedOptionIds.includes(optionId)) {
        setSelectedOptionIds(selectedOptionIds.filter((id) => id !== optionId));
      } else {
        setSelectedOptionIds([...selectedOptionIds, optionId]);
      }
    } else {
      setSelectedOptionIds([optionId]);
    }
  };

  const handleVoteSubmit = async () => {
    if (!currentUser || selectedOptionIds.length === 0 || voting || isExpired) return;
    setVoting(true);

    try {
      const result = await votePoll(postId, selectedOptionIds, currentUser);
      setPollData(result.pollData);
      setUserVotedIds(selectedOptionIds);
      onPollUpdated?.(result.pollData);
      toast.success('Vote submitted successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit vote.');
    } finally {
      setVoting(false);
    }
  };

  const hasVoted = userVotedIds.length > 0;
  const total = pollData.totalVotes || 0;

  return (
    <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-3xl space-y-4 my-3">
      {/* Header Info */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white uppercase tracking-wider">Campus Poll</span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
          {pollData.anonymous && (
            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Anonymous</span>
            </span>
          )}
          <span className="flex items-center gap-1 text-slate-400">
            <Clock className="w-3 h-3 text-sky-400" />
            <span>{isExpired ? 'Expired' : `Expires ${formatTimestamp(expMs)}`}</span>
          </span>
        </div>
      </div>

      {/* Question */}
      <h3 className="text-sm font-bold text-white leading-snug">{pollData.question}</h3>

      {/* Options List */}
      <div className="space-y-2.5">
        {pollData.options.map((option) => {
          const isSelected = selectedOptionIds.includes(option.id);
          const isUserVote = userVotedIds.includes(option.id);
          const pct = total > 0 ? Math.round((option.voteCount / total) * 100) : 0;

          return (
            <div
              key={option.id}
              onClick={() => handleOptionToggle(option.id)}
              className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer overflow-hidden group ${
                isSelected
                  ? 'border-purple-500/50 bg-purple-950/20'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              } ${isExpired ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              {/* Progress Fill Bar */}
              {(hasVoted || isExpired) && (
                <div
                  className="absolute inset-y-0 left-0 bg-purple-500/15 transition-all duration-500 rounded-2xl"
                  style={{ width: `${pct}%` }}
                />
              )}

              <div className="relative flex items-center justify-between gap-3 z-10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? 'border-purple-400 bg-purple-500 text-slate-950'
                        : 'border-slate-600 bg-slate-950'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="text-xs font-semibold text-slate-200 truncate">{option.text}</span>
                  {isUserVote && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-mono font-bold">
                      Your Vote
                    </span>
                  )}
                </div>

                {(hasVoted || isExpired) && (
                  <span className="text-xs font-bold text-purple-300 font-mono shrink-0">
                    {pct}% ({option.voteCount})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs font-mono text-slate-400">
        <span>{total} Total {total === 1 ? 'Vote' : 'Votes'}</span>

        {!isExpired && (
          <button
            type="button"
            onClick={handleVoteSubmit}
            disabled={voting || selectedOptionIds.length === 0 || loadingVote}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
          >
            {voting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Vote className="w-3.5 h-3.5" />}
            <span>{hasVoted ? 'Change Vote' : 'Submit Vote'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
