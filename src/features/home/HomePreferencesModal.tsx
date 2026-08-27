import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { defaultHomeWidgets, type HomeWidgetConfig } from '../../services/homeRankingService';
import { Sliders, X, Check, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface HomePreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (newConfigs: HomeWidgetConfig[]) => void;
}

export const HomePreferencesModal: React.FC<HomePreferencesModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { currentUser } = useAuth();
  const [widgets, setWidgets] = useState<HomeWidgetConfig[]>([...defaultHomeWidgets]);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const toggleWidget = (id: string) => {
    if (id === 'emergencyAlerts') {
      toast.error('Emergency Alerts cannot be hidden.');
      return;
    }
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const moveUp = (index: number) => {
    if (index <= 1) return; // Cannot move above index 0 (Emergency Alerts)
    const updated = [...widgets];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setWidgets(updated);
  };

  const moveDown = (index: number) => {
    if (index === 0 || index >= widgets.length - 1) return;
    const updated = [...widgets];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setWidgets(updated);
  };

  const handleSave = async () => {
    if (!currentUser || saving) return;
    setSaving(true);
    try {
      const ref = doc(db, 'users', currentUser.uid, 'homePreferences', 'settings');
      await setDoc(ref, { widgets }, { merge: true });
      onSaved(widgets);
      toast.success('Dashboard layout saved!');
      onClose();
    } catch (err: any) {
      toast.error('Failed to save dashboard preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-sky-400" />
            <span>Customize Campus Home</span>
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-none">
          {widgets.map((w, idx) => (
            <div
              key={w.id}
              className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
                w.enabled
                  ? 'bg-slate-950 border-slate-800 text-white'
                  : 'bg-slate-950/40 border-slate-900 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={w.enabled}
                  onChange={() => toggleWidget(w.id)}
                  disabled={w.id === 'emergencyAlerts'}
                  className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0"
                />
                <span>{w.name}</span>
              </div>

              {idx > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 1}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === widgets.length - 1}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-sky-500 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Save Order</span>
          </button>
        </div>
      </div>
    </div>
  );
};
