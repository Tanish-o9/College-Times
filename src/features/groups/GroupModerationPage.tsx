import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getGroupById } from '../../services/groupService';
import {
  getGroupModerationReports,
  getGroupAuditLogs,
  unbanMemberFromGroup,
  getGroupJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} from '../../services/groupManagementService';
import { canModerateContent } from '../../services/groupPermissionService';
import type { CampusGroup, GroupRole, GroupMemberReport, GroupAuditLog, GroupJoinRequest } from '../../types/group';
import {
  ArrowLeft,
  ShieldAlert,
  FileText,
  Ban,
  RefreshCw,
  UserCheck,
  Check,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type Tab = 'reports' | 'requests' | 'banned' | 'logs';

export const GroupModerationPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<CampusGroup | null>(null);
  const [userRole, setUserRole] = useState<GroupRole>('member');
  const [activeTab, setActiveTab] = useState<Tab>('reports');

  // Moderation state
  const [reports, setReports] = useState<GroupMemberReport[]>([]);
  const [joinRequests, setJoinRequests] = useState<GroupJoinRequest[]>([]);
  const [bannedMembers, setBannedMembers] = useState<{ uid: string; reason?: string }[]>([]);
  const [logs, setLogs] = useState<GroupAuditLog[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  const loadGroupAndRole = async () => {
    if (!groupId || !currentUser) return;
    try {
      const g = await getGroupById(groupId);
      setGroup(g);

      const memberRef = doc(db, 'groups', groupId, 'members', currentUser.uid);
      const snap = await getDoc(memberRef);
      if (snap.exists()) {
        setUserRole(snap.data().role || 'member');
      }
    } catch (err) {
      toast.error('Failed to load moderation info.');
    }
  };

  const loadTabData = async () => {
    if (!groupId) return;
    setLoadingData(true);
    try {
      if (activeTab === 'reports') {
        const rList = await getGroupModerationReports(groupId, 50);
        setReports(rList);
      } else if (activeTab === 'requests') {
        const reqList = await getGroupJoinRequests(groupId, 50);
        setJoinRequests(reqList);
      } else if (activeTab === 'banned') {
        const membersRef = collection(db, 'groups', groupId, 'bannedMembers');
        const snap = await getDocs(membersRef);
        const bList = snap.docs.map((d) => ({ uid: d.id, reason: d.data().reason }));
        setBannedMembers(bList);
      } else if (activeTab === 'logs') {
        const lList = await getGroupAuditLogs(groupId, 50);
        setLogs(lList);
      }
    } catch (err) {
      console.error('Failed to load tab data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadGroupAndRole();
  }, [groupId, currentUser]);

  useEffect(() => {
    if (groupId) loadTabData();
  }, [groupId, activeTab]);

  const handleApproveJoin = async (targetUid: string) => {
    if (!groupId || !currentUser) return;
    try {
      await approveJoinRequest(groupId, targetUid, currentUser, userProfile);
      toast.success('Join request approved.');
      setJoinRequests((prev) => prev.filter((r) => r.userId !== targetUid));
    } catch (err: any) {
      toast.error('Failed to approve join request.');
    }
  };

  const handleRejectJoin = async (targetUid: string) => {
    if (!groupId || !currentUser) return;
    try {
      await rejectJoinRequest(groupId, targetUid, currentUser);
      toast.success('Join request rejected.');
      setJoinRequests((prev) => prev.filter((r) => r.userId !== targetUid));
    } catch (err: any) {
      toast.error('Failed to reject join request.');
    }
  };

  const handleUnban = async (targetUid: string) => {
    if (!groupId || !currentUser) return;
    try {
      await unbanMemberFromGroup(groupId, targetUid, currentUser);
      toast.success('User unbanned.');
      setBannedMembers((prev) => prev.filter((b) => b.uid !== targetUid));
    } catch (err: any) {
      toast.error('Failed to unban user.');
    }
  };

  const canModerate = canModerateContent(userRole, userProfile?.role);

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
              {group?.name || 'Group Moderation'}
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Community Safety & Moderation Dashboard</p>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {!canModerate ? (
          <div className="p-8 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-center space-y-3 text-rose-300 text-xs">
            <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="font-bold">Access Denied: Only group moderators and admins can view moderation dashboard.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'reports'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Reports ({reports.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('requests')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'requests'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Join Requests ({joinRequests.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('banned')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'banned'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Ban className="w-4 h-4" />
                <span>Banned Roster ({bannedMembers.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'logs'
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Audit Logs</span>
              </button>
            </div>

            {/* Tab Content */}
            {loadingData ? (
              <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                <span>Loading moderation data...</span>
              </div>
            ) : activeTab === 'reports' ? (
              reports.length === 0 ? (
                <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400">
                  No pending member reports.
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <div key={report.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-rose-400 uppercase font-mono">{report.reason}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Report ID: {report.id?.slice(0, 8)}</span>
                      </div>
                      <p className="text-xs text-slate-300">Target User UID: {report.targetUserId}</p>
                      {report.description && <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl">{report.description}</p>}
                    </div>
                  ))}
                </div>
              )
            ) : activeTab === 'requests' ? (
              joinRequests.length === 0 ? (
                <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400">
                  No pending join requests for this group.
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl divide-y divide-slate-800/60 overflow-hidden">
                  {joinRequests.map((req) => (
                    <div key={req.userId} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-white block">{req.userName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">UID: {req.userId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveJoin(req.userId)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleRejectJoin(req.userId)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : activeTab === 'banned' ? (
              bannedMembers.length === 0 ? (
                <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400">
                  No banned members in this group.
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl divide-y divide-slate-800/60 overflow-hidden">
                  {bannedMembers.map((b) => (
                    <div key={b.uid} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-white block">UID: {b.uid}</span>
                        <span className="text-[10px] text-slate-400">Reason: {b.reason || 'Banned by admin'}</span>
                      </div>
                      <button
                        onClick={() => handleUnban(b.uid)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
                      >
                        Unban
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Audit Logs */
              logs.length === 0 ? (
                <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400">
                  No audit logs recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-sky-400 font-mono uppercase mr-2">[{log.action}]</span>
                        <span className="text-slate-300">{log.details}</span>
                        <span className="text-slate-500 text-[10px] block font-mono">By: {log.actorName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
};
