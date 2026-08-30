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
    <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 py-6 relative overflow-hidden">
      {/* Ambient Gradient Aura */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-80 bg-gradient-to-r from-sky-500/20 via-purple-500/20 to-pink-500/20 blur-3xl opacity-80 pointer-events-none rounded-full animate-gradient-x animate-float-slow" />

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500/20 via-purple-500/20 to-pink-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/10">
            <MessageSquare className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <span className="bg-gradient-to-r from-sky-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                Campus Community Channels
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">10,000-Member Scalable Realtime Chat Network</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2.5 bg-slate-950 hover:bg-slate-900 text-sky-400 hover:text-white rounded-xl border border-slate-800 transition-all text-xs flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            title="Search Messages"
            aria-label="Search Messages"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline font-bold">Search Chat</span>
          </button>
          <button
            onClick={loadData}
            className="p-2.5 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all text-xs shadow-md active:scale-95 cursor-pointer"
            title="Refresh Channels"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SECTION 1: My Channels */}
      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>My Joined Channels ({myChannels.length})</span>
          </h3>
        </div>

        {myChannels.length === 0 ? (
          <div className="p-8 bg-slate-900/90 border-2 border-slate-800 rounded-3xl text-center space-y-3 shadow-2xl">
            <Sparkles className="w-8 h-8 text-sky-400 mx-auto animate-bounce" />
            <p className="text-sm text-slate-200 font-bold">No channels joined yet</p>
            <p className="text-xs text-slate-400">Discover public channels below to start chatting with campus!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                  className={`p-5 rounded-3xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between gap-4 group relative overflow-hidden shadow-2xl hover:-translate-y-1 ${
                    isSelected
                      ? 'bg-gradient-to-r from-sky-500/20 via-purple-500/10 to-transparent border-sky-400/60 shadow-sky-500/25 scale-[1.02]'
                      : 'bg-slate-900/90 border-slate-800 hover:border-sky-500/50 hover:shadow-sky-500/20'
                  }`}
                >
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-400 via-purple-500 to-pink-500 opacity-70 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 ${
                      isAnnouncement
                        ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300 shadow-md shadow-purple-500/20'
                        : 'bg-sky-500/20 border border-sky-500/40 text-sky-300 shadow-md shadow-sky-500/20'
                    }`}>
                      {isAnnouncement ? <Shield className="w-5.5 h-5.5 animate-pulse" /> : <Hash className="w-5.5 h-5.5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-base truncate group-hover:text-sky-300 transition-colors">{channel.name}</span>
                        {hasUnread && (
                          <span 
                            aria-label={unreadCount > 0 ? `${unreadCount} unread messages` : 'Unread messages'}
                            className="px-2 py-0.5 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 text-white font-mono text-[10px] font-bold shadow-md shadow-sky-500/40 animate-bounce shrink-0"
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
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">{channel.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-1">
                    <span className="text-[11px] font-mono text-slate-400 font-bold flex items-center gap-1.5 bg-slate-950 px-3 py-1 rounded-xl border border-slate-850">
                      <Users className="w-3.5 h-3.5 text-sky-400" />
                      {channel.memberCount ?? 0} Members
                    </span>

                    {/* Leave or Permanent Badge */}
                    {isAnnouncement && userProfile?.role !== 'admin' ? (
                      <span className="px-3 py-1 bg-purple-500/15 border border-purple-500/30 text-purple-300 rounded-xl text-[10px] font-extrabold flex items-center gap-1 shadow-sm">
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
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-slate-800 hover:border-rose-500/30 transition-all text-xs flex items-center gap-1 cursor-pointer"
                        title="Leave channel"
                      >
                        {actionChannelId === channel.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                        ) : (
                          <LogOut className="w-3.5 h-3.5" />
                        )}
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
      <div className="space-y-4 pt-6 border-t-2 border-slate-800/80 relative z-10">
        <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
          <Compass className="w-4 h-4 text-sky-400 animate-spin-slow" />
          <span>Discover Public Channels</span>
        </h3>

        {discoverChannels.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6 italic bg-slate-900/60 rounded-3xl border border-slate-800">You have joined all public channels!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {discoverChannels.map((channel) => (
              <div
                key={channel.id}
                className="p-5 bg-slate-900/90 border-2 border-slate-800 rounded-3xl flex flex-col justify-between gap-4 hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-1 transition-all duration-300 group shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-400 via-pink-500 to-sky-400 opacity-70 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-md">
                    <Hash className="w-5.5 h-5.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-white text-base truncate group-hover:text-purple-300 transition-colors">{channel.name}</span>
                      <span className="px-2.5 py-0.5 bg-slate-950 text-purple-400 border border-purple-500/30 text-[9px] rounded-full font-extrabold uppercase tracking-wider font-mono">
                        {channel.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">{channel.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-1">
                  <span className="text-[11px] font-mono text-slate-400 font-bold flex items-center gap-1.5 bg-slate-950 px-3 py-1 rounded-xl border border-slate-850">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    {channel.memberCount ?? 0} Members
                  </span>

                  <button
                    onClick={() => channel.id && handleJoin(channel.id)}
                    disabled={actionChannelId === channel.id}
                    className="px-4 py-2 bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-600 hover:from-sky-300 hover:to-purple-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-sky-500/25 hover:scale-105 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
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
