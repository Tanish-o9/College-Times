import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import { createLostFoundPost, type CreateLostFoundPayload } from '../../services/postService';
import { uploadPostImage } from '../../services/storageService';
import type { Post } from '../../types';
import toast from 'react-hot-toast';
import { 
  X, 
  Search, 
  Send, 
  RefreshCw, 
  Upload, 
  Trash2,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface LostFoundFormProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: Post) => void;
}

export const LostFoundForm: React.FC<LostFoundFormProps> = ({
  isOpen,
  onClose,
  onPostCreated,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [postType, setPostType] = useState<'lost' | 'found'>('lost');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const hasChanges = (
    title.trim().length > 0 ||
    content.trim().length > 0 ||
    contactInfo.trim().length > 0 ||
    selectedFile !== null
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
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading' | 'publishing'>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPostType('lost');
      setTitle('');
      setContent('');
      setContactInfo('');
      setImageUrl('');
      setSelectedFile(null);
      setImagePreview(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.');
      return;
    }

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  // Indian mobile regex validation (10 digits starting with 6-9)
  const cleanContact = contactInfo.replace(/\D/g, '');
  const indianPhoneRegex = /^[6-9]\d{9}$/;
  const isContactValid = indianPhoneRegex.test(cleanContact);

  const isFormValid = 
    title.trim().length > 0 && 
    content.trim().length > 0 && 
    isContactValid && 
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !currentUser) return;

    setSubmitting(true);
    let finalImageUrl = imageUrl.trim();

    try {
      if (selectedFile) {
        setUploadStep('uploading');
        toast.loading('Compressing & uploading photo...', { id: 'lf-upload' });
        finalImageUrl = await uploadPostImage(selectedFile, currentUser.uid);
      }

      setUploadStep('publishing');
      toast.loading('Publishing Lost & Found notice...', { id: 'lf-upload' });

      const payload: CreateLostFoundPayload = {
        title: title.trim(),
        content: content.trim(),
        postType,
        contactInfo: cleanContact.slice(-10),
        ...(finalImageUrl ? { imageUrl: finalImageUrl } : {}),
      };

      const newPost = await createLostFoundPost(payload, currentUser, userProfile);
      toast.success('Notice published to Lost & Found!', { id: 'lf-upload' });
      onPostCreated(newPost);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish notice.', { id: 'lf-upload' });
    } finally {
      setSubmitting(false);
      setUploadStep('idle');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={handleCloseSafe} />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Search className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">Post Lost & Found Notice</h2>
          </div>
          <button onClick={handleCloseSafe} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Lost / Found Segmented Control */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Notice Type
            </label>
            <div className="grid grid-cols-2 gap-3 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setPostType('lost')}
                className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  postType === 'lost'
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>LOST ITEM</span>
              </button>

              <button
                type="button"
                onClick={() => setPostType('found')}
                className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  postType === 'found'
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>FOUND ITEM</span>
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="lf-title" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Item Title <span className="text-rose-400">*</span>
            </label>
            <input
              id="lf-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder={postType === 'lost' ? 'e.g., Lost Blue Boat Earbuds in CS Lab' : 'e.g., Found Black Wallet near Canteen'}
              required
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 focus:border-amber-500 rounded-xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Details */}
          <div>
            <label htmlFor="lf-content" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Item Description & Location Details <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="lf-content"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              placeholder="Provide specific details (color, brand, exact place found/lost)..."
              required
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 focus:border-amber-500 rounded-xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
            />
          </div>

          {/* WhatsApp Contact Number */}
          <div>
            <label htmlFor="lf-contact" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              WhatsApp Contact Number <span className="text-rose-400">* (10 Digits)</span>
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-500 font-mono text-xs">+91</span>
              <input
                id="lf-contact"
                type="tel"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="9876543210"
                required
                maxLength={10}
                className="w-full pl-12 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-amber-500 rounded-xl text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            {!isContactValid && contactInfo.length > 0 && (
              <p className="text-[10px] text-rose-400 mt-1">Please enter a valid 10-digit mobile number.</p>
            )}
          </div>

          {/* Photo Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Attach Item Photo <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            {imagePreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 max-h-36">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={removeSelectedFile}
                  className="absolute top-2 right-2 p-1.5 bg-slate-950/80 text-white rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="lf-file" />
                <label
                  htmlFor="lf-file"
                  className="w-full p-3 border-2 border-dashed border-slate-800 hover:border-amber-500/50 bg-slate-950/40 rounded-2xl flex items-center justify-center gap-2 text-xs text-slate-400 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>Upload Photo of Item</span>
                </label>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleCloseSafe}
              className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 text-white font-semibold text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{uploadStep === 'uploading' ? 'Uploading Photo...' : 'Publishing...'}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Publish Notice</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
