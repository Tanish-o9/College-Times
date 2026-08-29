import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  createVotingPoll,
  subscribeActiveCampusPolls,
  getUserVoteRecord,
  castVote,
  type VotingPoll,
  type PollVoteRecord2
} from '../../services/votingService';
import { BarChart3, Clock, CheckSquare, Square, RefreshCw, Send, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const PollVotingCenter: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [polls, setPolls] = useState<VotingPoll[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, PollVoteRecord2>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // New Poll Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['Option 1', 'Option 2']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [durationDays] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  // Selection state for active voting
  const [selectedOptionsMap, setSelectedOptionsMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeActiveCampusPolls(async (activePolls) => {
      setPolls(activePolls);
      setLoading(false);

      const votesMap: Record<string, PollVoteRecord2> = {};
      for (const p of activePolls) {
        if (p.id) {
          const record = await getUserVoteRecord(p.id, currentUser.uid);
          if (record) {
            votesMap[p.id] = record;
          }
        }
      }
      setUserVotes(votesMap);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleAddOption = () => {
    if (options.length >= 10) {
      toast.error('Maximum 10 options allowed.');
      return;
    }
    setOptions([...options, `Option ${options.length + 1}`]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast.error('Minimum 2 options required.');
      return;
    }
    setOptions(options.filter((_, idx) => idx !== index));
  };

  const handleOptionTextChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submitting || !question.trim()) return;

    const cleanOpts = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOpts.length < 2) {
      toast.error('Please enter at least 2 non-empty options.');
      return;
    }

    setSubmitting(true);
    try {
      await createVotingPoll(
        {
          question,
          options: cleanOpts,
          allowMultiple,
          anonymous,
          isPublic: true, // campus-wide
          durationDays,
        },
        currentUser,
        userProfile?.displayName
      );

      toast.success('Campus voting poll created!');
      setQuestion('');
      setOptions(['Option 1', 'Option 2']);
      setAllowMultiple(false);
      setAnonymous(false);
      setShowAddForm(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create poll.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleOptionSelection = (pollId: string, optionId: string, allowMulti: boolean) => {
    const currentSelected = selectedOptionsMap[pollId] || [];
    let nextSelected: string[] = [];

    if (allowMulti) {
      if (currentSelected.includes(optionId)) {
        nextSelected = currentSelected.filter((id) => id !== optionId);
      } else {
        nextSelected = [...currentSelected, optionId];
      }
    } else {
      nextSelected = [optionId];
    }

    setSelectedOptionsMap({
      ...selectedOptionsMap,
      [pollId]: nextSelected,
    });
  };

  const handleVoteSubmit = async (pollId: string) => {
    if (!currentUser) return;
    const selected = selectedOptionsMap[pollId] || [];
    if (selected.length === 0) {
      toast.error('Please select at least one option.');
      return;
    }

    try {
      await castVote(pollId, selected, currentUser.uid);
      toast.success('Vote registered successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to register vote.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 text-xs gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
        <span>Loading voting polls...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="relative p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-white tracking-tight uppercase font-mono">Campus Voting Center</h1>
          </div>
          <p className="text-xs text-slate-400">
            Create or participate in public campus polls with live results updates.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-455 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Poll</span>
          </button>
        </div>
      </div>

      {/* Create Poll Form */}
      {showAddForm && (
        <form onSubmit={handleCreatePoll} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">New Campus Poll</h2>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">Poll Question</label>
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Should the campus library stay open 24/7 during exams?"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Options</label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={opt}
                  onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveOption(idx)}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-950 border border-transparent hover:border-slate-850 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddOption}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Option</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer">
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
                className="rounded border-slate-800 text-rose-500 focus:ring-rose-500/20 bg-slate-900"
              />
              <span className="text-xs text-slate-300">Allow multiple answers</span>
            </label>

            <label className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="rounded border-slate-800 text-rose-500 focus:ring-rose-500/20 bg-slate-900"
              />
              <span className="text-xs text-slate-300">Anonymous voting</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-rose-500 hover:bg-rose-455 disabled:bg-slate-850 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Launch Voting Poll</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Polls List */}
      <div className="space-y-4">
        {polls.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs italic bg-slate-900 border border-slate-850 rounded-3xl">
            No active polls found in campus database.
          </div>
        ) : (
          polls.map((poll) => {
            const hasVoted = !!userVotes[poll.id!];
            const isClosed = Date.now() >= poll.expiresAt;
            const currentSelected = selectedOptionsMap[poll.id!] || [];
            const userVoteRecord = userVotes[poll.id!];

            return (
              <div key={poll.id} className="p-5 bg-slate-900 border border-slate-850 rounded-3xl space-y-4 shadow-md">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 bg-slate-950 border border-slate-850 rounded-full font-bold">
                      {poll.anonymous ? 'Anonymous' : 'Public'}
                    </span>
                    <span className="px-2.5 py-0.5 bg-slate-950 border border-slate-850 rounded-full font-bold">
                      {poll.allowMultiple ? 'Multiple Choice' : 'Single Choice'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{isClosed ? 'Closed' : 'Voting Open'}</span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white tracking-tight leading-snug">{poll.question}</h3>

                {/* Vote choices */}
                <div className="space-y-2">
                  {poll.options.map((opt) => {
                    const percent =
                      poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
                    const isUserSelected =
                      (hasVoted && userVoteRecord?.optionIds?.includes(opt.id)) ||
                      (!hasVoted && currentSelected.includes(opt.id));

                    return (
                      <button
                        key={opt.id}
                        disabled={hasVoted || isClosed}
                        onClick={() => toggleOptionSelection(poll.id!, opt.id, poll.allowMultiple)}
                        className={`w-full relative p-3 rounded-2xl border text-left text-xs transition-all overflow-hidden flex items-center justify-between gap-4 ${
                          isUserSelected
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-350'
                            : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-300'
                        }`}
                      >
                        {/* Vote Percent Progress overlay */}
                        {(hasVoted || isClosed) && (
                          <div
                            className="absolute top-0 left-0 bottom-0 bg-rose-500/5 -z-10 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        )}

                        <div className="flex items-center gap-2">
                          {!hasVoted && !isClosed && (
                            <span>
                              {isUserSelected ? (
                                <CheckSquare className="w-4 h-4 text-rose-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-650" />
                              )}
                            </span>
                          )}
                          <span>{opt.text}</span>
                        </div>

                        {(hasVoted || isClosed) && (
                          <span className="font-mono font-bold text-slate-400">{percent}% ({opt.voteCount})</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Submit / Info footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-500 font-mono">
                    Total Votes: {poll.totalVotes}
                  </span>

                  {!hasVoted && !isClosed ? (
                    <button
                      onClick={() => handleVoteSubmit(poll.id!)}
                      className="px-4 py-1.5 bg-rose-500 hover:bg-rose-455 text-slate-950 font-bold text-xs uppercase rounded-xl transition-all shadow-md"
                    >
                      Cast Vote
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isClosed ? 'Voting Closed' : 'Vote Submitted'}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
