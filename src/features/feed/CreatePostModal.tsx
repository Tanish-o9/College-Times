import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import { createPost, type CreatePostPayload } from '../../services/postService';
import type { Post, AudienceType, PostPriority } from '../../types';
import toast from 'react-hot-toast';
import { 
  X, 
  Sparkles, 
  Send, 
  RefreshCw, 
  AlertCircle, 
  Image as ImageIcon, 
  Info, 
  Calendar, 
  AlertTriangle, 
  Search,
  Upload,
  Trash2,
  Bell
} from 'lucide-react';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: Post) => void;
}

type CategoryOption = 'General' | 'Event' | 'Mishap' | 'LostFound';

const TITLE_MAX = 80;
const CONTENT_MAX = 500;

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
}) => {
  const { currentUser, userProfile } = useAuth();
  
  // Intercept back button when modal is open
  useOverlayBackHandler(isOpen, onClose);
  
  // Controlled form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<CategoryOption>('General');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [uploadProgresses, setUploadProgresses] = useState<number[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading_image' | 'publishing' | 'done'>('idle');
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [audienceType, setAudienceType] = useState<AudienceType>('campus');
  const [priority, setPriority] = useState<PostPriority>('normal');
  const [notifyAudience, setNotifyAudience] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setContent('');
      setCategory('General');
      setImageUrl('');
      setSelectedFiles([]);
      setFilePreviews([]);
      setUploadProgresses([]);
      setAudienceType('campus');
      setPriority('normal');
      setNotifyAudience(false);
      setSubmitting(false);
      setUploadStep('idle');
      setShowConfirmClose(false);
    }
  }, [isOpen]);

  // Check if form has unsaved edits
  const hasUnsavedChanges = 
    title.trim().length > 0 || 
    content.trim().length > 0 || 
    imageUrl.trim().length > 0 ||
    selectedFiles.length > 0;

  // Handle request to close modal
  const handleAttemptClose = () => {
    if (submitting) return;

    if (hasUnsavedChanges) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const confirmDiscard = () => {
    setShowConfirmClose(false);
    onClose();
  };

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (showConfirmClose) {
          setShowConfirmClose(false);
        } else {
          handleAttemptClose();
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasUnsavedChanges, showConfirmClose, submitting]);

  // File selection handler with 5-image limit and 10MB guard
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files || files.length === 0) return;

    if (selectedFiles.length + files.length > 5) {
      toast.error('Maximum of 5 images allowed per post.', { id: 'max-files-error' });
      return;
    }

    const invalid = files.find((f) => f.size > 10 * 1024 * 1024);
    if (invalid) {
      toast.error(`File '${invalid.name}' exceeds 10MB limit.`, { id: 'file-size-error' });
      return;
    }

    const newFiles = [...selectedFiles, ...files].slice(0, 5);
    setSelectedFiles(newFiles);

    const previews = newFiles.map((f) => URL.createObjectURL(f));
    setFilePreviews(previews);
    setUploadProgresses(newFiles.map(() => 0));
  };

  const removeFileAt = (idx: number) => {
    const nextFiles = selectedFiles.filter((_, i) => i !== idx);
    setSelectedFiles(nextFiles);

    if (filePreviews[idx]) {
      URL.revokeObjectURL(filePreviews[idx]);
    }
    const nextPreviews = filePreviews.filter((_, i) => i !== idx);
    setFilePreviews(nextPreviews);
    setUploadProgresses(nextFiles.map(() => 0));
  };

  // Auto-grow textarea height
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= CONTENT_MAX) {
      setContent(val);
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Form validity checks
  const isTitleValid = title.trim().length > 0 && title.length <= TITLE_MAX;
  const isContentValid = content.trim().length > 0 && content.length <= CONTENT_MAX;
  const isFormValid = isTitleValid && isContentValid && !submitting;

  // Percentage for character counter warning highlights
  const titleUsagePercent = (title.length / TITLE_MAX) * 100;
  const contentUsagePercent = (content.length / CONTENT_MAX) * 100;

  // Submit Handler: Multi-stage image upload then post creation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !currentUser) return;

    setSubmitting(true);

    try {
      let uploadedImages: { storagePath: string; downloadUrl: string }[] = [];

      // Stage 1: Upload Selected Images
      if (selectedFiles.length > 0) {
        setUploadStep('uploading_image');
        toast.loading(`Uploading ${selectedFiles.length} image(s)...`, { id: 'post-upload-status' });

        const { uploadPostImages } = await import('../../services/postMediaService');
        uploadedImages = await uploadPostImages(
          selectedFiles,
          `post_${Date.now()}`,
          currentUser.uid,
          (fileIdx, pct) => {
            setUploadProgresses((prev) => {
              const copy = [...prev];
              copy[fileIdx] = pct;
              return copy;
            });
          }
        );
      }

      // Stage 2: Create Post in Firestore
      setUploadStep('publishing');
      toast.loading('Publishing campus post...', { id: 'post-upload-status' });

      const payload: CreatePostPayload = {
        title: title.trim(),
        content: content.trim(),
        category,
        ...(uploadedImages.length > 0 ? { images: uploadedImages, imageUrl: uploadedImages[0].downloadUrl } : imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
        audience: { type: audienceType },
        priority,
        notifyAudience,
      };

      const newPost = await createPost(payload, currentUser, userProfile);

      toast.success('Posted to campus feed!', { id: 'post-upload-status' });
      onPostCreated(newPost);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish post. Your draft was preserved.', { id: 'post-upload-status' });
    } finally {
      setSubmitting(false);
      setUploadStep('idle');
    }
  };

  if (!isOpen) return null;

  const categories: { label: CategoryOption; icon: React.ReactNode }[] = [
    { label: 'General', icon: <Info className="w-3.5 h-3.5" /> },
    { label: 'Event', icon: <Calendar className="w-3.5 h-3.5" /> },
    { label: 'Mishap', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { label: 'LostFound', icon: <Search className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={handleAttemptClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">Create Campus Post</h2>
          </div>

          <button
            onClick={handleAttemptClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Category Chip Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const isSelected = category === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20'
                        : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {cat.icon}
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audience Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Target Audience
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'campus' as AudienceType, label: 'Entire Campus', disabled: false },
                { type: 'channel' as AudienceType, label: 'Current Channel', disabled: false },
                { type: 'department' as AudienceType, label: userProfile?.departmentId ? `Dept (${userProfile.departmentId.toUpperCase()})` : 'Department Group', disabled: false },
                { type: 'batch' as AudienceType, label: userProfile?.batchYear ? `Batch ${userProfile.batchYear}` : 'Batch Group', disabled: false },
              ].map((aud) => (
                <button
                  key={aud.type}
                  type="button"
                  disabled={aud.disabled}
                  onClick={() => setAudienceType(aud.type)}
                  className={`p-2.5 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between ${
                    aud.disabled
                      ? 'bg-slate-950/40 text-slate-600 border-slate-900 cursor-not-allowed opacity-60'
                      : audienceType === aud.type
                      ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>{aud.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Priority Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Post Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { p: 'normal' as PostPriority, label: 'Normal', desc: 'Standard update', disabled: false },
                { p: 'important' as PostPriority, label: 'Important', desc: 'Featured update', disabled: false },
                { 
                  p: 'emergency' as PostPriority, 
                  label: 'Emergency', 
                  desc: 'Admin Alert', 
                  disabled: userProfile?.role !== 'admin' 
                },
              ].map((item) => (
                <button
                  key={item.p}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => setPriority(item.p)}
                  className={`p-2.5 rounded-xl text-xs font-semibold border transition-all text-left flex flex-col ${
                    item.disabled
                      ? 'bg-slate-950/40 text-slate-600 border-slate-900 cursor-not-allowed opacity-60'
                      : priority === item.p
                      ? item.p === 'emergency'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : item.p === 'important'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold">{item.label}</span>
                  <span className="text-[10px] opacity-75 font-normal">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notify Audience Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-sky-400" />
              <div>
                <span className="text-xs font-bold text-white block">Notify Audience Members</span>
                <span className="text-[10px] text-slate-400 block">Publish FCM push alert to selected topic</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNotifyAudience(!notifyAudience)}
              className={`w-10 h-5 rounded-full transition-colors relative p-0.5 border ${
                notifyAudience ? 'bg-sky-600 border-sky-500' : 'bg-slate-800 border-slate-700'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                notifyAudience ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Post Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="post-title" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Title <span className="text-rose-400">*</span>
              </label>
              <span className={`text-[11px] font-mono font-medium ${
                titleUsagePercent >= 90 ? 'text-rose-400 font-bold' : 'text-slate-500'
              }`}>
                {title.length}/{TITLE_MAX}
              </span>
            </div>
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              placeholder="Headline or brief title for your post..."
              required
              maxLength={TITLE_MAX}
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 focus:border-sky-500 rounded-xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
            />
          </div>

          {/* Post Content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="post-content" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Content Body <span className="text-rose-400">*</span>
              </label>
              <span className={`text-[11px] font-mono font-medium ${
                contentUsagePercent >= 90 ? 'text-rose-400 font-bold' : 'text-slate-500'
              }`}>
                {content.length}/{CONTENT_MAX}
              </span>
            </div>
            <textarea
              id="post-content"
              ref={textareaRef}
              rows={4}
              value={content}
              onChange={handleContentChange}
              placeholder="Describe what's happening, lost item details, or event information..."
              required
              maxLength={CONTENT_MAX}
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 focus:border-sky-500 rounded-xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all resize-none min-h-[100px]"
            />
          </div>

          {/* Image Picker Dropzone / Thumbnail Preview Grid */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Post Photos <span className="text-slate-500 font-normal">(Optional, max 5 photos, 10MB limit)</span>
            </label>

            {filePreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                {filePreviews.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 group bg-slate-950">
                    <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFileAt(idx)}
                      className="absolute top-1 right-1 p-1 bg-slate-950/80 hover:bg-rose-500 text-white rounded-lg transition-colors"
                      title="Remove Photo"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {uploadProgresses[idx] > 0 && uploadProgresses[idx] < 100 && (
                      <div className="absolute inset-x-0 bottom-0 bg-sky-500/80 h-1" style={{ width: `${uploadProgresses[idx]}%` }} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {filePreviews.length < 5 && (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="image-picker-input"
                />
                <label
                  htmlFor="image-picker-input"
                  className="w-full p-3.5 border-2 border-dashed border-slate-800 hover:border-sky-500/50 bg-slate-950/40 rounded-2xl flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer transition-all"
                >
                  <Upload className="w-4 h-4 text-sky-400" />
                  <span>Choose Photos ({filePreviews.length}/5 selected)</span>
                </label>

                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-500">
                    <ImageIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Or paste external image URL..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 focus:border-sky-500 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleAttemptClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!isFormValid}
              className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl shadow-lg shadow-sky-500/20 flex items-center gap-2 transition-all"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>
                    {uploadStep === 'uploading_image' ? 'Uploading Image...' : 'Publishing...'}
                  </span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Publish Post</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Unsaved Changes Confirmation Dialog */}
      {showConfirmClose && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Discard Unsaved Draft?</h3>
              <p className="text-xs text-slate-400 mt-1">
                You have typed text or attached a photo. If you leave now, your draft will be lost.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowConfirmClose(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Keep Editing
              </button>
              <button
                onClick={confirmDiscard}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-rose-500/20"
              >
                Discard Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
