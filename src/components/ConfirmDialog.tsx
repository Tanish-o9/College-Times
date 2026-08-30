import React from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const colorStyles =
    variant === 'danger'
      ? {
          border: 'border-rose-500/30',
          bgGlow: 'bg-rose-500/10',
          iconText: 'text-rose-400',
          iconBg: 'bg-rose-500/20 border-rose-500/30',
          btnBg: 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20',
        }
      : variant === 'warning'
      ? {
          border: 'border-amber-500/30',
          bgGlow: 'bg-amber-500/10',
          iconText: 'text-amber-400',
          iconBg: 'bg-amber-500/20 border-amber-500/30',
          btnBg: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20',
        }
      : {
          border: 'border-sky-500/30',
          bgGlow: 'bg-sky-500/10',
          iconText: 'text-sky-400',
          iconBg: 'bg-sky-500/20 border-sky-500/30',
          btnBg: 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/20',
        };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        className={`w-full max-w-sm bg-slate-900 border ${colorStyles.border} rounded-3xl p-6 shadow-2xl space-y-4 relative overflow-hidden`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className={`absolute top-0 right-0 w-40 h-40 ${colorStyles.bgGlow} rounded-full blur-3xl pointer-events-none`} />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl border ${colorStyles.iconBg} ${colorStyles.iconText} flex items-center justify-center shrink-0`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="confirm-dialog-title" className="text-sm font-black text-white tracking-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 ${colorStyles.btnBg} text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer`}
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
