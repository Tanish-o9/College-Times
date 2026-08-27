import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getCampusNotificationPreferences,
  setCampusNotificationPreferences,
} from '../../services/campusNotificationPreferenceService';
import type { CampusNotificationPreferences } from '../../types/models';
import { DEFAULT_CAMPUS_NOTIFICATION_PREFERENCES } from '../../types/models';
import {
  Bell,
  ArrowLeft,
  ShieldAlert,
  Megaphone,
  AtSign,
  CornerDownRight,
  Heart,
  Info,
  RefreshCw,
  Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

export const CampusNotificationSettings: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState<CampusNotificationPreferences>(
    DEFAULT_CAMPUS_NOTIFICATION_PREFERENCES
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;
    setLoading(true);

    getCampusNotificationPreferences(currentUser.uid)
      .then((data) => {
        if (isMounted) setPrefs(data);
      })
      .catch(() => {
        if (isMounted) setPrefs(DEFAULT_CAMPUS_NOTIFICATION_PREFERENCES);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const handleToggle = async (key: keyof CampusNotificationPreferences) => {
    if (!currentUser || saving) return;
    const newValue = !prefs[key];
    setSaving(true);

    // Optimistic UI update
    setPrefs((prev) => ({ ...prev, [key]: newValue }));

    try {
      await setCampusNotificationPreferences(currentUser.uid, { [key]: newValue });
      toast.success('Campus notification preference saved.');
    } catch (err: any) {
      setPrefs((prev) => ({ ...prev, [key]: !newValue })); // Rollback
      toast.error('Failed to save preference.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
              <Bell className="w-5 h-5 text-sky-400" />
              <span>Campus Notification Preferences</span>
            </h1>
            <p className="text-[11px] text-slate-400">Manage feed & campus alert delivery settings</p>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Informational Callout */}
        <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-3xl flex items-start gap-3">
          <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <p className="text-xs text-sky-200 leading-relaxed">
            <strong className="text-white block font-bold mb-0.5">Feed Visibility Separation</strong>
            Turning off notifications does not hide campus posts from your feed. You will still see all relevant campus content when browsing.
          </p>
        </div>

        {loading ? (
          <div className="p-8 bg-slate-900/40 border border-slate-800/80 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading preferences...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Campus Alert Priorities Section */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-sky-400" />
                <span>Campus Updates & Broadcasts</span>
              </h3>

              {/* Campus Updates */}
              <div className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
                <div>
                  <span className="font-bold text-white text-xs block">Standard Campus Updates</span>
                  <span className="text-[10px] text-slate-400 block">General campus news, announcements, and lost & found</span>
                </div>
                <button
                  onClick={() => handleToggle('enabled')}
                  className={`w-11 h-6 rounded-full transition-colors relative p-1 border ${
                    prefs.enabled ? 'bg-sky-600 border-sky-500' : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    prefs.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Important Updates */}
              <div className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
                <div>
                  <span className="font-bold text-white text-xs block flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Important Campus Updates</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block">Featured events, timetable changes, and official notices</span>
                </div>
                <button
                  onClick={() => handleToggle('importantEnabled')}
                  className={`w-11 h-6 rounded-full transition-colors relative p-1 border ${
                    prefs.importantEnabled ? 'bg-amber-600 border-amber-500' : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    prefs.importantEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Emergency Alerts */}
              <div className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
                <div>
                  <span className="font-bold text-white text-xs block flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>Emergency Campus Alerts</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block">Critical high-priority campus safety & administrative alerts</span>
                </div>
                <button
                  onClick={() => handleToggle('emergencyEnabled')}
                  className={`w-11 h-6 rounded-full transition-colors relative p-1 border ${
                    prefs.emergencyEnabled ? 'bg-rose-600 border-rose-500' : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    prefs.emergencyEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            {/* Social Interactions Section */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
              <h3 className="font-bold text-white text-sm">Social & Chat Notifications</h3>

              {/* Mentions */}
              <div className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                    <AtSign className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">@Mentions</span>
                    <span className="text-[10px] text-slate-400 block">Alerts when someone mentions you in chat or comments</span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle('mentionsEnabled')}
                  className={`w-11 h-6 rounded-full transition-colors relative p-1 border ${
                    prefs.mentionsEnabled ? 'bg-purple-600 border-purple-500' : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    prefs.mentionsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Replies */}
              <div className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                    <CornerDownRight className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">Replies & Comments</span>
                    <span className="text-[10px] text-slate-400 block">Alerts when someone replies to your post or message</span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle('repliesEnabled')}
                  className={`w-11 h-6 rounded-full transition-colors relative p-1 border ${
                    prefs.repliesEnabled ? 'bg-sky-600 border-sky-500' : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    prefs.repliesEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Reactions */}
              <div className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                    <Heart className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">Reactions & Likes</span>
                    <span className="text-[10px] text-slate-400 block">Alerts when someone reacts to your post or message (Default OFF)</span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle('reactionsEnabled')}
                  className={`w-11 h-6 rounded-full transition-colors relative p-1 border ${
                    prefs.reactionsEnabled ? 'bg-rose-600 border-rose-500' : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    prefs.reactionsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
