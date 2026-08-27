import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getGroupById,
  isGroupMember,
  joinGroup,
  leaveGroup,
} from '../../services/groupService';
import type { CampusGroup } from '../../types/group';
import type { Post } from '../../types/models';
import { GroupMembers } from './GroupMembers';
import { PollCard } from './PollCard';
import { CreatePollModal } from './CreatePollModal';
import { GroupInviteManager } from './GroupInviteManager';
import { JoinGroupByCodeModal } from './JoinGroupByCodeModal';
import {
  ArrowLeft,
  Users,
  Building2,
  GraduationCap,
  Globe,
  Sparkles,
  Check,
  Plus,
  RefreshCw,
  ShieldCheck,
  MessageSquare,
  BarChart3,
  Lock,
  Key
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type GroupTab = 'members' | 'polls' | 'invites';

export const GroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<CampusGroup | null>(null);
  const [isMember, setIsMember] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionBusy, setActionBusy] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<GroupTab>('members');
  const [groupPolls, setGroupPolls] = useState<Post[]>([]);
  const [loadingPolls, setLoadingPolls] = useState<boolean>(false);
  const [isPollModalOpen, setIsPollModalOpen] = useState<boolean>(false);
  const [isJoinCodeModalOpen, setIsJoinCodeModalOpen] = useState<boolean>(false);

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

  const handleToggleMembership = async () => {
    if (!group || !currentUser || actionBusy) return;

    if (group.visibility === 'private' && !isMember) {
      setIsJoinCodeModalOpen(true);
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

  const isPrivateAndNonMember = group?.visibility === 'private' && !isMember;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/groups')}
            aria-label="Back to groups"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white truncate">
              {group?.name || 'Group Details'}
            </h1>
            <p className="text-[11px] text-slate-400 font-mono uppercase">
              {group?.type || 'Group'} • {group?.visibility || 'public'}
            </p>
          </div>
        </div>

        {/* Quick Group Chat Channel Navigation */}
        {isMember && (
          <button
            onClick={() => navigate(`/chat?channel=channel-${groupId}`)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0"
            title="Open Group Chat"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Group Chat</span>
          </button>
        )}
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
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-xs font-semibold">Group not found or inactive.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Group Banner & Card */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-3xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                    {group.type === 'department' ? (
                      <Building2 className="w-7 h-7" />
                    ) : group.type === 'batch' ? (
                      <GraduationCap className="w-7 h-7" />
                    ) : group.type === 'campus' ? (
                      <Globe className="w-7 h-7" />
                    ) : (
                      <Sparkles className="w-7 h-7 text-purple-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>{group.name}</span>
                      {group.type === 'campus' && (
                        <span title="Official Group">
                          <ShieldCheck className="w-4 h-4 text-sky-400" />
                        </span>
                      )}
                    </h2>
                    <span className="text-xs text-slate-400 font-mono uppercase flex items-center gap-1.5">
                      <span>{group.type}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-amber-400">
                        {group.visibility === 'private' ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3 text-emerald-400" />}
                        <span>{group.visibility}</span>
                      </span>
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleToggleMembership}
                  disabled={actionBusy}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                    isMember
                      ? 'bg-emerald-500/10 hover:bg-rose-500/20 text-emerald-400 hover:text-rose-400 border border-emerald-500/30 hover:border-rose-500/30'
                      : group.visibility === 'private'
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                  }`}
                >
                  {isMember ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Joined</span>
                    </>
                  ) : group.visibility === 'private' ? (
                    <>
                      <Key className="w-4 h-4" />
                      <span>Enter Pass Code</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Join Group</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                {group.description || 'Official campus community group for AKGEC Times.'}
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
              </div>
            </div>

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
                {/* Tab Navigation */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('members')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        activeTab === 'members'
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Members</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('polls')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        activeTab === 'polls'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span>Group Polls</span>
                    </button>

                    {isMember && (
                      <button
                        onClick={() => setActiveTab('invites')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          activeTab === 'invites'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Key className="w-4 h-4" />
                        <span>Pass Code & Invites</span>
                      </button>
                    )}
                  </div>

                  {activeTab === 'polls' && isMember && (
                    <button
                      onClick={() => setIsPollModalOpen(true)}
                      className="px-3.5 py-1.5 bg-purple-500 hover:bg-purple-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Poll</span>
                    </button>
                  )}
                </div>

                {/* Tab Content */}
                {activeTab === 'members' ? (
                  <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl">
                    <GroupMembers groupId={group.id} isAdmin={userProfile?.role === 'admin'} />
                  </div>
                ) : activeTab === 'invites' ? (
                  <GroupInviteManager
                    group={group}
                    onGroupUpdated={(updated) => setGroup(updated)}
                  />
                ) : (
                  <div className="space-y-4">
                    {loadingPolls ? (
                      <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                        <span>Loading group polls...</span>
                      </div>
                    ) : groupPolls.length === 0 ? (
                      <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-3">
                        <BarChart3 className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="text-slate-400 text-xs font-semibold">No active polls in this group.</p>
                      </div>
                    ) : (
                      groupPolls.map((post) => (
                        <PollCard key={post.id} postId={post.id!} poll={post.poll} />
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {group && (
        <CreatePollModal
          isOpen={isPollModalOpen}
          onClose={() => setIsPollModalOpen(false)}
          groupId={group.id}
          onPollCreated={() => loadGroupPolls()}
        />
      )}

      <JoinGroupByCodeModal
        isOpen={isJoinCodeModalOpen}
        onClose={() => setIsJoinCodeModalOpen(false)}
        initialCode={group?.inviteCodePlaintext || ''}
        onJoined={() => {
          setIsMember(true);
          loadGroupDetails();
        }}
      />
    </div>
  );
};
