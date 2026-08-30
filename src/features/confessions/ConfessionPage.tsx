import React, { useState, useEffect } from 'react';
import { subscribeConfessions } from '../../services/confessionService';
import type { Confession } from '../../types/confession';
import { ConfessionCard } from './ConfessionCard';
import { ConfessionModal } from './ConfessionModal';
import { Skeleton } from '../../components/Skeleton';
import { FAB } from '../../components/FAB';
import { Lock, Plus, Sparkles, RefreshCw, MessageSquareDashed } from 'lucide-react';

export const ConfessionPage: React.FC = () => {
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsub = subscribeConfessions((list) => {
      setConfessions(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    const unsub = subscribeConfessions((list) => {
      setConfessions(list);
      setLoading(false);
    });
    return () => unsub();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 px-1 sm:px-2">
      {/* Header Banner */}
      <section className="relative p-6 sm:p-8 bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl overflow-hidden shadow-2xl space-y-3">
        {/* Glow Accents */}
        <div className="absolute -top-16 -right-16 w-60 h-60 bg-purple-500/15 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-60 h-60 bg-sky-500/15 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[11px] font-bold uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5" />
              <span>Campus Confession Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Campus Confessions
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl leading-relaxed">
              Anonymous thoughts from your campus community. Read, share, and connect with zero judgment.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-500 hover:from-purple-500 hover:to-sky-400 text-white font-bold text-xs shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-105 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Confession</span>
          </button>
        </div>
      </section>

      {/* Feed Area */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-6 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-2xl" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32 rounded-lg" />
                  <Skeleton className="h-3 w-20 rounded-lg" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-8 w-40 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 bg-slate-900/80 border border-slate-800 rounded-3xl text-center space-y-4">
          <p className="text-xs text-rose-400 font-semibold">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : confessions.length === 0 ? (
        <div className="p-12 bg-slate-900/60 border border-slate-800/80 rounded-3xl text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
            <MessageSquareDashed className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No confessions yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Be the first to anonymously share something with campus.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all shadow-md inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Share First Confession
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {confessions.map((confession) => (
            <ConfessionCard key={confession.id} confession={confession} />
          ))}
        </div>
      )}

      {/* Floating Action Button */}
      <FAB onClick={() => setIsModalOpen(true)} label="Create Confession" />

      {/* Confession Creation Modal */}
      <ConfessionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
