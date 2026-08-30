import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import { createGroupInstant } from '../../services/groupInstantService';
import type { MomentSourceType } from '../../types/group';
import { X, Sparkles, RefreshCw, Send, Camera, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface MomentComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  mediaItem: {
    file: File;
    sourceType: MomentSourceType;
    type: 'image' | 'video';
    width?: number;
    height?: number;
    duration?: number;
  } | null;
  onInstantCreated?: () => void;
  onRetakeCamera?: () => void;
  onChooseGallery?: () => void;
}

export const MomentComposerModal: React.FC<MomentComposerModalProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  mediaItem,
  onInstantCreated,
  onRetakeCamera,
  onChooseGallery,
}) => {
  const { currentUser, userProfile } = useAuth();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (mediaItem?.file) {
      const url = URL.createObjectURL(mediaItem.file);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [mediaItem]);

  const handleCloseSafe = () => {
    if (submitting) return;
    if (caption.trim()) {
      if (window.confirm('Discard unsaved moment?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  useOverlayBackHandler(isOpen, handleCloseSafe);

  if (!isOpen || !mediaItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submitting || !mediaItem.file) return;

    setSubmitting(true);
    setUploadProgress(30);

    try {
      setUploadProgress(70);
      await createGroupInstant(
        groupId,
        caption,
        [mediaItem.file],
        currentUser,
        userProfile,
        {
          sourceType: mediaItem.sourceType,
          captureMetadata: {
            mimeType: mediaItem.file.type,
            width: mediaItem.width,
            height: mediaItem.height,
          },
          expiresInHours: 24,
        }
      );

      setUploadProgress(100);
      toast.success('Instant Moment shared with group!');
      setCaption('');
      if (onInstantCreated) onInstantCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to post Moment.');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 h-[100dvh] w-full touch-none overscroll-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] animate-in fade-in duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Preview & Share Moment</h2>
              <p className="text-[10px] text-slate-400 truncate">Posting to {groupName}</p>
            </div>
          </div>

          <button
            onClick={handleCloseSafe}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Source Type Badge */}
          <div className="flex items-center justify-between px-1">
            <span
              className={`px-3 py-1 text-[11px] font-bold rounded-full border flex items-center gap-1.5 ${
                mediaItem.sourceType === 'camera'
                  ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                  : 'bg-sky-500/10 text-sky-300 border-sky-500/30'
              }`}
            >
              {mediaItem.sourceType === 'camera' ? (
                <>
                  <Camera className="w-3.5 h-3.5 text-purple-400" />
                  <span>Captured in App (Camera)</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>Uploaded from Gallery</span>
                </>
              )}
            </span>

            <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">
              Expires in 24h
            </span>
          </div>

          {/* Media Viewport Preview */}
          <div className="relative aspect-[3/4] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-lg group">
            {previewUrl && (
              mediaItem.type === 'video' ? (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Moment Preview"
                  className="w-full h-full object-cover"
                />
              )
            )}

            {/* Change / Retake Overlay Trigger */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              {mediaItem.sourceType === 'camera' && onRetakeCamera && (
                <button
                  type="button"
                  onClick={onRetakeCamera}
                  disabled={submitting}
                  className="px-3 py-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold rounded-xl backdrop-blur-md transition-all flex items-center gap-1"
                >
                  <Camera className="w-3.5 h-3.5 text-purple-400" />
                  <span>Retake Photo</span>
                </button>
              )}

              {mediaItem.sourceType === 'gallery' && onChooseGallery && (
                <button
                  type="button"
                  onClick={onChooseGallery}
                  disabled={submitting}
                  className="px-3 py-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold rounded-xl backdrop-blur-md transition-all flex items-center gap-1"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>Choose Another</span>
                </button>
              )}
            </div>
          </div>

          {/* Optional Caption Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Add Caption (Optional)</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 300))}
              placeholder="What's happening right now? Add a note..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 resize-none"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
              <span>Short story caption</span>
              <span>{caption.length}/300</span>
            </div>
          </div>

          {/* Upload Progress Bar */}
          {submitting && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                <span>Uploading Moment...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Post Moment Action */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold text-xs rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Posting Moment...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Post Instant Moment to Group</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
