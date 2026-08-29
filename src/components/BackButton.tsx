import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useSmartBack } from '../hooks/useSmartBack';
import clsx from 'clsx';

interface BackButtonProps {
  customFallback?: string;
  className?: string;
  onBeforeNav?: () => boolean;
}

export const BackButton: React.FC<BackButtonProps> = ({
  customFallback,
  className,
  onBeforeNav,
}) => {
  const goBack = useSmartBack();

  const handleGoBack = () => {
    if (onBeforeNav) {
      const allowed = onBeforeNav();
      if (!allowed) return;
    }
    goBack(customFallback);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleGoBack();
    }
  };

  return (
    <button
      onClick={() => goBack(customFallback)}
      onKeyDown={handleKeyDown}
      className={clsx(
        "flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all select-none outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-950",
        "bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white active:scale-95 shadow-md",
        className
      )}
      aria-label="Go back"
      title="Go back"
    >
      <ArrowLeft className="w-4 h-4 shrink-0" />
      <span className="hidden sm:inline">Back</span>
    </button>
  );
};
