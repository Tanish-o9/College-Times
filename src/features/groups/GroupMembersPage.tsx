import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getGroupById, isGroupMember } from '../../services/groupService';
import {
  getGroupJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  updateMemberRole,
  removeMemberFromGroup,
  banMemberFromGroup,
} from '../../services/groupManagementService';
import { canManageMembers } from '../../services/groupPermissionService';
import type { CampusGroup, GroupMember, GroupJoinRequest, GroupRole } from '../../types/group';
import {
  ArrowLeft,
  Users,
  Search,
  Shield,
  ShieldCheck,
  Crown,
  UserCheck,
  UserX,
  Ban,
  Check,
  X,
  RefreshCw,
  MoreVertical,
  UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, query, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type Tab = 'members' | 'requests';

export const GroupMembersPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<CampusGroup | null>(null);
  const [userRole, setUserRole] = useState<GroupRole>('member');
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<Tab>('members');

  // Members state
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Join Requests state
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const loadGroupAndRole = async () => {
    if (!groupId || !currentUser) return;
    setLoading(true);
    try {
      const g = await getGroupById(groupId);
      setGroup(g);

      // Check current user role
      const memberRef = doc(db, 'groups', groupId, 'members', currentUser.uid);
      const snap = await getDoc(memberRef);
      if (snap.exists()) {
        const data = snap.data();
        setUserRole(data.role || 'member');
      }
    } catch (err) {
      toast.error('Failed to load group details.');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    if (!groupId) return;
    setLoadingMembers(true);
    try {
      const membersRef = collection(db, 'groups', groupId, 'members');
      const q = query(membersRef, limit(50));
      const snap = await getDocs(q);
      const mList = snap.docs.map((d) => ({ uid: d.id, ...d.data() })) as GroupMember[];
      setMembers(mList);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadRequests = async () => {
    if (!groupId) return;
    setLoadingRequests(true);
    try {
      const reqList = await getGroupJoinRequests(groupId, 50);
      setRequests(reqList);
    } catch (err) {
      console.error('Failed to load join requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadGroupAndRole();
  }, [groupId, currentUser]);

  useEffect(() => {
    if (groupId) {
      if (activeTab === 'members') loadMembers();
      else if (activeTab === 'requests') loadRequests();
    }
  }, [groupId, activeTab]);

  const handleApprove = async (targetUid: string) => {
    if (!groupId || !currentUser || actionBusyId) return;
    setActionBusyId(targetUid);
    try {
      await approveJoinRequest(groupId, targetUid, currentUser, userProfile);
      toast.success('Join request approved!');
      setRequests((prev) => prev.filter((r) => r.userId !== targetUid));
      loadMembers();
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleReject = async (targetUid: string) => {
    if (!groupId || !currentUser || actionBusyId) return;
    setActionBusyId(targetUid);
    try {
      await rejectJoinRequest(groupId, targetUid, currentUser);
      toast.success('Join request rejected.');
      setRequests((prev) => prev.filter((r) => r.userId !== targetUid));
    } catch (err: any) {
      toast.error('Action failed.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRoleChange = async (targetUid: string, newRole: GroupRole) => {
    if (!groupId || !currentUser || actionBusyId) return;
    setActionBusyId(targetUid);
    try {
      await updateMemberRole(groupId, targetUid, newRole, currentUser, userProfile);
      toast.success(`Role updated to ${newRole}`);
      setMembers((prev) => prev.map((m) => (m.uid === targetUid ? { ...m, role: newRole } : m)));
    } catch (err: any) {
      toast.error('Failed to update role.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRemove = async (targetUid: string) => {
    if (!groupId || !currentUser || actionBusyId) return;
    if (!window.confirm('Are you sure you want to remove this member from the group?')) return;

    setActionBusyId(targetUid);
    try {
      await removeMemberFromGroup(groupId, targetUid, currentUser, userProfile);
      toast.success('Member removed.');
      setMembers((prev) => prev.filter((m) => m.uid !== targetUid));
    } catch (err: any) {
      toast.error('Failed to remove member.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleBan = async (targetUid: string) => {
    if (!groupId || !currentUser || actionBusyId) return;
    const reason = window.prompt('Enter reason for banning this user:', 'Violation of campus group guidelines');
    if (reason === null) return;

    setActionBusyId(targetUid);
    try {
      await banMemberFromGroup(groupId, targetUid, reason, currentUser, userProfile);
      toast.success('Member banned from group.');
      setMembers((prev) => prev.filter((m) => m.uid !== targetUid));
    } catch (err: any) {
      toast.error('Failed to ban member.');
    } finally {
      setActionBusyId(null);
    }
  };

  const canAdminister = canManageMembers(userRole, userProfile?.role);

  const filteredMembers = members.filter((m) =>
    (m.displayName || m.uid).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(`/groups/${groupId}`)}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white truncate">
              {group?.name || 'Group Members'}
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Member Management & Roles</p>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'members'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Members ({members.length})</span>
          </button>

          {canAdminister && group?.visibility === 'private' && (
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'requests'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Join Requests ({requests.length})</span>
            </button>
          )}
        </div>

        {activeTab === 'members' ? (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member name or UID..."
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
              />
            </div>

            {/* Member List */}
            {loadingMembers ? (
              <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                <span>Loading member roster...</span>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400">
                No members found matching query.
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl divide-y divide-slate-800/60 overflow-hidden">
                {filteredMembers.map((member) => {
                  const isSelf = member.uid === currentUser?.uid;
                  return (
                    <div key={member.uid} className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                          {member.photoURL ? (
                            <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (member.displayName || member.uid).slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate">
                              {member.displayName || member.uid}
                            </span>
                            {member.role === 'owner' ? (
                              <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase rounded flex items-center gap-1">
                                <Crown className="w-3 h-3" />
                                Owner
                              </span>
                            ) : member.role === 'admin' ? (
                              <span className="px-2 py-0.5 bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[10px] font-black uppercase rounded flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                Admin
                              </span>
                            ) : member.role === 'moderator' ? (
                              <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-black uppercase rounded flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                Mod
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {isSelf ? 'You' : `UID: ${member.uid.slice(0, 8)}...`}
                          </span>
                        </div>
                      </div>

                      {/* Admin Actions */}
                      {canAdminister && !isSelf && member.role !== 'owner' && (
                        <div className="flex items-center gap-2 shrink-0">
                          {member.role !== 'admin' && (
                            <button
                              onClick={() => handleRoleChange(member.uid, 'admin')}
                              disabled={actionBusyId === member.uid}
                              className="px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl text-[11px] font-semibold transition-all"
                            >
                              Make Admin
                            </button>
                          )}

                          {member.role !== 'moderator' && member.role !== 'admin' && (
                            <button
                              onClick={() => handleRoleChange(member.uid, 'moderator')}
                              disabled={actionBusyId === member.uid}
                              className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-xl text-[11px] font-semibold transition-all"
                            >
                              Make Mod
                            </button>
                          )}

                          <button
                            onClick={() => handleRemove(member.uid)}
                            disabled={actionBusyId === member.uid}
                            className="p-1.5 bg-slate-950 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 rounded-xl transition-colors"
                            title="Remove Member"
                          >
                            <UserX className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleBan(member.uid)}
                            disabled={actionBusyId === member.uid}
                            className="p-1.5 bg-slate-950 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 rounded-xl transition-colors"
                            title="Ban Member"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Join Requests Tab */
          <div className="space-y-4">
            {loadingRequests ? (
              <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Loading pending requests...</span>
              </div>
            ) : requests.length === 0 ? (
              <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 space-y-2">
                <UserCheck className="w-8 h-8 text-slate-600 mx-auto" />
                <p>No pending join requests for this group.</p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl divide-y divide-slate-800/60 overflow-hidden">
                {requests.map((req) => (
                  <div key={req.userId} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                        {req.avatar ? (
                          <img src={req.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          req.userName.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">{req.userName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Requested access to private group
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(req.userId)}
                        disabled={actionBusyId === req.userId}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 transition-all shadow-md"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>

                      <button
                        onClick={() => handleReject(req.userId)}
                        disabled={actionBusyId === req.userId}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl flex items-center gap-1 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
