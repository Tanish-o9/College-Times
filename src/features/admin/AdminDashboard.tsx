import React, { useEffect, useState } from 'react';
import type { Post } from '../../types';
import { 
  getReportedPosts, 
  getPostReportReasons, 
  dismissPostReports, 
  deletePost, 
  createBroadcastPost,
  type CreateBroadcastPayload
} from '../../services/postService';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { 
  getReportedChatMessages, 
  dismissChatMessageReports, 
  softDeleteChatMessage, 
  muteChannelUser, 
  unmuteChannelUser, 
  type ReportedChatMessageItem 
} from '../../services/chatModerationService';
import { 
  getChatFeatureFlag, 
  updateChatRolloutFlag, 
  type ChatFeatureFlag 
} from '../../services/featureFlagService';
import { AlertHistory } from './AlertHistory';
import { AlertAdminDetail } from './AlertAdminDetail';
import { 
  Shield, 
  AlertOctagon, 
  Radio, 
  Users as UsersIcon, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  Send, 
  AlertTriangle, 
  UserCheck,
  MessageSquare,
  VolumeX,
  Volume2,
  Sliders,
  Power,
  Bell
} from 'lucide-react';

type AdminTab = 'reported' | 'chat-reported' | 'broadcast' | 'users' | 'rollout' | 'campus-alerts';

