import React from 'react';
import { Plus } from 'lucide-react';

interface FABProps {
  onClick: () => void;
  label?: string;
}

export const FAB: React.FC<FABProps> = ({ onClick, label = 'Create Post' }) => {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-2xl shadow-sky-500/40 border border-sky-400/30 flex items-center justify-center group transition-all duration-300 hover:scale-110 active:scale-95"
    >
      <Plus className="w-7 h-7 text-white group-hover:rotate-90 transition-transform duration-300" />
      <span className="sr-only">{label}</span>
    </button>
  );
};

export default FAB;
