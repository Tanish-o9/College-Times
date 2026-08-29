import React, { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import { createGroupInstant } from '../../services/groupInstantService';
import { MomentCameraModal } from './MomentCameraModal';
import { X, Image as ImageIcon, Sparkles, RefreshCw, Send, Trash2, Camera } from 'lucide-react';
import toast from 'react-hot-toast';

interface CreateGroupInstantModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  onInstantCreated?: () => void;
}

export const CreateGroupInstantModal: React.FC<CreateGroupInstantModalProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  onInstantCreated,
}) => {
  const { currentUser, userProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const hasChanges = (
    caption.trim().length > 0 ||
    selectedFiles.length > 0
  );

  const handleCloseSafe = () => {
    if (hasChanges) {
      if (window.confirm('Discard unsaved changes?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  useOverlayBackHandler(isOpen, handleCloseSafe);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    files.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File '${file.name}' exceeds 10MB limit.`);
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        toast.error(`Unsupported file format '${file.type}'.`);
        return;
      }

      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveImage = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submitting) return;

    if (selectedFiles.length === 0 && !caption.trim()) {
      toast.error('Please add a photo or text caption.');
      return;
    }

    setSubmitting(true);
    try {
      await createGroupInstant(groupId, caption, selectedFiles, currentUser, userProfile);
      toast.success('Permanent Group Moment shared!');
      setCaption('');
      setSelectedFiles([]);
      setPreviews([]);
      if (onInstantCreated) onInstantCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to post Instant.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Share Group Moment</h2>
              <p className="text-[10px] text-slate-400 truncate">Sharing moment with {groupName}</p>
            </div>
          </div>

          <button
            onClick={handleCloseSafe}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Image Upload Area */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Photos (Unlimited)</span>
              <span className="text-[10px] text-purple-400 font-mono font-bold">{selectedFiles.length} selected</span>
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
            />

            {previews.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                {previews.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-800 group">
                    <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1.5 right-1.5 p-1 bg-slate-950/80 text-rose-400 hover:text-rose-300 rounded-lg backdrop-blur-sm transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-2xl border border-dashed border-slate-700 hover:border-purple-500/50 bg-slate-950/40 hover:bg-purple-500/5 text-slate-400 hover:text-purple-300 flex flex-col items-center justify-center gap-1 transition-all"
                >
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">+ Add More</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="py-6 border border-dashed border-purple-500/40 hover:border-purple-400 bg-purple-500/10 hover:bg-purple-500/20 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-purple-300 transition-all"
                >
                  <Camera className="w-5 h-5 text-purple-400" />
                  <span className="text-xs font-bold">Capture Camera</span>
                  <span className="text-[9px] text-purple-400/70 font-mono">Realtime Photo/Video</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-6 border border-dashed border-slate-700 hover:border-sky-500/50 bg-slate-950/40 hover:bg-sky-500/5 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-sky-300 transition-all"
                >
                  <ImageIcon className="w-5 h-5 text-sky-400" />
                  <span className="text-xs font-bold">Upload Gallery</span>
                  <span className="text-[9px] text-slate-500 font-mono">Photo/Video Files</span>
                </button>
              </div>
            )}
          </div>

          <MomentCameraModal
            isOpen={isCameraOpen}
            onClose={() => setIsCameraOpen(false)}
            onMediaCaptured={(captured) => {
              setSelectedFiles((prev) => [...prev, captured.file]);
              setPreviews((prev) => [...prev, URL.createObjectURL(captured.file)]);
            }}
          />

          {/* Caption Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Caption (Optional)</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 500))}
              placeholder="Add a moment caption or note for group members..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 resize-none"
            />
            <div className="flex justify-end text-[10px] text-slate-500 font-mono">
              {caption.length}/500
            </div>
          </div>

          {/* Permanent Moment Note */}
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-[11px] text-purple-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-purple-400" />
            <span>Permanent Group Moment — Visible to group members indefinitely.</span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Sharing Moment...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Post Permanent Moment to Group</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
