import React from 'react';
import { AlertCircle, RefreshCw, Archive } from 'lucide-react';

interface StateContainerProps {
  state: 'loading' | 'empty' | 'error' | 'success';
  loadingText?: string;
  emptyText?: string;
  errorText?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

export const StateContainer: React.FC<StateContainerProps> = ({
  state,
  loadingText = 'Loading campus content...',
  emptyText = 'No items found in this section.',
  errorText = 'A network error occurred. Please try again.',
  onRetry,
  children,
}) => {
  if (state === 'loading') {
    return (
      <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-400 text-xs shadow-md">
        <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
        <span className="font-mono tracking-tight text-slate-400">{loadingText}</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="p-10 bg-rose-950/15 border border-rose-900/30 rounded-3xl flex flex-col items-center justify-center text-center gap-3.5 shadow-md">
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-white">{errorText}</p>
          <p className="text-[10px] text-slate-500 leading-normal">
            Check network status or refresh page coordinates.
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-1.5 bg-rose-500 hover:bg-rose-455 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Action</span>
          </button>
        )}
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="p-12 bg-slate-900/40 border border-slate-850 rounded-3xl text-center space-y-2 shadow-md">
        <Archive className="w-8 h-8 text-slate-700 mx-auto" />
        <p className="text-slate-400 text-xs font-bold font-mono uppercase tracking-wider">{emptyText}</p>
      </div>
    );
  }

  return <>{children}</>;
};
