import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  type UserNotificationPreferences,
} from '../../services/notificationPreferenceService';
import { ArrowLeft, Save, RefreshCw, Bell, Moon, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export const NotificationPreferences: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Preference fields (taxonomies)
  const [social, setSocial] = useState(true);
  const [messages, setMessages] = useState(true);
  const [groups, setGroups] = useState(true);
  const [events, setEvents] = useState(true);
  const [opportunities, setOpportunities] = useState(true);
  const [marketplace, setMarketplace] = useState(true);
  const [feed, setFeed] = useState(true);
  const [system, setSystem] = useState(true);

  // Detailed preference fields
  const [dmNotifications, setDmNotifications] = useState(true);
  const [groupChatNotifications, setGroupChatNotifications] = useState(true);
  const [mentionNotifications, setMentionNotifications] = useState(true);
  const [momentNotifications, setMomentNotifications] = useState(true);
  const [commentReplyNotifications, setCommentReplyNotifications] = useState(true);
  const [eventNotifications, setEventNotifications] = useState(true);
  const [pollNotifications, setPollNotifications] = useState(true);
  const [announcementNotifications, setAnnouncementNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);

  // Quiet Hours config
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');

  // Digest mode
  const [digestMode, setDigestMode] = useState<'immediate' | 'hourly' | 'daily'>('immediate');

  const loadPreferences = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const prefs = await getUserNotificationPreferences(currentUser.uid);
      setSocial(prefs.social);
      setMessages(prefs.messages);
      setGroups(prefs.groups);
      setEvents(prefs.events);
      setOpportunities(prefs.opportunities);
      setMarketplace(prefs.marketplace);
      setFeed(prefs.feed);
      setSystem(prefs.system);

      setDmNotifications(prefs.dmNotifications ?? true);
      setGroupChatNotifications(prefs.groupChatNotifications ?? true);
      setMentionNotifications(prefs.mentionNotifications ?? true);
      setMomentNotifications(prefs.momentNotifications ?? true);
      setCommentReplyNotifications(prefs.commentReplyNotifications ?? true);
      setEventNotifications(prefs.eventNotifications ?? true);
      setPollNotifications(prefs.pollNotifications ?? true);
      setAnnouncementNotifications(prefs.announcementNotifications ?? true);
      setEmailNotifications(prefs.emailNotifications ?? false);
      setPushNotifications(prefs.pushNotifications ?? true);

      if (prefs.quietHours) {
        setQuietHoursEnabled(prefs.quietHours.enabled);
        setQuietHoursStart(prefs.quietHours.start);
        setQuietHoursEnd(prefs.quietHours.end);
      }
      if (prefs.digestMode) {
        setDigestMode(prefs.digestMode);
      }
    } catch (err) {
      toast.error('Failed to load notification settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, [currentUser]);

  const handleSave = async () => {
    if (!currentUser || saving) return;
    setSaving(true);
    try {
      const updatedPrefs: Partial<UserNotificationPreferences> = {
        social,
        messages,
        groups,
        events,
        opportunities,
        marketplace,
        feed,
        system,
        dmNotifications,
        groupChatNotifications,
        mentionNotifications,
        momentNotifications,
        commentReplyNotifications,
        eventNotifications,
        pollNotifications,
        announcementNotifications,
        emailNotifications,
        pushNotifications,
        quietHours: {
          enabled: quietHoursEnabled,
          start: quietHoursStart,
          end: quietHoursEnd,
        },
        digestMode,
      };

      await updateUserNotificationPreferences(currentUser.uid, updatedPrefs);
      toast.success('Notification preferences saved successfully!');
    } catch (err) {
      toast.error('Failed to save notification preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-400 text-xs font-mono">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col pb-12">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-sky-400" />
              <span>Notification Preferences</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Configure alerts, quiet hours, and daily digests</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save Changes</span>
        </button>
      </header>

      {/* Settings Options */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Core preferences */}
        <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Bell className="w-4.5 h-4.5 text-sky-400" />
            <span>General Controls</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800 rounded-2xl">
              <span className="text-xs text-slate-300 font-semibold">Push Notifications</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={pushNotifications}
                  onChange={(e) => setPushNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 peer-checked:after:bg-slate-950"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800 rounded-2xl">
              <span className="text-xs text-slate-300 font-semibold">Email Notifications</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 peer-checked:after:bg-slate-950"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Category toggles */}
        <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Bell className="w-4.5 h-4.5 text-sky-400" />
            <span>Alert Categories</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {[
              { label: 'Direct Messages', val: dmNotifications, set: setDmNotifications },
              { label: 'Group Chats', val: groupChatNotifications, set: setGroupChatNotifications },
              { label: 'Mentions (@user)', val: mentionNotifications, set: setMentionNotifications },
              { label: 'Group Moments', val: momentNotifications, set: setMomentNotifications },
              { label: 'Comments & Replies', val: commentReplyNotifications, set: setCommentReplyNotifications },
              { label: 'Event Reminders', val: eventNotifications, set: setEventNotifications },
              { label: 'Poll Activity', val: pollNotifications, set: setPollNotifications },
              { label: 'Admin Announcements', val: announcementNotifications, set: setAnnouncementNotifications },
              { label: 'Opportunities Feed', val: opportunities, set: setOpportunities },
              { label: 'Marketplace Deals', val: marketplace, set: setMarketplace },
            ].map((pref, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800 rounded-2xl">
                <span className="text-xs text-slate-300 font-semibold">{pref.label}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pref.val}
                    onChange={(e) => pref.set(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 peer-checked:after:bg-slate-950"></div>
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Quiet Hours */}
        <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Moon className="w-4.5 h-4.5 text-sky-400" />
              <span>Quiet Hours</span>
            </h2>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={quietHoursEnabled}
                onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 peer-checked:after:bg-slate-950"></div>
            </label>
          </div>

          {quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950/40 border border-slate-800 rounded-2xl">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Start Time</label>
                <input
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">End Time</label>
                <input
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          )}
        </section>

        {/* Digest Settings */}
        <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4.5 h-4.5 text-sky-400" />
            <span>Notification Digest Mode</span>
          </h2>

          <div className="space-y-3">
            {[
              { id: 'immediate', title: 'Immediate Notifications', desc: 'Deliver updates directly as they happen.' },
              { id: 'hourly', title: 'Hourly Digest Summary', desc: 'Bundle normal & low priority alerts into hourly reports.' },
              { id: 'daily', title: 'Daily Digest Summary', desc: 'Deliver a single combined daily recap.' },
            ].map((modeOption) => (
              <label
                key={modeOption.id}
                className={`p-4 rounded-2xl border flex items-start justify-between cursor-pointer transition-all ${
                  digestMode === modeOption.id
                    ? 'bg-sky-500/10 border-sky-500/40'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-800'
                }`}
              >
                <div>
                  <h3 className="text-xs font-bold text-white">{modeOption.title}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{modeOption.desc}</p>
                </div>
                <input
                  type="radio"
                  name="digestMode"
                  checked={digestMode === modeOption.id}
                  onChange={() => setDigestMode(modeOption.id as any)}
                  className="mt-1"
                />
              </label>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
