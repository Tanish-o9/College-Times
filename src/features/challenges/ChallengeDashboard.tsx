import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getActiveChallenges,
  getUserChallengeProgressList,
  joinChallenge,
  createChallenge,
  type Challenge,
  type UserChallengeProgress
} from '../../services/challengeService';
import { Trophy, RefreshCw, CheckCircle, Target, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export const ChallengeDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userProgress, setUserProgress] = useState<Record<string, UserChallengeProgress>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const fetchChallengesAndProgress = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // Seed default challenges if empty
      let list = await getActiveChallenges();
      if (list.length === 0) {
        // Add default seed challenges
        const seedChallenges: Omit<Challenge, 'id'>[] = [
          {
            title: 'Campus Socializer',
            description: 'Join 2 campus community groups to expand your network.',
            type: 'groups',
            targetCount: 2,
            rewardXp: 25,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            status: 'active',
          },
          {
            title: 'Knowledge Sharing',
            description: 'Publish 3 useful posts in the main campus feed.',
            type: 'posts',
            targetCount: 3,
            rewardXp: 25,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'active',
          },
          {
            title: 'Active Participant',
            description: 'RSVP to 2 campus events and participate in group activities.',
            type: 'events',
            targetCount: 2,
            rewardXp: 25,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'active',
          },
          {
            title: 'Resource Provider',
            description: 'Share 2 study resources in any group resource hub.',
            type: 'resources',
            targetCount: 2,
            rewardXp: 25,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'active',
          }
        ];

        for (const seed of seedChallenges) {
          await createChallenge(seed);
        }
        list = await getActiveChallenges();
      }

      setChallenges(list);

      const progressList = await getUserChallengeProgressList(currentUser.uid);
      const progressMap: Record<string, UserChallengeProgress> = {};
      progressList.forEach((p) => {
        progressMap[p.challengeId] = p;
      });
      setUserProgress(progressMap);
    } catch (err) {
      console.error('Failed to load challenges:', err);
      toast.error('Failed to load campus challenges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallengesAndProgress();
  }, [currentUser]);

  const handleJoin = async (challengeId: string) => {
    if (!currentUser) return;
    setJoiningId(challengeId);
    try {
      await joinChallenge(currentUser.uid, challengeId);
      toast.success('Joined challenge! Complete actions to progress.');
      await fetchChallengesAndProgress();
    } catch {
      toast.error('Failed to join challenge.');
    } finally {
      setJoiningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 text-xs gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
        <span>Loading challenges...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="relative p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Trophy className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-white tracking-tight uppercase font-mono">Campus Challenges</h1>
          </div>
          <p className="text-xs text-slate-400">
            Complete tasks, earn reputation points, and show off your badges!
          </p>
        </div>

        <button
          onClick={fetchChallengesAndProgress}
          className="self-start md:self-auto px-3.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Challenges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {challenges.map((challenge) => {
          const prog = userProgress[challenge.id!];
          const hasJoined = !!prog;
          const isCompleted = prog?.status === 'completed';

          return (
            <div
              key={challenge.id}
              className="p-5 bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-3xl flex flex-col justify-between gap-4 transition-all relative overflow-hidden"
            >
              {isCompleted && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-slate-950 border border-slate-850 text-purple-400 rounded-full font-mono text-[9px] font-bold uppercase">
                    +{challenge.rewardXp} XP
                  </span>

                  {isCompleted ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2.5 py-0.5 rounded-full font-mono">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>COMPLETED</span>
                    </span>
                  ) : hasJoined ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-sky-400 bg-sky-950/20 border border-sky-900/30 px-2.5 py-0.5 rounded-full font-mono">
                      <Target className="w-3.5 h-3.5 animate-pulse" />
                      <span>ACTIVE</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-mono">Not Joined</span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-white tracking-tight">{challenge.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{challenge.description}</p>
              </div>

              {/* Progress and Action Button */}
              <div className="pt-2 border-t border-slate-800/60 space-y-3">
                {hasJoined && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Progress</span>
                      <span>
                        {prog.progress} / {challenge.targetCount}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isCompleted ? 'bg-emerald-500' : 'bg-sky-500'
                        }`}
                        style={{ width: `${(prog.progress / challenge.targetCount) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {!hasJoined ? (
                  <button
                    onClick={() => handleJoin(challenge.id!)}
                    disabled={joiningId === challenge.id}
                    className="w-full py-2 bg-purple-500 hover:bg-purple-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1"
                  >
                    {joiningId === challenge.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Accept Challenge</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                ) : isCompleted ? (
                  <div className="p-2 bg-slate-950 border border-slate-850/80 rounded-xl text-center text-[10px] text-slate-400 font-medium">
                    🏆 XP points successfully credited to your profile level.
                  </div>
                ) : (
                  <div className="p-2 bg-slate-950 border border-slate-850/80 rounded-xl text-center text-[10px] text-slate-400 font-medium italic">
                    Action required: post, join, or attend to complete targets.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
