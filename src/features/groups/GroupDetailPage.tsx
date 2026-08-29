import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { BackButton } from '../../components/BackButton';
import {
  getGroupById,
  isGroupMember,
  joinGroup,
  leaveGroup,
} from '../../services/groupService';
import type { CampusGroup, GroupRole } from '../../types/group';
import type { Post } from '../../types/models';
import { PollCard } from './PollCard';
import { CreatePollModal } from './CreatePollModal';
import { JoinGroupByCodeModal } from './JoinGroupByCodeModal';
import { JoinGroupWithPasswordModal } from './JoinGroupWithPasswordModal';
import { GroupInstantCarousel } from './GroupInstantCarousel';
import { GroupMomentsTab } from './GroupMomentsTab';
import { GroupHomeDashboard } from './GroupHomeDashboard';
import { GroupAnnouncements } from './GroupAnnouncements';
import { GroupMembersExplorer } from './GroupMembersExplorer';
import { GroupLeaderboard } from './GroupLeaderboard';
import { GroupSearchTab } from './GroupSearchTab';
import { GroupActivityTimeline } from './GroupActivityTimeline';
import { RealtimeGroupActivity } from './RealtimeGroupActivity';
import { GroupPosts } from './GroupPosts';
import { GroupEvents } from './GroupEvents';
import { GroupResources } from './GroupResources';
import { GroupTasks } from './GroupTasks';
import { GroupFiles } from './GroupFiles';
import { GroupAnalyticsDashboard } from './GroupAnalyticsDashboard';
import { GroupProjects } from './GroupProjects';
import {
  FolderKanban,
  Users,
  Building2,
  GraduationCap,
  Sparkles,
  Check,
  Plus,
  RefreshCw,
  MessageSquare,
  BarChart3,
  Lock,
  Key,
  Home,
  Megaphone,
  TrendingUp,
  Trophy,
  Search,
  Settings,
  ShieldAlert,
  Calendar,
  FileText,
  BookOpen,
  ListTodo,
  FolderOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export type GroupTab =
  | 'overview'
  | 'posts'
  | 'moments'
  | 'polls'
  | 'events'
  | 'announcements'
  | 'activity'
  | 'members'
  | 'leaderboard'
  | 'search'
  | 'invites'
  | 'resources'
  | 'tasks'
  | 'files'
  | 'projects'
  | 'analytics'
  | 'chat';

export const GroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<CampusGroup | null>(null);
  const [isMember, setIsMember] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<GroupRole>('member');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionBusy, setActionBusy] = useState<boolean>(false);
  const [ownerName, setOwnerName] = useState<string>('Campus Peer');

  // Tab State
  const initialTab = (searchParams.get('tab') as GroupTab) || 'overview';
  const [activeTab, setActiveTab] = useState<GroupTab>(initialTab);

  const [groupPolls, setGroupPolls] = useState<Post[]>([]);
  const [loadingPolls, setLoadingPolls] = useState<boolean>(false);
  const [isPollModalOpen, setIsPollModalOpen] = useState<boolean>(false);
  const [isJoinCodeModalOpen, setIsJoinCodeModalOpen] = useState<boolean>(false);
  const [isJoinPasswordModalOpen, setIsJoinPasswordModalOpen] = useState<boolean>(false);
  const [groupHealth, setGroupHealth] = useState<{ score: number; status: string; color: string } | null>(null);

  const loadGroupDetails = async () => {
    if (!groupId || !currentUser) return;
    setLoading(true);
    try {
      const [g, memberStatus] = await Promise.all([
        getGroupById(groupId),
        isGroupMember(groupId, currentUser.uid),
      ]);

      setGroup(g);
      setIsMember(memberStatus);

      if (g) {
        if (g.createdBy) {
          getDoc(doc(db, 'users', g.createdBy)).then((userSnap) => {
            if (userSnap.exists()) {
              setOwnerName(userSnap.data().displayName || 'Campus Peer');
            }
          }).catch((err) => console.warn('Failed to fetch group owner name:', err));
        }

        // Compute Group Health
        const postsRef = collection(db, 'posts');
        const postsSnap = await getDocs(query(postsRef, where('groupId', '==', groupId), limit(50)));
        const postCount = postsSnap.size;

        // Base: 100
        let score = 100;
        if (g.memberCount < 5) {
          score -= (5 - g.memberCount) * 10;
        }
        if (postCount < 3) {
          score -= 30;
        } else if (postCount === 0) {
          score -= 50;
        }

        score = Math.max(0, Math.min(100, score));
        let status = 'Excellent';
        let color = 'text-emerald-450 bg-emerald-500/10 border-emerald-500/25';
        if (score < 50) {
          status = 'Critical / Inactive';
          color = 'text-rose-455 bg-rose-500/10 border-rose-500/25';
        } else if (score < 80) {
          status = 'Average / At Risk';
          color = 'text-amber-455 bg-amber-500/10 border-amber-500/25';
        }

        setGroupHealth({ score, status, color });
      }

      // Fetch user role
      const snap = await getDoc(doc(db, 'groups', groupId, 'members', currentUser.uid));
      if (snap.exists()) {
        setUserRole(snap.data().role || 'member');
      }
    } catch (err) {
      toast.error('Failed to load group details.');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupPolls = async () => {
    if (!groupId || !isMember) return;
    setLoadingPolls(true);
    try {
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef,
        where('groupId', '==', groupId),
        where('status', '==', 'active'),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      const polls = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Post) }))
        .filter((p) => p.poll);
      setGroupPolls(polls);
    } catch (err) {
      console.error('Failed to load group polls:', err);
    } finally {
      setLoadingPolls(false);
    }
  };

  useEffect(() => {
    loadGroupDetails();
  }, [groupId, currentUser]);

  useEffect(() => {
    if (activeTab === 'polls' && isMember) {
      loadGroupPolls();
    }
  }, [activeTab, groupId, isMember]);

  const handleTabChange = (tab: GroupTab) => {
    if (tab === 'chat') {
      navigate(`/chat/group-${groupId}`);
      return;
    }
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const handleToggleMembership = async () => {
    if (!group || !currentUser || actionBusy) return;

    if ((group.visibility === 'private' || group.hasPassword) && !isMember) {
      setIsJoinPasswordModalOpen(true);
      return;
    }

    setActionBusy(true);

    try {
      if (isMember) {
        await leaveGroup(group.id, currentUser.uid);
        setIsMember(false);
        setGroup((prev) => (prev ? { ...prev, memberCount: Math.max(0, prev.memberCount - 1) } : null));
        toast.success(`Left ${group.name}`);
      } else {
        await joinGroup(group.id, currentUser, userProfile);
        setIsMember(true);
        setGroup((prev) => (prev ? { ...prev, memberCount: prev.memberCount + 1 } : null));
        toast.success(`Joined ${group.name}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const isOwner = Boolean(currentUser && (group?.createdBy === currentUser.uid || (group as any)?.ownerId === currentUser.uid));
  const isAuthorized = isMember || isOwner || userProfile?.role === 'admin';
  const isPrivateAndNonMember = Boolean(group && (group.visibility === 'private' || group.hasPassword) && !isAuthorized);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <BackButton customFallback="/groups" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white truncate">
              {group?.name || 'Group Details'}
            </h1>
            <p className="text-[11px] text-slate-400 font-mono uppercase">
              {group?.type || 'Group'} • {group?.visibility || 'public'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Group Moderation & Settings Triggers for Admin/Owner */}
          {isAuthorized && (userRole === 'owner' || userRole === 'admin' || userRole === 'moderator' || isOwner) && (
            <button
              onClick={() => navigate(`/groups/${groupId}/moderation`)}
              className="p-2 text-rose-400 hover:bg-slate-900 border border-slate-800 rounded-xl"
              title="Moderation Hub"
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
          )}

          {isAuthorized && (userRole === 'owner' || userRole === 'admin' || isOwner) && (
            <button
              onClick={() => navigate(`/groups/${groupId}/settings`)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 rounded-xl"
              title="Group Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Quick Group Chat Channel Navigation */}
          {isAuthorized && (
            <button
              onClick={() => navigate(`/chat/group-${groupId}`)}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0"
              title="Open Group Chat"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Group Chat</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading group metadata...</span>
          </div>
        ) : !group ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-3">
            <p className="text-slate-400 text-xs">Group not found or no longer available.</p>
            <button
              onClick={() => navigate('/groups')}
              className="px-4 py-2 bg-sky-500 text-slate-950 font-bold text-xs rounded-xl"
            >
              Back to Groups
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Group Banner & Header Card */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{group.name}</h2>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    Group Pass Code ID: <span className="text-sky-300 font-bold">{isAuthorized ? (group.inviteCodePlaintext || 'CT-PUBLIC') : '••••••••'}</span> • Created by <span className="text-indigo-300 font-semibold">{ownerName}</span>
                  </p>
                </div>

                <button
                  onClick={handleToggleMembership}
                  disabled={actionBusy || isOwner}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 ${
                    isOwner
                      ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 cursor-default'
                      : isMember
                      ? 'bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700'
                      : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950'
                  }`}
                >
                  {actionBusy ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : isOwner ? (
                    <>
                      <ShieldAlert className="w-4 h-4 text-indigo-400" />
                      <span>Owner (Admin)</span>
                    </>
                  ) : isMember ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Joined (Member)</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>{group.hasPassword || group.visibility === 'private' ? 'Enter Pass Code' : 'Join Group'}</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                {group.description || 'Official campus community group for College Times.'}
              </p>

              <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>{group.memberCount} Members</span>
                </div>
                {group.category && (
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>{group.category}</span>
                  </div>
                )}
                {group.batchYear && (
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-amber-400" />
                    <span>Batch {group.batchYear}</span>
                  </div>
                )}
                {group.departmentId && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    <span>Dept {group.departmentId.toUpperCase()}</span>
                  </div>
                )}
                {groupHealth && (
                  <div className={`px-2.5 py-1 rounded-2xl border text-[10px] font-bold flex items-center gap-1.5 ${groupHealth.color}`}>
                    <span>Health Score: {groupHealth.score} ({groupHealth.status})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Group Moments Carousel */}
            {!isPrivateAndNonMember && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
                <GroupInstantCarousel groupId={group.id} groupName={group.name} isMember={isAuthorized} />
              </div>
            )}

            {/* Private Group Non-Member Content Guard */}
            {isPrivateAndNonMember ? (
              <div className="bg-slate-900/80 border border-amber-500/20 rounded-3xl p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Private Campus Group</h3>
                <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                  This group's member roster, discussions, and polls are protected. To view or participate in this private community, enter its CT invite pass code.
                </p>
                <button
                  onClick={() => setIsJoinCodeModalOpen(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg inline-flex items-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  <span>Join with Pass Code</span>
                </button>
              </div>
            ) : (
              <>
                {/* Unified Navigation Tabs Header */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none">
                  <button
                    onClick={() => handleTabChange('overview')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'overview'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Home className="w-4 h-4" />
                    <span>Overview</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('announcements')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'announcements'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Megaphone className="w-4 h-4" />
                    <span>Announcements</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('posts')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'posts'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Posts</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('moments')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'moments'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Moments</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('events')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'events'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Events</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('members')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'members'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Members</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('polls')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'polls'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Polls</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('activity')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'activity'
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>Activity</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('leaderboard')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'leaderboard'
                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Leaderboard</span>
                  </button>

                   <button
                    onClick={() => handleTabChange('resources')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'resources'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Resources</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('tasks')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'tasks'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ListTodo className="w-4 h-4" />
                    <span>Tasks</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('files')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'files'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Files</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('projects')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'projects'
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <FolderKanban className="w-4 h-4" />
                    <span>Projects</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('analytics')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'analytics'
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Analytics</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('search')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'search'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </button>
                </div>

                {/* Tab Views */}
                {activeTab === 'overview' && (
                  <GroupHomeDashboard
                    group={group}
                    userId={currentUser?.uid || ''}
                    onSelectTab={(tab) => handleTabChange(tab as GroupTab)}
                  />
                )}

                {activeTab === 'announcements' && (
                  <GroupAnnouncements groupId={group.id} userRole={userRole} />
                )}

                {activeTab === 'posts' && (
                  <GroupPosts groupId={group.id} isMember={isMember} userRole={userRole} />
                )}

                {activeTab === 'moments' && (
                  <GroupMomentsTab
                    groupId={group.id}
                    groupName={group.name}
                    isMember={isAuthorized}
                    userRole={userRole}
                  />
                )}

                {activeTab === 'members' && (
                  <GroupMembersExplorer groupId={group.id} />
                )}

                {activeTab === 'polls' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-purple-400" />
                        <span>Group Community Polls</span>
                      </h3>

                      {isMember && (
                        <button
                          onClick={() => setIsPollModalOpen(true)}
                          className="px-3.5 py-1.5 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Create Poll</span>
                        </button>
                      )}
                    </div>

                    {loadingPolls ? (
                      <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                        <span>Loading group polls...</span>
                      </div>
                    ) : groupPolls.length === 0 ? (
                      <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
                        No active polls in this group yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {groupPolls.map((pollPost) => (
                          <PollCard key={pollPost.id} postId={pollPost.id || ''} poll={pollPost.poll!} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'events' && (
                  <GroupEvents groupId={group.id} isMember={isMember} userRole={userRole} />
                )}

                {activeTab === 'resources' && (
                  <GroupResources groupId={group.id} isMember={isMember} userRole={userRole} />
                )}

                {activeTab === 'tasks' && (
                  <GroupTasks groupId={group.id} isMember={isMember} />
                )}

                {activeTab === 'files' && (
                  <GroupFiles groupId={group.id} isMember={isMember} />
                )}

                {activeTab === 'projects' && (
                  <GroupProjects groupId={group.id} />
                )}

                {activeTab === 'analytics' && (
                  <GroupAnalyticsDashboard groupId={group.id} />
                )}

                {activeTab === 'leaderboard' && (
                  <GroupLeaderboard groupId={group.id} />
                )}

                {activeTab === 'search' && (
                  <GroupSearchTab groupId={group.id} />
                )}

                {activeTab === 'activity' && (
                  <GroupActivityTimeline groupId={group.id} userId={currentUser?.uid || ''} />
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Bounded Realtime Activity Toast Indicator */}
      {group && isMember && (
        <RealtimeGroupActivity groupId={group.id} />
      )}

      {/* Modals */}
      {group && (
        <CreatePollModal
          isOpen={isPollModalOpen}
          onClose={() => setIsPollModalOpen(false)}
          groupId={group.id}
          onPollCreated={loadGroupPolls}
        />
      )}

      {group && (
        <JoinGroupByCodeModal
          isOpen={isJoinCodeModalOpen}
          onClose={() => setIsJoinCodeModalOpen(false)}
          onJoined={() => {
            setIsJoinCodeModalOpen(false);
            setIsMember(true);
            loadGroupDetails();
          }}
        />
      )}

      {group && (
        <JoinGroupWithPasswordModal
          isOpen={isJoinPasswordModalOpen}
          onClose={() => setIsJoinPasswordModalOpen(false)}
          group={group}
          onJoined={() => {
            setIsJoinPasswordModalOpen(false);
            setIsMember(true);
            loadGroupDetails();
          }}
        />
      )}
    </div>
  );
};
