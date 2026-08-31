import React, { useRef, useEffect } from 'react';
import { Search as SearchIcon, X, Loader2 } from 'lucide-react';

interface SearchInputProps {
  query: string;
  onChange: (val: string) => void;
  loading: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  query,
  onChange,
  loading,
  onKeyDown,
  onFocus,
  onBlur,
  placeholder = 'Search students, groups, posts, events, marketplace...',
  autoFocus = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcut: Ctrl/Cmd + K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div className="relative flex-1 group">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-500 group-focus-within:text-sky-400 transition-colors pointer-events-none">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
        ) : (
          <SearchIcon className="w-4 h-4" />
        )}
      </div>

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label="Search Campus"
        className="w-full bg-slate-950/90 border border-slate-800 focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/20 rounded-2xl pl-10 pr-16 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
      />

      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {query ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Clear search"
            aria-label="Clear search query"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <span className="hidden sm:inline-block px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-500 rounded pointer-events-none">
            Ctrl+K
          </span>
        )}
      </div>
    </div>
  );
};
