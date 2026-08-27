import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import {
  getUserFeedPreferences,
  updateUserFeedPreferences,
} from '../../services/feedPreferenceService';
import { DEFAULT_USER_FEED_PREFERENCES, type UserFeedPreferences } from '../../types/feed';
import { X, Sliders, Save, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

interface FeedPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreferencesUpdated?: () => void;
}

const ALL_CATEGORIES = ['General', 'Event', 'LostFound', 'Mishap'];

export const FeedPreferencesModal: React.FC<FeedPreferencesModalProps> = ({
  isOpen,
  onClose,
  onPreferencesUpdated,
}) => {
  const { currentUser } = useAuth();
  useOverlayBackHandler(isOpen, onClose);

  const [prefs, setPrefs] = useState<UserFeedPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser || !isOpen) return;
    setLoading(true);
    getUserFeedPreferences(currentUser.uid)
      .then((data) => setPrefs(data))
      .catch(() => toast.error('Failed to load feed preferences.'))
      .finally(() => setLoading(false));
  }, [currentUser, isOpen]);

  const toggleCategory = (cat: string) => {
    if (!prefs) return;
    const isPreferred = prefs.preferredCategories.includes(cat);

    let nextPreferred = [...prefs.preferredCategories];
    if (isPreferred) {
      if (nextPreferred.length === 1) {
        toast.error('Select at least one preferred category.');
        return;
      }
      nextPreferred = nextPreferred.filter((c) => c !== cat);
    } else {
      nextPreferred.push(cat);
    }

    setPrefs({ ...prefs, preferredCategories: nextPreferred });
  };

  const handleReset = () => {
    setPrefs({ ...DEFAULT_USER_FEED_PREFERENCES });
  };

  const handleSave = async () => {
    if (!currentUser || !prefs || saving) return;
    setSaving(true);
    try {
      await updateUserFeedPreferences(currentUser.uid, prefs);
      toast.success('Feed preferences saved!');
      onPreferencesUpdated?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">Customize Feed Discovery</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading preferences...</span>
          </div>
        ) : !prefs ? null : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                What do you want to see more of?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_CATEGORIES.map((cat) => {
                  const isSelected = prefs.preferredCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`p-3 rounded-2xl text-xs font-bold border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/40 shadow-md'
                          : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span>{cat}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mandatory Notice */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5 text-[11px] text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Critical campus safety information and emergency alerts remain visible regardless of optional category preferences.</span>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Reset Defaults
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Preferences</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
