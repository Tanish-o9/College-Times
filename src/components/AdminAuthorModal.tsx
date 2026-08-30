import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Lock, Ban, RefreshCw, AlertCircle } from 'lucide-react';
import { getConfessionAuthorDetails, type ConfessionAuthorDetail } from '../services/adminService';
import { AdminBlockModal } from './AdminBlockModal';

interface AdminAuthorModalProps {
  confessionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AdminAuthorModal: React.FC<AdminAuthorModalProps> = ({
  confessionId,
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorDetail, setAuthorDetail] = useState<ConfessionAuthorDetail | null>(null);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !confessionId) return;
    setLoading(true);
    setError(null);
    getConfessionAuthorDetails(confessionId)
      .then((detail) => {
        if (detail) {
          setAuthorDetail(detail);
        } else {
          setError('Author details not found or author record deleted.');
        }
      })
      .catch((err: any) => {
        setError(err.message || 'Permission denied or error fetching author details.');
      })
      .finally(() => setLoading(false));
  }, [isOpen, confessionId]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
        <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-purple-400">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                [Admin] Confession Author Identity
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-2 text-xs text-purple-300">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
              <span>Decrypting privileged author metadata...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          ) : authorDetail ? (
            <div className="space-y-4 text-xs">
              {/* Author Overview Card */}
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-300 font-extrabold flex items-center justify-center text-sm">
                    {authorDetail.authorName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{authorDetail.authorName}</h4>
                    <p className="text-slate-400 text-[11px] font-mono">{authorDetail.authorEmail}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>User UID:</span>
                    <span className="text-slate-200 truncate max-w-[180px]">{authorDetail.authorId}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Confession ID:</span>
                    <span className="text-purple-300 truncate max-w-[180px]">{authorDetail.confessionId}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Account Role:</span>
                    <span className="text-amber-400 font-bold uppercase">{authorDetail.userProfile?.role || 'student'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Status:</span>
                    <span className={`font-bold ${authorDetail.userProfile?.moderationStatus === 'blocked' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {authorDetail.userProfile?.moderationStatus === 'blocked' ? 'BLOCKED' : 'ACTIVE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Security Warning Notice */}
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[11px] text-purple-300 flex items-start gap-2">
                <Lock className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  This identity information is strictly visible to verified platform administrators for moderation purposes.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
                >
                  Close
                </button>

                {authorDetail.userProfile?.moderationStatus !== 'blocked' && (
                  <button
                    type="button"
                    onClick={() => setIsBlockModalOpen(true)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Block Author</span>
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {authorDetail && (
        <AdminBlockModal
          targetUserId={authorDetail.authorId}
          targetUserName={authorDetail.authorName}
          isOpen={isBlockModalOpen}
          onClose={() => setIsBlockModalOpen(false)}
          onSuccess={() => {
            setIsBlockModalOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
};
