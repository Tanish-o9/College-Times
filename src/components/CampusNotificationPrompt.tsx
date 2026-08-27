import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  isPushNotificationSupported,
  getNotificationPermissionState,
  requestPushNotificationPermission,
} from '../services/pushNotificationService';
import { Bell, X } from 'lucide-react';
import toast from 'react-hot-toast';

export const CampusNotificationPrompt: React.FC = () => {
  const { currentUser } = useAuth();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    if (!isPushNotificationSupported()) return;

    const perm = getNotificationPermissionState();
    const dismissedSession = sessionStorage.getItem('campus_notif_prompt_dismissed');

    if (perm === 'default' && !dismissedSession) {
      // Show prompt after brief delay so as not to interrupt page load
      const timer = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [currentUser]);

  const handleEnable = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const granted = await requestPushNotificationPermission(currentUser);
      if (granted) {
        toast.success('Campus incident alerts enabled!');
        setVisible(false);
      } else {
        toast.error('Permission was not granted.');
        setVisible(false);
      }
    } catch (err) {
      toast.error('Failed to enable push notifications.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('campus_notif_prompt_dismissed', 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-3 animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Campus Instant Alerts</h4>
            <p className="text-[11px] text-slate-400">Get instant alerts for emergency campus incidents.</p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="p-1 text-slate-500 hover:text-slate-300 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleDismiss}
          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
        >
          Not Now
        </button>
        <button
          onClick={handleEnable}
          disabled={submitting}
          className="flex-1 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 shadow-lg"
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Enable</span>
        </button>
      </div>
    </div>
  );
};
