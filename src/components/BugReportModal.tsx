import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../hooks/useAuth';
import { useOverlayBackHandler } from '../hooks/useOverlayBackHandler';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { uploadPostImage } from '../services/storageService';
import toast from 'react-hot-toast';
import { X, Bug, Send, RefreshCw, Upload, Trash2 } from 'lucide-react';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  useOverlayBackHandler(isOpen, onClose);

  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Screenshot must be under 10MB.');
      return;
    }
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !currentUser || submitting) return;

    setSubmitting(true);
    toast.loading('Submitting bug report...', { id: 'bug-submit' });

    try {
      let screenshotUrl = '';
      if (selectedFile) {
        screenshotUrl = await uploadPostImage(selectedFile, currentUser.uid);
      }

      await addDoc(collection(db, 'bugReports'), {
        userId: currentUser.uid,
        userEmail: currentUser.email || currentUser.phoneNumber || 'Anonymous Student',
        description: description.trim().slice(0, 1000),
        ...(screenshotUrl ? { screenshotUrl } : {}),
        createdAt: serverTimestamp(),
        status: 'open',
      });

      toast.success('Bug report submitted — thank you!', { id: 'bug-submit' });
      setDescription('');
      setSelectedFile(null);
      setImagePreview(null);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit bug report.', { id: 'bug-submit' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <Bug className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">Report a Bug</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Bug Description <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              placeholder="Describe what went wrong, steps to reproduce, or unexpected behavior..."
              required
              maxLength={1000}
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 focus:border-rose-500 rounded-xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Screenshot <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            {imagePreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 max-h-36">
                <img src={imagePreview} alt="Screenshot preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setImagePreview(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-slate-950/80 text-white rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="bug-file" />
                <label
                  htmlFor="bug-file"
                  className="w-full p-3 border-2 border-dashed border-slate-800 hover:border-rose-500/50 bg-slate-950/40 rounded-2xl flex items-center justify-center gap-2 text-xs text-slate-400 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-rose-400" />
                  <span>Attach Screenshot</span>
                </label>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!description.trim() || submitting}
              className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-semibold text-sm rounded-xl shadow-lg shadow-rose-500/20 flex items-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Bug Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
