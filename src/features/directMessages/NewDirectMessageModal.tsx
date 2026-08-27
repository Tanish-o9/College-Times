import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { searchCampusUsers } from '../../services/directMessageService';
import { Search, User, X, RefreshCw, MessageSquarePlus } from 'lucide-react';
import toast from 'react-hot-toast';

interface NewDirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (targetUid: string, targetName: string) => void;
}

export const NewDirectMessageModal: React.FC<NewDirectMessageModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
}) => {
  const { currentUser } = useAuth();
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const handler = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setLoading(true);
        try {
          const list = await searchCampusUsers(query, currentUser);
          setResults(list);
        } catch (err) {
          toast.error('Search failed.');
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query, isOpen, currentUser]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-indigo-400" />
            <span>New Private Message</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campus peer by name or email..."
            autoFocus
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {loading ? (
            <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Searching campus users...</span>
            </div>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500 italic">
              {query.trim().length < 2 ? 'Type at least 2 characters to search' : 'No matching campus users found.'}
            </p>
          ) : (
            results.map((user) => (
              <div
                key={user.uid}
                onClick={() => {
                  onSelectUser(user.uid, user.displayName);
                  onClose();
                }}
                className="flex items-center gap-3 p-3 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 rounded-2xl cursor-pointer transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-white truncate">{user.displayName}</h4>
                  <p className="text-[11px] text-slate-500 truncate">{user.email || 'Campus Student'}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
