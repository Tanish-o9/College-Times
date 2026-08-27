import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from '../../services/notificationPreferenceService';
import type { UserNotificationPreferences } from '../../types/notification';
import {
  Bell,
  MessageSquare,
  Heart,
  Calendar,
  ShieldAlert,
  Save,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const NotificationSettings: React.FC = () => {
  const { currentUser } = useAuth();
  const [prefs, setPrefs] = useState<UserNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    getUserNotificationPreferences(currentUser.uid)
      .then((data) => setPrefs(data as any))
      .catch(() => toast.error('Failed to load notification settings.'))
      .finally(() => setLoading(false));
  }, [currentUser]);

  const handleToggle = (key: keyof UserNotificationPreferences) => {
    if ((key as string) === 'campusAlerts') {
      toast.error('Critical campus safety alerts cannot be disabled.');
      return;
    }
    if (!prefs) return;
    setPrefs((prev) => (prev ? { ...prev, [key]: !prev[key] } : null));
  };

  const handleSave = async () => {
    if (!currentUser || !prefs || saving) return;
    setSaving(true);
    try {
      await updateUserNotificationPreferences(currentUser.uid, prefs as any);
      toast.success('Notification preferences saved!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Loading notification preferences...</span>
        </div>
      </div>
    );
  }

  if (!prefs) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white">Notification Settings</h1>
            <p className="text-[11px] text-slate-400">Control alert categories and push notifications</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>Save Preferences</span>
        </button>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Push Notification Toggle */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white">Browser Push Notifications</h3>
              <p className="text-[11px] text-slate-400">Receive push alerts even when the app is in background</p>
            </div>
            <button
              onClick={() => handleToggle('pushEnabled')}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                prefs.pushEnabled ? 'bg-sky-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  prefs.pushEnabled ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Section: Chat */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <MessageSquare className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Chat Notifications</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">@Mentions</span>
                <span className="text-[11px] text-slate-400 block">Notifications when someone tags you in chat</span>
              </div>
              <button
                onClick={() => handleToggle('chatMentions')}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  prefs.chatMentions ? 'bg-sky-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    prefs.chatMentions ? 'left-5' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <div>
                <span className="font-bold text-white block">Chat Activity & Replies</span>
                <span className="text-[11px] text-slate-400 block">Replies to your chat messages</span>
              </div>
              <button
                onClick={() => handleToggle('chatActivity')}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  prefs.chatActivity ? 'bg-sky-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    prefs.chatActivity ? 'left-5' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Section: Social */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Heart className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Social Interactions</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Post Likes & Comments</span>
                <span className="text-[11px] text-slate-400 block">Notifications for reactions and comments on your feed posts</span>
              </div>
              <button
                onClick={() => handleToggle('postInteractions')}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  prefs.postInteractions ? 'bg-sky-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    prefs.postInteractions ? 'left-5' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Section: Campus */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Campus Updates</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Campus Events</span>
                <span className="text-[11px] text-slate-400 block">Event announcements and RSVP confirmations</span>
              </div>
              <button
                onClick={() => handleToggle('eventUpdates')}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  prefs.eventUpdates ? 'bg-sky-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    prefs.eventUpdates ? 'left-5' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <div>
                <span className="font-bold text-white block">Lost & Found Updates</span>
                <span className="text-[11px] text-slate-400 block">Relevant items and resolution alerts</span>
              </div>
              <button
                onClick={() => handleToggle('lostFoundUpdates')}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  prefs.lostFoundUpdates ? 'bg-sky-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    prefs.lostFoundUpdates ? 'left-5' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <div>
                <span className="font-bold text-white block">Admin Announcements</span>
                <span className="text-[11px] text-slate-400 block">Official notices from college administration</span>
              </div>
              <button
                onClick={() => handleToggle('adminAnnouncements')}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  prefs.adminAnnouncements ? 'bg-sky-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    prefs.adminAnnouncements ? 'left-5' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Section: Safety Mandatory Alerts */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Safety & Critical Alerts</h3>
          </div>

          <div className="flex items-center justify-between text-xs opacity-75">
            <div>
              <span className="font-bold text-white block">Critical Campus Safety Alerts</span>
              <span className="text-[11px] text-amber-300 block">Mandatory emergency alerts for student campus safety</span>
            </div>
            <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold rounded-lg border border-amber-500/30">
              MANDATORY
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};
