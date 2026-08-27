import React from 'react';
import { MessageSquare, AtSign, ShieldAlert, X } from 'lucide-react';

interface GroupMemberQuickProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: {
    uid: string;
    displayName?: string;
    photoURL?: string;
    role?: string;
  } | null;
  onMention?: (username: string) => void;
  onReply?: (memberUid: string) => void;
  onReport?: (memberUid: string) => void;
}

export const GroupMemberQuickProfileModal: React.FC<GroupMemberQuickProfileModalProps> = ({
  isOpen,
  onClose,
  member,
  onMention,
  onReply,
  onReport,
}) => {
  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Member Header */}
        <div className="flex items-center gap-4">
          {member.photoURL ? (
            <img
              src={member.photoURL}
              alt={member.displayName || 'Member'}
              className="w-14 h-14 rounded-2xl object-cover border border-slate-700"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-xl">
              {(member.displayName || 'U')[0].toUpperCase()}
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-white truncate max-w-[180px]">
              {member.displayName || 'Campus Student'}
            </h3>
            <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase bg-slate-800 text-sky-400 border border-slate-700 inline-block mt-1">
              {member.role || 'Member'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          {onMention && (
            <button
              onClick={() => {
                onMention(member.displayName || member.uid);
                onClose();
              }}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 transition-colors"
            >
              <AtSign className="w-4 h-4 text-sky-400" />
              <span>Mention @{member.displayName || 'user'}</span>
            </button>
          )}

          {onReply && (
            <button
              onClick={() => {
                onReply(member.uid);
                onClose();
              }}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>Reply in Chat</span>
            </button>
          )}

          {onReport && (
            <button
              onClick={() => {
                onReport(member.uid);
                onClose();
              }}
              className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Report Member</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
