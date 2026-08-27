import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getMyChannels } from '../../services/channelService';
import { 
  getChannelNotificationPreferences, 
  setChannelNotificationPreferences, 
  toggleChannelMute, 
  unmuteChannel 
} from '../../services/chatNotificationPreferenceService';
import type { Channel, ChatNotificationPreferences } from '../../types/chat';
import { DEFAULT_CHAT_NOTIFICATION_PREFERENCES } from '../../types/chat';
import { 
  Bell, 
  BellOff, 
  ArrowLeft, 
  AtSign, 
  CornerDownRight, 
  Heart, 
  Clock, 
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

export const ChatNotificationSettings: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialChannelId = searchParams.get('channelId') || 'general';

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>(initialChannelId);
  const [prefs, setPrefs] = useState<ChatNotificationPreferences>({
    channelId: initialChannelId,
    ...DEFAULT_CHAT_NOTIFICATION_PREFERENCES,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Load user joined channels
  useEffect(() => {
    if (!currentUser) return;
    getMyChannels(currentUser.uid)
      .then((chList) => setChannels(chList))
      .catch(() => {});
  }, [currentUser]);

  // Load preferences when selected channel changes
  useEffect(() => {
    if (!currentUser || !selectedChannelId) return;

    let isSubscribed = true;
    setLoading(true);

    getChannelNotificationPreferences(currentUser.uid, selectedChannelId)
      .then((p) => {
        if (isSubscribed) setPrefs(p);
      })
      .catch(() => {
        if (isSubscribed) {
          setPrefs({
            channelId: selectedChannelId,
            ...DEFAULT_CHAT_NOTIFICATION_PREFERENCES,
          });
        }
      })
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [currentUser, selectedChannelId]);

  const handleToggleMute = async (hours?: number) => {
    if (!currentUser || !selectedChannelId || saving) return;
    setSaving(true);

    try {
      if (prefs.muted && hours === undefined) {
        await unmuteChannel(currentUser.uid, selectedChannelId);
        setPrefs((prev) => ({ ...prev, muted: false, muteUntil: undefined }));
        toast.success(`Unmuted #${selectedChannelId}`);
      } else {
        await toggleChannelMute(currentUser.uid, selectedChannelId, hours);
        const updated = await getChannelNotificationPreferences(currentUser.uid, selectedChannelId);
        setPrefs(updated);
        toast.success(`Muted #${selectedChannelId}${hours ? ` for ${hours}h` : ' until unmuted'}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update mute state.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePref = async (key: 'notifyMentions' | 'notifyReplies' | 'notifyReactions') => {
    if (!currentUser || !selectedChannelId || saving) return;
    const newValue = !prefs[key];

    // Optimistic UI update
    setPrefs((prev) => ({ ...prev, [key]: newValue }));

    try {
      await setChannelNotificationPreferences(currentUser.uid, selectedChannelId, {
        [key]: newValue,
      });
      toast.success('Preferences updated.');
    } catch (err: any) {
      setPrefs((prev) => ({ ...prev, [key]: !newValue })); // Rollback
      toast.error('Failed to update preference.');
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
              <span>Chat Notification Settings</span>
            </h1>
            <p className="text-[11px] text-slate-400">Configure channel alert policies & mute durations</p>
          </div>
        </div>
      </header>

      {/* Main Settings Body */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Channel Selector */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
          <label className="text-xs font-bold text-slate-300 block">Select Channel</label>
          <select
            value={selectedChannelId}
            onChange={(e) => setSelectedChannelId(e.target.value)}
            className="w-full p-3 bg-slate-950 border border-slate-800 focus:border-sky-500/50 rounded-2xl text-xs font-semibold text-white focus:outline-none transition-all"
          >
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                #{ch.name || ch.id} ({ch.category || 'channel'})
              </option>
            ))}
            {!channels.some((c) => c.id === 'general') && (
              <option value="general">#general (General Campus Chat)</option>
            )}
          </select>
        </div>

        {loading ? (
          <div className="p-8 bg-slate-900/40 border border-slate-800/80 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading channel preferences...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mute Section */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                    prefs.muted 
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  }`}>
                    {prefs.muted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      {prefs.muted ? 'Notifications Muted' : 'Notifications Active'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {prefs.muted 
                        ? 'Popups suppressed. Unread count badges remain active.' 
                        : 'Alerts delivered for mentions and replies.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleMute(undefined)}
                  disabled={saving}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                    prefs.muted
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {prefs.muted ? 'Unmute' : 'Mute Channel'}
                </button>
              </div>

              {/* Mute Durations */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>Temporary Mute Options</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: '1 Hour', hours: 1 },
                    { label: '8 Hours', hours: 8 },
                    { label: '24 Hours', hours: 24 },
                    { label: 'Indefinite', hours: undefined },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => handleToggleMute(opt.hours)}
                      disabled={saving}
                      className="p-2.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-all text-center"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Granular Policy Toggles */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
              <h3 className="font-bold text-white text-sm">Notification Delivery Policies</h3>

              {/* Mentions Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                    <AtSign className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">@Mentions</span>
                    <span className="text-[10px] text-slate-400 block">Notify when user is mentioned directly</span>
                  </div>
                </div>
                <button
                  onClick={() => handleTogglePref('notifyMentions')}
                  disabled={saving}
                  className={`w-11 h-6 rounded-full transition-colors relative p-1 border ${
                    prefs.notifyMentions
                      ? 'bg-purple-600 border-purple-500'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    prefs.notifyMentions ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Replies Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                    <CornerDownRight className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">Direct Replies</span>
                    <span className="text-[10px] text-slate-400 block">Notify when someone replies to your message</span>
                  </div>
                </div>
                <button
                  onClick={() => handleTogglePref('notifyReplies')}
                  disabled={saving}
                  className={`w-11 h-6 rounded-full transition-colors relative p-1 border ${
                    prefs.notifyReplies
                      ? 'bg-sky-600 border-sky-500'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    prefs.notifyReplies ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Reactions Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                    <Heart className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">Emoji Reactions</span>
                    <span className="text-[10px] text-slate-400 block">Notify when someone reacts to your message (Default OFF)</span>
                  </div>
                </div>
                <button
                  onClick={() => handleTogglePref('notifyReactions')}
                  disabled={saving}
                  className={`w-11 h-6 rounded-full transition-colors relative p-1 border ${
                    prefs.notifyReactions
                      ? 'bg-rose-600 border-rose-500'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    prefs.notifyReactions ? 'translate-x-5' : 'translate-x-0'
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
