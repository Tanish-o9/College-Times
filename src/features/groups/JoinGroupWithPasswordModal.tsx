import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import { joinGroup } from '../../services/groupService';
import type { CampusGroup } from '../../types/group';
import { X, Key, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface JoinGroupWithPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: CampusGroup | null;
  onJoined?: (groupId: string) => void;
}

export const JoinGroupWithPasswordModal: React.FC<JoinGroupWithPasswordModalProps> = ({
  isOpen,
  onClose,
  group,
  onJoined,
}) => {
  const { currentUser, userProfile } = useAuth();
  useOverlayBackHandler(isOpen, onClose);

  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !group) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submitting) return;

    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      setError('Please enter the group password.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await joinGroup(group.id, currentUser, userProfile, trimmedPassword);
      toast.success(`Successfully joined ${group.name}! 🎉`);
      onJoined?.(group.id);
      onClose();
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Incorrect passcode. Access denied.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Password Protected Group</h2>
              <p className="text-[11px] text-slate-400">Join "{group.name}"</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2.5 text-rose-300 text-xs leading-relaxed animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Enter Group Passcode / Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Enter passcode..."
              autoFocus
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500/50 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none font-mono"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || !password.trim()}
              className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Join Group</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