export const AdminDashboard: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('reported');
  const [selectedAlertPostId, setSelectedAlertPostId] = useState<string | null>(null);

  // Chat Rollout State
  const [chatFlag, setChatFlag] = useState<ChatFeatureFlag>({ enabled: true, rolloutPercentage: 100 });
  const [loadingFlag, setLoadingFlag] = useState<boolean>(false);
  const [selectedPercentage, setSelectedPercentage] = useState<number>(100);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [pendingPercentage, setPendingPercentage] = useState<number | null>(null);
  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null);

  // Reported Posts State
  const [reportedPosts, setReportedPosts] = useState<Post[]>([]);
  const [reportReasonsMap, setReportReasonsMap] = useState<Record<string, string[]>>({});
  const [loadingReported, setLoadingReported] = useState<boolean>(true);

  // Reported Chat Messages State
  const [reportedChatItems, setReportedChatItems] = useState<ReportedChatMessageItem[]>([]);
  const [loadingChatReported, setLoadingChatReported] = useState<boolean>(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Broadcast Form State
  const [bTitle, setBTitle] = useState('');
  const [bContent, setBContent] = useState('');
  const [bImageUrl, setBImageUrl] = useState('');
  const [submittingBroadcast, setSubmittingBroadcast] = useState(false);

  const fetchReported = async () => {
    setLoadingReported(true);
    try {
      const posts = await getReportedPosts();
      setReportedPosts(posts);

      // Fetch report reasons for each reported post
      const map: Record<string, string[]> = {};
      for (const p of posts) {
        if (p.id) {
          const reasons = await getPostReportReasons(p.id);
          map[p.id] = reasons;
        }
      }
      setReportReasonsMap(map);
    } catch (err: any) {
      console.error('Failed to load reported posts:', err);
      toast.error('Failed to load reported posts.');
    } finally {
      setLoadingReported(false);
    }
  };

  const fetchReportedChat = async () => {
    setLoadingChatReported(true);
    try {
      const items = await getReportedChatMessages();
      setReportedChatItems(items);
    } catch (err: any) {
      toast.error('Failed to load reported chat messages.');
    } finally {
      setLoadingChatReported(false);
    }
  };

  const fetchChatFlag = async () => {
    setLoadingFlag(true);
    try {
      const flag = await getChatFeatureFlag();
      setChatFlag(flag);
      setSelectedPercentage(flag.rolloutPercentage);
    } catch (err: any) {
      toast.error('Failed to load chat rollout flag.');
    } finally {
      setLoadingFlag(false);
    }
  };

  const handleSaveRollout = async (percentage: number, enabled: boolean) => {
    if (!currentUser) return;
    setProcessingId('saving-flag');
    try {
      await updateChatRolloutFlag(percentage, enabled, currentUser.uid);
      setChatFlag({ enabled, rolloutPercentage: percentage, updatedAt: Date.now() });
      setSelectedPercentage(percentage);
      toast.success(
        percentage === 0 || !enabled
          ? 'KILL SWITCH ACTIVATED: Community Chat disabled for non-admins.'
          : `Chat rollout percentage updated to ${percentage}%!`
      );
      setConfirmModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update rollout percentage.');
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'reported') {
      fetchReported();
    } else if (activeTab === 'chat-reported') {
      fetchReportedChat();
    } else if (activeTab === 'rollout') {
      fetchChatFlag();
    }
  }, [activeTab]);

  const handleDismiss = async (postId: string) => {
    if (processingId) return;
    setProcessingId(postId);
    try {
      await dismissPostReports(postId);
      toast.success('Reports dismissed & report count reset!');
      setReportedPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to dismiss reports.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (postId: string) => {
    if (processingId) return;
    setProcessingId(postId);
    try {
      await deletePost(postId);
      toast.success('Post and related sub-collections deleted!');
      setReportedPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete post.');
    } finally {
      setProcessingId(null);
    }
  };

  // Chat Moderation Handlers
  const handleDismissChatReport = async (channelId: string, messageId: string) => {
    if (processingId) return;
    setProcessingId(messageId);
    try {
      await dismissChatMessageReports(channelId, messageId);
      toast.success('Chat reports dismissed.');
      setReportedChatItems((prev) => prev.filter((item) => item.message.id !== messageId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to dismiss chat report.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteChatMessage = async (channelId: string, messageId: string) => {
    if (processingId) return;
    setProcessingId(messageId);
    try {
      await softDeleteChatMessage(channelId, messageId);
      toast.success('Chat message soft deleted.');
      setReportedChatItems((prev) => prev.filter((item) => item.message.id !== messageId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete chat message.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMuteUser = async (channelId: string, targetUid: string) => {
    if (!currentUser || processingId) return;
    setProcessingId(targetUid);
    try {
      await muteChannelUser(channelId, targetUid, currentUser.uid);
      toast.success(`User muted in #${channelId}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to mute user.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnmuteUser = async (channelId: string, targetUid: string) => {
    if (processingId) return;
    setProcessingId(targetUid);
    try {
      await unmuteChannelUser(channelId, targetUid);
      toast.success(`User unmuted in #${channelId}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to unmute user.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bTitle.trim() || !bContent.trim() || !currentUser || submittingBroadcast) return;

    setSubmittingBroadcast(true);
    try {
      const payload: CreateBroadcastPayload = {
        title: bTitle.trim(),
        content: bContent.trim(),
        ...(bImageUrl.trim() ? { imageUrl: bImageUrl.trim() } : {}),
      };

      await createBroadcastPost(payload, currentUser, userProfile);
      toast.success('Official Broadcast Post Published to Feed!', { id: 'b-toast' });
      setBTitle('');
      setBContent('');
      setBImageUrl('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish broadcast.');
    } finally {
      setSubmittingBroadcast(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">AKGEC Admin Portal</h1>
          </div>
          <p className="text-xs text-slate-400">
            Moderate flagged feed & chat content, publish announcements, and manage campus access.
          </p>
        </div>

        <div className="px-3.5 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-300 font-mono text-xs font-bold shrink-0 flex items-center gap-1.5">
          <UserCheck className="w-4 h-4 text-purple-400" />
          <span>Role: Admin ({userProfile?.displayName || 'Admin'})</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setActiveTab('reported')}
          className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'reported'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-md shadow-rose-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertOctagon className="w-4 h-4 text-rose-400" />
          <span>REPORTED POSTS</span>
          {reportedPosts.length > 0 && (
            <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-mono">
              {reportedPosts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('chat-reported')}
          className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'chat-reported'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-md shadow-amber-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-amber-400" />
          <span>CHAT MODERATION</span>
          {reportedChatItems.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-mono">
              {reportedChatItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('broadcast')}
          className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'broadcast'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-md shadow-purple-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4 text-purple-400" />
          <span>BROADCAST NEWS</span>
        </button>

        <button
          onClick={() => setActiveTab('rollout')}
          className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'rollout'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-md shadow-sky-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4 text-sky-400" />
          <span>CHAT ROLLOUT</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            chatFlag.enabled && chatFlag.rolloutPercentage > 0
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
          }`}>
            {chatFlag.enabled ? `${chatFlag.rolloutPercentage}%` : 'OFF'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('campus-alerts')}
          className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'campus-alerts'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-md shadow-sky-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bell className="w-4 h-4 text-sky-400" />
          <span>CAMPUS ALERTS</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'users'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-md shadow-sky-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UsersIcon className="w-4 h-4 text-sky-400" />
          <span>USERS MANAGEMENT</span>
        </button>
      </div>

      {/* Tab 1: Reported Posts Moderation */}
      {activeTab === 'reported' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Flagged Posts Needing Review ({reportedPosts.length})
            </h2>
            <button
              onClick={fetchReported}
              className="p-1.5 bg-slate-900 text-slate-400 hover:text-white rounded-xl border border-slate-800 text-xs flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingReported ? 'animate-spin text-rose-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loadingReported ? (
            <div className="p-12 text-center text-slate-400 text-xs font-semibold space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-400 mx-auto" />
              <p>Scanning Firestore for reported posts...</p>
            </div>
          ) : reportedPosts.length === 0 ? (
            <div className="p-12 bg-slate-900/60 border border-slate-800 rounded-3xl text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">No Flagged Posts</h3>
              <p className="text-xs text-slate-400">
                All campus feed posts are clean. No posts have active reports.
              </p>
            </div>
          ) : (
            reportedPosts.map((post) => {
              const reasons = post.id ? reportReasonsMap[post.id] || [] : [];
              const isProcessing = processingId === post.id;

              return (
                <div
                  key={post.id}
                  className="bg-slate-900/80 border border-slate-800 hover:border-rose-500/30 rounded-3xl p-6 space-y-4 shadow-xl relative overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full text-xs font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{post.reportCount} Reports Flagged</span>
                      </span>
                      <span className="text-xs text-slate-400 font-medium">Author: {post.authorName}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white">{post.title}</h3>
                    <p className="text-slate-300 text-xs mt-1 line-clamp-3">{post.content}</p>
                  </div>

                  {/* Report Reasons List */}
                  {reasons.length > 0 && (
                    <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                        Report Reasons Submitted by Students:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {reasons.map((r, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-[11px] font-medium"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Moderation Action Buttons */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                    <button
                      onClick={() => post.id && handleDismiss(post.id)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Dismiss Reports</span>
                    </button>

                    <button
                      onClick={() => post.id && handleDelete(post.id)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-500/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Post</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Chat Moderation */}
      {activeTab === 'chat-reported' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Flagged Chat Messages ({reportedChatItems.length})
            </h2>
            <button
              onClick={fetchReportedChat}
              className="p-1.5 bg-slate-900 text-slate-400 hover:text-white rounded-xl border border-slate-800 text-xs flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingChatReported ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loadingChatReported ? (
            <div className="p-12 text-center text-slate-400 text-xs font-semibold space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
              <p>Fetching flagged chat messages...</p>
            </div>
          ) : reportedChatItems.length === 0 ? (
            <div className="p-12 bg-slate-900/60 border border-slate-800 rounded-3xl text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">No Flagged Chat Messages</h3>
              <p className="text-xs text-slate-400">
                All community chat rooms are clean. No messages have pending reports.
              </p>
            </div>
          ) : (
            reportedChatItems.map((item) => {
              const { message, reports } = item;
              const isProcessing = processingId === message.id || processingId === message.senderId;

              return (
                <div
                  key={`${message.channelId}_${message.id}`}
                  className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/30 rounded-3xl p-6 space-y-4 shadow-xl relative overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{reports.length} Reports Flagged</span>
                      </span>
                      <span className="text-xs text-slate-400 font-mono">Channel: #{message.channelId}</span>
                      <span className="text-xs text-slate-400 font-medium">Author: {message.senderName} ({message.senderId})</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-slate-200 text-xs font-mono bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
                      "{message.content || '[Image]'}"
                    </p>
                  </div>

                  {/* Report Reasons List */}
                  {reports.length > 0 && (
                    <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                        Submitted Reasons:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {reports.map((r, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg text-[11px] font-medium"
                          >
                            {r.reason} (Reporter: {r.reporterId})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Moderation Action Buttons */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2 flex-wrap">
                    <button
                      onClick={() => message.id && handleDismissChatReport(message.channelId, message.id)}
                      disabled={isProcessing}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Dismiss Reports</span>
                    </button>

                    <button
                      onClick={() => message.id && handleDeleteChatMessage(message.channelId, message.id)}
                      disabled={isProcessing}
                      className="px-3.5 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-500/20 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Message</span>
                    </button>

                    <button
                      onClick={() => handleMuteUser(message.channelId, message.senderId)}
                      disabled={isProcessing}
                      className="px-3.5 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Mute User</span>
                    </button>

                    <button
                      onClick={() => handleUnmuteUser(message.channelId, message.senderId)}
                      disabled={isProcessing}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Unmute</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Broadcast News Form */}
      {activeTab === 'broadcast' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-purple-500/20 border border-purple-400/30 text-purple-300 flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Publish Official Broadcast Notice</h2>
              <p className="text-xs text-slate-400">
                Official posts carry an "Official" badge and are highlighted on the main campus feed.
              </p>
            </div>
          </div>

          <form onSubmit={handleBroadcastSubmit} className="space-y-4">
            <div>
              <label htmlFor="b-title" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Announcement Title <span className="text-rose-400">*</span>
              </label>
              <input
                id="b-title"
                type="text"
                value={bTitle}
                onChange={(e) => setBTitle(e.target.value)}
                placeholder="e.g., Important Notice: Mid-Term Examination Schedule Released"
                required
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 focus:border-purple-500 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="b-content" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Announcement Content <span className="text-rose-400">*</span>
              </label>
              <textarea
                id="b-content"
                rows={4}
                value={bContent}
                onChange={(e) => setBContent(e.target.value)}
                placeholder="Provide full official update details for the student body..."
                required
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 focus:border-purple-500 rounded-xl text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="b-image" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Image Banner URL <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                id="b-image"
                type="url"
                value={bImageUrl}
                onChange={(e) => setBImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-purple-500 rounded-xl text-white text-xs font-mono"
              />
            </div>

            <div className="pt-3 flex items-center justify-end">
              <button
                type="submit"
                disabled={submittingBroadcast || !bTitle.trim() || !bContent.trim()}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all"
              >
                {submittingBroadcast ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Publish Official Broadcast</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Users Placeholder Table */}
      {activeTab === 'users' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <UsersIcon className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-bold text-white">Campus User Registry Overview</h2>
            </div>
            <span className="px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full text-xs font-semibold">
              Phase 23 Overview
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="p-3 rounded-l-xl">User Name</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Gamification Points</th>
                  <th className="p-3 rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr>
                  <td className="p-3 font-semibold text-white">System Admin ({userProfile?.displayName || 'Admin'})</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded font-bold">Admin</span></td>
                  <td className="p-3 font-mono font-bold text-amber-400">{userProfile?.points ?? 0} pts</td>
                  <td className="p-3"><span className="text-emerald-400 font-semibold">Active Session</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-slate-300">Student Users Directory</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded">Student</span></td>
                  <td className="p-3 font-mono text-slate-400">Dynamic</td>
                  <td className="p-3"><span className="text-slate-500 italic">Full User Management Module Coming Soon</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Chat Staged Rollout & Kill Switch Control */}
      {activeTab === 'rollout' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Community Chat Staged Rollout & Kill Switch</h2>
                <p className="text-xs text-slate-400">Control Chat access percentage deterministically without redeploying</p>
              </div>
            </div>

            <button
              onClick={fetchChatFlag}
              disabled={loadingFlag}
              className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all text-xs"
              title="Refresh Feature Flag"
            >
              <RefreshCw className={`w-4 h-4 ${loadingFlag ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Current Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Current Status</span>
              <div className="flex items-center gap-2">
                <Power className={`w-5 h-5 ${chatFlag.enabled && chatFlag.rolloutPercentage > 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
                <span className="text-lg font-black text-white">
                  {chatFlag.enabled && chatFlag.rolloutPercentage > 0 ? 'ACTIVE ROLLOUT' : 'DISABLED (KILL SWITCH)'}
                </span>
              </div>
            </div>

            <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Rollout Percentage</span>
              <div className="text-2xl font-black font-mono text-sky-400">
                {chatFlag.rolloutPercentage}%
              </div>
            </div>

            <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Last Modified By</span>
              <p className="text-xs font-mono text-slate-300 truncate">
                {chatFlag.updatedBy || 'System Admin'}
              </p>
            </div>
          </div>

          {/* Kill Switch Banner & Action */}
          <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
                <span>Emergency Kill Switch</span>
              </div>
              <p className="text-xs text-slate-400 max-w-xl">
                Immediately sets rollout percentage to 0% and disables Community Chat for all non-admin students across the app without redeploying the frontend bundle.
              </p>
            </div>

            <button
              onClick={() => {
                setPendingPercentage(0);
                setPendingEnabled(false);
                setConfirmModalOpen(true);
              }}
              className="px-5 py-2.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/20 shrink-0 flex items-center gap-2 transition-all"
            >
              <Power className="w-4 h-4" />
              <span>TRIGGER KILL SWITCH (0%)</span>
            </button>
          </div>

          {/* Preset Staged Rollout Selection */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Select Staged Rollout Target
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: '0% (Kill Switch)', value: 0 },
                { label: '5% (Stage 1)', value: 5 },
                { label: '25% (Stage 2)', value: 25 },
                { label: '60% (Stage 3)', value: 60 },
                { label: '100% (Full Launch)', value: 100 },
              ].map((stage) => (
                <button
                  key={stage.value}
                  type="button"
                  onClick={() => setSelectedPercentage(stage.value)}
                  className={`p-4 rounded-2xl border text-center transition-all ${
                    selectedPercentage === stage.value
                      ? 'bg-sky-500/20 border-sky-500 text-white font-black shadow-lg shadow-sky-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="text-xl font-bold font-mono">{stage.value}%</div>
                  <div className="text-[10px] mt-1 truncate">{stage.label}</div>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 pt-2">
              <div className="flex-1 max-w-xs">
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Custom Rollout Percentage (0-100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={selectedPercentage}
                  onChange={(e) => setSelectedPercentage(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setPendingPercentage(selectedPercentage);
                  setPendingEnabled(selectedPercentage > 0);
                  setConfirmModalOpen(true);
                }}
                className="mt-5 px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center gap-2"
              >
                <Sliders className="w-4 h-4" />
                <span>Save Rollout Setting</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campus Alerts Tab Content */}
      {activeTab === 'campus-alerts' && (
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <AlertHistory onSelectAlert={(pId) => setSelectedAlertPostId(pId)} />
          {selectedAlertPostId && (
            <AlertAdminDetail postId={selectedAlertPostId} onClose={() => setSelectedAlertPostId(null)} />
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && pendingPercentage !== null && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-white">Confirm Chat Rollout Change</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to change Community Chat rollout from{' '}
                <span className="font-bold text-sky-400">{chatFlag.rolloutPercentage}%</span> to{' '}
                <span className="font-bold text-amber-400">{pendingPercentage}%</span>?
              </p>
              {pendingPercentage === 0 && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold rounded-xl mt-2">
                  ⚠️ This acts as an emergency Kill Switch and disables Chat for all regular students.
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveRollout(pendingPercentage, pendingEnabled ?? true)}
                disabled={processingId === 'saving-flag'}
                className="flex-1 py-3 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-sky-500/20"
              >
                Confirm & Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
