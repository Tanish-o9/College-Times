import React from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';

interface TrendingTopicsProps {
  topics: string[];
  onSelect: (topic: string) => void;
}

export const TrendingTopics: React.FC<TrendingTopicsProps> = ({ topics, onSelect }) => {
  if (!topics || topics.length === 0) return null;

  return (
    <div className="p-5 bg-slate-900/90 border border-slate-800/90 rounded-3xl space-y-3 shadow-xl backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs font-bold text-white uppercase font-mono tracking-wider">
        <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
        <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-sky-400 bg-clip-text text-transparent">
          Trending on Campus
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => (
          <button
            key={topic}
            onClick={() => onSelect(topic)}
            className="px-3.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/60 text-purple-300 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center gap-1.5"
          >
            <TrendingUp className="w-3 h-3 text-purple-400" />
            <span>#{topic}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
