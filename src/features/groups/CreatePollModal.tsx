import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import { createPollPost } from '../../services/pollService';
import type { Post } from '../../types/models';
import { X, BarChart3, Plus, Trash2, Send, RefreshCw, Lock, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId?: string;
  onPollCreated?: (post: Post) => void;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  groupId,
  onPollCreated,
}) => {
  const { currentUser, userProfile } = useAuth();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['Option 1', 'Option 2']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [durationDays, setDurationDays] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  const hasChanges = (
    question.trim().length > 0 ||
    options.some(o => o.trim() !== '' && !o.startsWith('Option '))
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

  const handleAddOption = () => {
    if (options.length >= 10) {
      toast.error('Maximum 10 options allowed.');
      return;
    }
    setOptions([...options, `Option ${options.length + 1}`]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast.error('Minimum 2 options required.');
      return;
    }
    setOptions(options.filter((_, idx) => idx !== index));
  };

  const handleOptionTextChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submitting) return;

    if (!question.trim()) {
      toast.error('Please enter a poll question.');
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      toast.error('Poll must contain at least 2 non-empty options.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createPollPost(
        {
          question,
          options: cleanOptions,
          allowMultiple,
          anonymous,
          durationDays,
          groupId,
        },
        currentUser,
        userProfile
      );

      toast.success('Poll created successfully!');
      onPollCreated?.(created);
      onClose();
      setQuestion('');
      setOptions(['Option 1', 'Option 2']);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create poll.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={handleCloseSafe} />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">Create Campus Poll</h2>
          </div>
          <button onClick={handleCloseSafe} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Question Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Poll Question *
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
              placeholder="What would you like to ask campus members?"
              rows={2}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Options List */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Poll Options (Min 2, Max 10)
            </label>
            {options.map((optText, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={optText}
                  onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  required
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-1 w-full py-2 bg-slate-950 hover:bg-slate-800 text-purple-400 font-semibold border border-purple-500/20 rounded-xl text-xs flex items-center justify-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Option</span>
              </button>
            )}
          </div>

          {/* Settings Toggles */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAllowMultiple(!allowMultiple)}
              className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all ${
                allowMultiple
                  ? 'bg-purple-500/10 text-purple-300 border-purple-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Allow Multiple Votes</span>
            </button>

            <button
              type="button"
              onClick={() => setAnonymous(!anonymous)}
              className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all ${
                anonymous
                  ? 'bg-purple-500/10 text-purple-300 border-purple-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Anonymous Poll</span>
            </button>
          </div>

          {/* Duration Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Poll Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 3, 7].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setDurationDays(days)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    durationDays === days
                      ? 'bg-purple-500 text-slate-950 border-purple-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  {days} {days === 1 ? 'Day' : 'Days'}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleCloseSafe}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Publish Poll</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
