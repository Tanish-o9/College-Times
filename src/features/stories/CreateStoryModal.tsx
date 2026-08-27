import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { StoryAudience, StoryMediaType } from '../../types/story';
import { createStory } from '../../services/storyService';
import { uploadSingleStoryImage } from '../../services/postMediaService';
import toast from 'react-hot-toast';
import { X, Image as ImageIcon, Type, Sparkles, RefreshCw } from 'lucide-react';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const BACKGROUND_GRADIENTS = [
  'from-indigo-600 to-purple-700',
  'from-rose-500 to-amber-600',
  'from-emerald-600 to-teal-800',
  'from-blue-600 to-cyan-700',
  'from-fuchsia-600 to-pink-700',
];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { currentUser } = useAuth();
  const [mediaType, setMediaType] = useState<StoryMediaType>('text');
  const [text, setText] = useState<string>('');
  const [selectedBg, setSelectedBg] = useState<string>(BACKGROUND_GRADIENTS[0]);
  const [audience, setAudience] = useState<StoryAudience>('campus');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size must be less than 10MB.');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (mediaType === 'text' && !text.trim()) {
      toast.error('Please enter text for your story.');
      return;
    }
    if (mediaType === 'image' && !imageFile) {
      toast.error('Please select an image for your story.');
      return;
    }

    setLoading(true);
    try {
      let mediaUrl: string | undefined;
      let storagePath: string | undefined;

      if (mediaType === 'image' && imageFile) {
        const tempStoryId = `story_${Date.now()}`;
        const result = await uploadSingleStoryImage(imageFile, currentUser.uid, tempStoryId);
        mediaUrl = result.url;
        storagePath = result.storagePath;
      }

      await createStory(currentUser, {
        mediaType,
        text: text.trim(),
        mediaUrl,
        storagePath,
        backgroundStyle: selectedBg,
        audience,
      });

      toast.success('Story posted to campus! 🌟');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to post story.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 z-10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>Create 24h Campus Story</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Story Type Tabs */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setMediaType('text')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mediaType === 'text' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Text Story</span>
          </button>
          <button
            type="button"
            onClick={() => setMediaType('image')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mediaType === 'image' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Image Story</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mediaType === 'text' ? (
            <div className="space-y-3">
              <div className={`w-full h-44 rounded-2xl bg-gradient-to-tr ${selectedBg} p-4 flex items-center justify-center text-center shadow-inner`}>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 500))}
                  placeholder="Type your story update..."
                  rows={3}
                  className="w-full bg-transparent text-white font-bold text-base placeholder-slate-300/70 text-center focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{text.length}/500 chars</span>
                <div className="flex items-center gap-1.5">
                  {BACKGROUND_GRADIENTS.map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setSelectedBg(bg)}
                      className={`w-6 h-6 rounded-full bg-gradient-to-tr ${bg} border-2 ${
                        selectedBg === bg ? 'border-white scale-110' : 'border-transparent'
                      } transition-all`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {imagePreview ? (
                <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-slate-800">
                  <img src={imagePreview} alt="Story Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-slate-950/80 text-white rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="w-full h-40 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-500/50 transition-all bg-slate-950/50">
                  <ImageIcon className="w-8 h-8 text-indigo-400" />
                  <span className="text-xs text-slate-400 font-semibold">Click to upload story photo (Max 10MB)</span>
                  <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </label>
              )}

              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 100))}
                placeholder="Add optional caption..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Audience Selector */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <label className="text-xs font-semibold text-slate-400">Audience:</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as StoryAudience)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="campus">Entire Campus</option>
              <option value="group">Campus Group Only</option>
              <option value="close_friends">Close Friends Only</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Share Story (24 Hours)</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
