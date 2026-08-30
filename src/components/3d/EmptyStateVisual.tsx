import React from 'react';
import { Compass } from 'lucide-react';

interface EmptyStateVisualProps {
  title: string;
  description: string;
}

export const EmptyStateVisual: React.FC<EmptyStateVisualProps> = ({ title, description }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900/60 border border-slate-800 rounded-3xl backdrop-blur-md my-6 space-y-4 max-w-md mx-auto shadow-xl">
      <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500/20 via-indigo-500/20 to-purple-500/20 border border-sky-500/30 flex items-center justify-center shadow-lg">
        <div className="absolute inset-0 rounded-2xl bg-sky-500/10 animate-ping" />
        <Compass className="w-8 h-8 text-sky-400 relative z-10" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-200">{title}</h3>
        <p className="text-xs text-slate-400 font-sans max-w-xs mx-auto">{description}</p>
      </div>
    </div>
  );
};
