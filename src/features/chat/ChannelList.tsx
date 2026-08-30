import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  getPublicChannels, 
  getMyChannels, 
  getMyMemberships, 
  joinChannel, 
  leaveChannel,
  seedStandardCampusChannels
} from '../../services/channelService';
import type { Channel, ChannelMember } from '../../types/chat';
import { Skeleton } from '../../components/Skeleton';
import toast from 'react-hot-toast';
import { 
  Hash, 
  Users, 
  MessageSquare, 
  Plus, 
  LogOut, 
  Shield, 
  BellOff, 
  CheckCircle2, 
  Compass, 
  RefreshCw,
  Sparkles,
  Lock,
  Search
} from 'lucide-react';

import { useChatAccess } from '../../hooks/useChatAccess';
import { useChatUnreadState } from '../../hooks/useChatUnreadState';
import { ChatSearch } from './ChatSearch';

import { getMutedChannels } from '../../services/chatNotificationPreferenceService';

interface ChannelListProps {
  onSelectChannel?: (channel: Channel) => void;
  activeChannelId?: string;
}

export const ChannelList: React.FC<ChannelListProps> = ({
  onSelectChannel,
  activeChannelId,
}) => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const { isEligible, loading: accessLoading } = useChatAccess();

  const [myChannels, setMyChannels] = useState<Channel[]>([]);
  const [discoverChannels, setDiscoverChannels] = useState<Channel[]>([]);
  const [memberships, setMemberships] = useState<Record<string, ChannelMember>>({});
  const [mutedChannels, setMutedChannels] = useState<Set<string>>(new Set());

  const { unreadInfoMap } = useChatUnreadState(myChannels);

  const [loading, setLoading] = useState<boolean>(true);
  const [actionChannelId, setActionChannelId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      await seedStandardCampusChannels(currentUser);

      const [allPublic, userJoined, mutedSet] = await Promise.all([
        getPublicChannels(50),
        getMyChannels(currentUser.uid),
        getMutedChannels(currentUser.uid),
      ]);

      const joinedIds = new Set(userJoined.map((c) => c.id));
      const userMemberships = await getMyMemberships(
        currentUser.uid,
        userJoined.map((c) => c.id!).filter(Boolean)
      );

      setMyChannels(userJoined);
      setDiscoverChannels(allPublic.filter((c) => c.id && !joinedIds.has(c.id)));
      setMemberships(userMemberships);
      setMutedChannels(mutedSet);
    } catch (err: any) {
      console.error('Failed to load channels:', err);
      toast.error('Failed to load community channels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleJoin = async (channelId: string) => {
    if (!currentUser || actionChannelId) return;
    setActionChannelId(channelId);
    toast.loading('Joining channel...', { id: 'join-channel' });

    try {
      await joinChannel(channelId, currentUser.uid);
      toast.success('Joined channel successfully!', { id: 'join-channel' });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to join channel.', { id: 'join-channel' });
    } finally {
      setActionChannelId(null);
    }
  };

  const handleLeave = async (channelId: string) => {
    if (!currentUser || actionChannelId) return;
    setActionChannelId(channelId);
    toast.loading('Leaving channel...', { id: 'leave-channel' });

    try {
      await leaveChannel(channelId, currentUser.uid, userProfile?.role || 'student');
      toast.success('Left channel.', { id: 'leave-channel' });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave channel.', { id: 'leave-channel' });
    } finally {
      setActionChannelId(null);
    }
  };


  if (!accessLoading && !isEligible) {
    return (
      <div className="w-full p-8 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl text-center space-y-4 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Community Chat Unavailable</h2>
        <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
          Community Chat is currently undergoing a staged rollout or temporary maintenance. Check back soon!
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-xl text-xs transition-all"
        >
          Return to Feed
        </button>
      </div>
    );
  }

  if (loading || accessLoading) {
    return (
      <div className="w-full space-y-6 p-4">
        <div className="space-y-3">
          <Skeleton variant="text" className="w-32 h-6" />
          <Skeleton variant="card" className="h-20" />
          <Skeleton variant="card" className="h-20" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Campus Channels</h2>
            <p className="text-xs text-slate-400">10,000-Member Scalable Community Chat</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 bg-slate-950 hover:bg-slate-800 text-sky-400 hover:text-white rounded-xl border border-slate-800 transition-all text-xs flex items-center gap-1.5"
            title="Search Messages"
            aria-label="Search Messages"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline font-semibold">Search</span>
          </button>
          <button
            onClick={loadData}
            className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all text-xs"
            title="Refresh Channels"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SECTION 1: My Channels */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>My Joined Channels ({myChannels.length})</span>
          </h3>
        </div>

        {myChannels.length === 0 ? (
          <div className="p-6 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-center space-y-2">
            <Sparkles className="w-6 h-6 text-sky-400 mx-auto" />
            <p className="text-xs text-slate-300 font-semibold">No channels joined yet</p>
            <p className="text-[11px] text-slate-500">Discover public channels below to start chatting!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {myChannels.map((channel) => {
              const unreadInfo = channel.id ? unreadInfoMap[channel.id] : null;
              const hasUnread = unreadInfo?.hasUnread ?? false;
              const unreadCount = unreadInfo?.count ?? 0;
              const isAnnouncement = channel.id === 'admin-announcements' || channel.type === 'announcement';
              const isSelected = activeChannelId === channel.id;
              const member = channel.id ? memberships[channel.id] : null;

              return (
                <div
                  key={channel.id}
                  onClick={() => {
                    if (onSelectChannel) onSelectChannel(channel);
                    if (channel.id) navigate(`/chat/${channel.id}`);
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-sky-500/10 border-sky-500/30 shadow-lg shadow-sky-500/10'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isAnnouncement
                        ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400'
                        : 'bg-sky-500/10 border border-sky-500/20 text-sky-400'
                    }`}>
                      {isAnnouncement ? <Shield className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm truncate">{channel.name}</span>
                        {hasUnread && (
                          <span 
                            aria-label={unreadCount > 0 ? `${unreadCount} unread messages` : 'Unread messages'}
                            className="px-2 py-0.5 rounded-full bg-sky-500 text-white font-mono text-[10px] font-bold shadow-md shadow-sky-500/40 animate-pulse shrink-0"
                          >
                            {unreadCount > 99 ? '99+' : unreadCount > 0 ? unreadCount : '•'}
                          </span>
                        )}
                        {(member?.muted || (channel.id && mutedChannels.has(channel.id))) && (
                          <span title="Notifications muted">
                            <BellOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{channel.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {channel.memberCount ?? 0}
                    </span>

                    {/* Leave or Permanent Badge */}
                    {isAnnouncement && userProfile?.role !== 'admin' ? (
                      <span className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-lg text-[10px] font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Official</span>
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (channel.id) handleLeave(channel.id);
                        }}
                        disabled={actionChannelId === channel.id}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-transparent hover:border-rose-500/20 transition-colors"
                        title="Leave Channel"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Discover Channels */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-sky-400" />
          <span>Discover Public Channels</span>
        </h3>

        {discoverChannels.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">You have joined all public channels!</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {discoverChannels.map((channel) => (
              <div
                key={channel.id}
                className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center shrink-0">
                    <Hash className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm truncate">{channel.name}</span>
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] rounded font-semibold uppercase">
                        {channel.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{channel.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {channel.memberCount ?? 0}
                  </span>

                  <button
                    onClick={() => channel.id && handleJoin(channel.id)}
                    disabled={actionChannelId === channel.id}
                    className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs rounded-xl shadow-md shadow-sky-500/20 flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Join</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search Modal Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-200">
          <ChatSearch
            onClose={() => setIsSearchOpen(false)}
            onSelectResult={(msg) => {
              setIsSearchOpen(false);
              navigate(`/chat/${msg.channelId}?msgId=${msg.id}`);
            }}
          />
        </div>
      )}
    </div>
  );
};
