import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { ShieldAlert, LogOut, Mail } from 'lucide-react';
import { PRIMARY_ADMIN_EMAIL } from '../services/adminNotificationService';

export const BlockedUserGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isBlocked, userProfile, signOut } = useAuth();

  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-3xl p-8 shadow-2xl space-y-6 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Account Restricted</h1>
            <p className="text-xs text-rose-300 font-medium">
              Your College Times account has been restricted due to a moderation action.
            </p>
          </div>

          {userProfile?.blockReason && (
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-left space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Moderation Reason:
              </span>
              <p className="text-xs text-slate-200 font-mono leading-relaxed">
                {userProfile.blockReason}
              </p>
            </div>
          )}

          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-400 text-xs space-y-2">
            <p className="leading-relaxed">
              If you believe this restriction was placed in error, please contact platform administration:
            </p>
            <a
              href={`mailto:${PRIMARY_ADMIN_EMAIL}`}
              className="inline-flex items-center gap-1.5 font-mono text-purple-400 hover:underline font-bold"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{PRIMARY_ADMIN_EMAIL}</span>
            </a>
          </div>

          <button
            type="button"
            onClick={() => signOut()}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
