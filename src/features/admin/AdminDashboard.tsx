import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Post } from '../../types/models';
import type { CampusGroup } from '../../types/group';
import type { MarketplaceListing } from '../../types/marketplace';
import type { Opportunity } from '../../types/opportunity';
import { deletePost, createBroadcastPost, type CreateBroadcastPayload } from '../../services/postService';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { getChatFeatureFlag, updateChatRolloutFlag, type ChatFeatureFlag } from '../../services/featureFlagService';
import { AlertHistory } from './AlertHistory';
import { AlertAdminDetail } from './AlertAdminDetail';
import { getReports, updateReportStatus, type Report, type ReportStatus } from '../../services/reportService';
import { createAuditLog, getAuditLogs, type AuditLog } from '../../services/auditLogService';
import { getPlatformAnalytics, type PlatformMetrics } from '../../services/platformAnalyticsService';
import {
  Shield,
  AlertOctagon,
  Users as UsersIcon,
  RefreshCw,
  Trash2,
  Send,
  Sliders,
  Power,
  Bell,
  Search,
  LineChart,
  ClipboardList,
  ShieldCheck,
  FileText,
  ChevronRight
} from 'lucide-react';
import { collection, query, limit, getDocs, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type AdminTab =
  | 'dashboard'
  | 'users'
  | 'reports'
  | 'groups'
  | 'posts'
  | 'marketplace'
  | 'opportunities'
  | 'events'
  | 'rollout'
  | 'campus-alerts'
  | 'analytics'
  | 'audit-logs';

export const AdminDashboard: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [selectedAlertPostId, setSelectedAlertPostId] = useState<string | null>(null);

  // States
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Dashboard / Rollout / Alerts
  const [chatFlag, setChatFlag] = useState<ChatFeatureFlag>({ enabled: true, rolloutPercentage: 100 });
  const [loadingFlag, setLoadingFlag] = useState<boolean>(false);
  const [selectedPercentage, setSelectedPercentage] = useState<number>(100);

  // Broadcast Form State
  const [bTitle, setBTitle] = useState('');
  const [bContent, setBContent] = useState('');
  const [bImageUrl, setBImageUrl] = useState('');
  const [submittingBroadcast, setSubmittingBroadcast] = useState(false);

  // Users Tab
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Unified Reports Tab
  const [reportsList, setReportsList] = useState<Report[]>([]);
  const [reportFilter, setReportFilter] = useState<ReportStatus | 'ALL'>('ALL');
  const [loadingReports, setLoadingReports] = useState(false);

  // Groups Tab
  const [groupsList, setGroupsList] = useState<CampusGroup[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Posts Tab
  const [postsList, setPostsList] = useState<Post[]>([]);
  const [postSearchQuery, setPostSearchQuery] = useState('');
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Marketplace Tab
  const [listingsList, setListingsList] = useState<MarketplaceListing[]>([]);
  const [listingSearchQuery, setListingSearchQuery] = useState('');
  const [loadingListings, setLoadingListings] = useState(false);

  // Opportunities Tab
  const [oppsList, setOppsList] = useState<Opportunity[]>([]);
  const [oppsSearchQuery, setOppsSearchQuery] = useState('');
  const [loadingOpps, setLoadingOpps] = useState(false);

  // Events Tab
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Analytics Tab
  const [analytics, setAnalytics] = useState<PlatformMetrics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Audit Logs Tab
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<string>('ALL');

  // Fetching Functions

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

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const q = query(collection(db, 'users'), limit(100));
      const snap = await getDocs(q);
      setUsersList(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    } catch (err) {
      toast.error('Failed to load users list.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchUnifiedReports = async () => {
    setLoadingReports(true);
    try {
      const list = await getReports(reportFilter === 'ALL' ? undefined : reportFilter);
      setReportsList(list);
    } catch (err) {
      toast.error('Failed to load reports queue.');
    } finally {
      setLoadingReports(false);
    }
  };

  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      const q = query(collection(db, 'groups'), limit(100));
      const snap = await getDocs(q);
      setGroupsList(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CampusGroup)));
    } catch (err) {
      toast.error('Failed to load groups list.');
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchPosts = async () => {
    setLoadingPosts(true);
    try {
      const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(100));
      const snap = await getDocs(q);
      setPostsList(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));
    } catch (err) {
      toast.error('Failed to load posts.');
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchListings = async () => {
    setLoadingListings(true);
    try {
      const q = query(collection(db, 'marketplaceListings'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      setListingsList(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MarketplaceListing)));
    } catch (err) {
      toast.error('Failed to load listings.');
    } finally {
      setLoadingListings(false);
    }
  };

  const fetchOpps = async () => {
    setLoadingOpps(true);
    try {
      const q = query(collection(db, 'opportunities'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      setOppsList(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Opportunity)));
    } catch (err) {
      toast.error('Failed to load opportunities.');
    } finally {
      setLoadingOpps(false);
    }
  };

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      setEventsList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      toast.error('Failed to load events.');
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const data = await getPlatformAnalytics();
      setAnalytics(data);
    } catch (err) {
      toast.error('Failed to calculate platform metrics.');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchAudits = async () => {
    setLoadingAudits(true);
    try {
      const logs = await getAuditLogs(100);
      setAuditLogs(logs);
    } catch (err) {
      toast.error('Failed to load moderator audit logs.');
    } finally {
      setLoadingAudits(false);
    }
  };

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.map((log) => {
      let severity: 'critical' | 'warning' | 'info' = 'info';
      const actionLower = log.action.toLowerCase();
      if (actionLower.includes('ban') || actionLower.includes('delete_group') || actionLower.includes('delete_user') || actionLower.includes('admin')) {
        severity = 'critical';
      } else if (actionLower.includes('delete') || actionLower.includes('warn') || actionLower.includes('reject') || actionLower.includes('remove')) {
        severity = 'warning';
      }
      return { ...log, severity };
    }).filter((log) => {
      if (auditActionFilter !== 'ALL' && log.action.toLowerCase() !== auditActionFilter.toLowerCase()) {
        return false;
      }
      if (auditSeverityFilter !== 'ALL' && log.severity !== auditSeverityFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [auditLogs, auditActionFilter, auditSeverityFilter]);

  useEffect(() => {
    if (activeTab === 'dashboard') fetchUnifiedReports();
    if (activeTab === 'rollout') fetchChatFlag();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'reports') fetchUnifiedReports();
    if (activeTab === 'groups') fetchGroups();
    if (activeTab === 'posts') {
      fetchPosts();
    }
    if (activeTab === 'marketplace') fetchListings();
    if (activeTab === 'opportunities') fetchOpps();
    if (activeTab === 'events') fetchEvents();
    if (activeTab === 'analytics') fetchAnalytics();
    if (activeTab === 'audit-logs') fetchAudits();
  }, [activeTab, reportFilter]);

  // Action Handlers
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to update rollout percentage.');
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
      setPostsList((prev) => prev.filter((p) => p.id !== postId));
      if (currentUser) {
        await createAuditLog(currentUser.uid, 'POST_REMOVED', 'post', postId, 'Removed post content');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete post.');
    } finally {
      setProcessingId(null);
    }
  };

  // User tab actions
  const handleToggleUserRole = async (targetUid: string, currentRole: string) => {
    if (!currentUser || processingId) return;
    setProcessingId(targetUid);
    const newRole = currentRole === 'admin' ? 'student' : 'admin';
    try {
      await updateDoc(doc(db, 'users', targetUid), { role: newRole });
      toast.success(`User role updated to ${newRole}!`);
      setUsersList((prev) => prev.map((u) => (u.uid === targetUid ? { ...u, role: newRole } : u)));
      await createAuditLog(currentUser.uid, 'USER_RESTRICTED', 'user', targetUid, `Role updated to ${newRole}`);
    } catch (err) {
      toast.error('Failed to toggle user role.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleUserSuspension = async (targetUid: string, currentStatus: string) => {
    if (!currentUser || processingId) return;
    setProcessingId(targetUid);
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await updateDoc(doc(db, 'users', targetUid), { profileStatus: newStatus });
      toast.success(newStatus === 'suspended' ? 'User suspended! Session will be terminated.' : 'User activated!');
      setUsersList((prev) => prev.map((u) => (u.uid === targetUid ? { ...u, profileStatus: newStatus } : u)));
      await createAuditLog(currentUser.uid, 'USER_RESTRICTED', 'user', targetUid, `${newStatus === 'suspended' ? 'Suspended' : 'Activated'} user account`);
    } catch (err) {
      toast.error('Failed to update suspension status.');
    } finally {
      setProcessingId(null);
    }
  };

  // Unified Reports Queue actions
  const handleResolveReport = async (reportId: string, status: 'RESOLVED' | 'DISMISSED') => {
    if (!currentUser || processingId) return;
    setProcessingId(reportId);
    try {
      await updateReportStatus(reportId, status, currentUser.uid);
      toast.success(`Report status set to ${status}!`);
      setReportsList((prev) => prev.map((r) => (r.id === reportId ? { ...r, status, resolvedBy: currentUser.uid } : r)));
      await createAuditLog(currentUser.uid, 'REPORT_RESOLVED', 'report', reportId, `Report set to ${status}`);
    } catch (err) {
      toast.error('Failed to resolve report.');
    } finally {
      setProcessingId(null);
    }
  };

  // Content moderation actions
  const handleRemoveGroup = async (groupId: string) => {
    if (!currentUser || processingId) return;
    const confirm = window.confirm('Are you sure you want to deactivate/delete this group?');
    if (!confirm) return;
    setProcessingId(groupId);
    try {
      await updateDoc(doc(db, 'groups', groupId), { active: false });
      toast.success('Group deactivated successfully.');
      setGroupsList((prev) => prev.map((g) => (g.id === groupId ? { ...g, active: false } : g)));
      await createAuditLog(currentUser.uid, 'GROUP_ACTION', 'group', groupId, 'Deactivated group');
    } catch (err) {
      toast.error('Failed to deactivate group.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveListing = async (listingId: string) => {
    if (!currentUser || processingId) return;
    const confirm = window.confirm('Are you sure you want to remove this marketplace item?');
    if (!confirm) return;
    setProcessingId(listingId);
    try {
      await deleteDoc(doc(db, 'marketplaceListings', listingId));
      toast.success('Marketplace listing removed.');
      setListingsList((prev) => prev.filter((l) => l.id !== listingId));
      await createAuditLog(currentUser.uid, 'MARKETPLACE_MODERATION', 'listing', listingId, 'Deleted listing');
    } catch (err) {
      toast.error('Failed to remove listing.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveOpportunity = async (oppId: string) => {
    if (!currentUser || processingId) return;
    const confirm = window.confirm('Are you sure you want to delete this opportunity?');
    if (!confirm) return;
    setProcessingId(oppId);
    try {
      await deleteDoc(doc(db, 'opportunities', oppId));
      toast.success('Opportunity deleted.');
      setOppsList((prev) => prev.filter((o) => o.id !== oppId));
      await createAuditLog(currentUser.uid, 'OPPORTUNITY_MODERATION', 'opportunity', oppId, 'Deleted opportunity');
    } catch (err) {
      toast.error('Failed to remove opportunity.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveEvent = async (eventId: string) => {
    if (!currentUser || processingId) return;
    const confirm = window.confirm('Are you sure you want to delete this event?');
    if (!confirm) return;
    setProcessingId(eventId);
    try {
      await deleteDoc(doc(db, 'events', eventId));
      toast.success('Event deleted.');
      setEventsList((prev) => prev.filter((e) => e.id !== eventId));
      await createAuditLog(currentUser.uid, 'EVENT_MODERATION', 'event', eventId, 'Deleted event');
    } catch (err) {
      toast.error('Failed to remove event.');
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
      await createAuditLog(currentUser.uid, 'POST_REMOVED', 'broadcast', 'new', `Broadcast notice: ${payload.title}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish broadcast.');
    } finally {
      setSubmittingBroadcast(false);
    }
  };

  // Searching Filters
  const filteredUsers = usersList.filter(
    (u) =>
      (u.displayName || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (u.username || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const filteredGroups = groupsList.filter((g) =>
    (g.name || '').toLowerCase().includes(groupSearchQuery.toLowerCase())
  );

  const filteredPosts = postsList.filter((p) =>
    (p.title || '').toLowerCase().includes(postSearchQuery.toLowerCase()) ||
    (p.content || '').toLowerCase().includes(postSearchQuery.toLowerCase())
  );

  const filteredListings = listingsList.filter((l) =>
    (l.title || '').toLowerCase().includes(listingSearchQuery.toLowerCase())
  );

  const filteredOpps = oppsList.filter((o) =>
    (o.title || '').toLowerCase().includes(oppsSearchQuery.toLowerCase())
  );

  const filteredEvents = eventsList.filter((e) =>
    (e.title || '').toLowerCase().includes(eventSearchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 flex flex-col md:flex-row gap-6">
      {/* Admin Navigation Sidebar */}
      <nav className="md:w-64 shrink-0 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <span className="p-1.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
              <Shield className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-sm font-black text-white">Admin Portal</h1>
              <p className="text-[10px] text-slate-500">College Times Moderator</p>
            </div>
          </div>

          <div className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Sliders },
              { id: 'users', label: 'Users Directory', icon: UsersIcon },
              { id: 'reports', label: 'Reports Queue', icon: AlertOctagon },
              { id: 'groups', label: 'Groups', icon: UsersIcon },
              { id: 'posts', label: 'Feed Posts', icon: FileText },
              { id: 'marketplace', label: 'Marketplace', icon: Sliders },
              { id: 'opportunities', label: 'Opportunities', icon: Sliders },
              { id: 'events', label: 'Events Hub', icon: Sliders },
              { id: 'rollout', label: 'Chat Rollout', icon: Sliders },
              { id: 'campus-alerts', label: 'Campus Alerts', icon: Bell },
              { id: 'analytics', label: 'Platform Analytics', icon: LineChart },
              { id: 'audit-logs', label: 'Moderator Logs', icon: ClipboardList },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-purple-500/10 border border-purple-550/20 text-purple-300'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 min-h-[500px] shadow-xl space-y-6">
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sliders className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold text-white">System Controls Dashboard</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Security Gate</span>
                <p className="text-xs text-white font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Active Session</span>
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Active Reports</span>
                <p className="text-xs text-white font-semibold">
                  {reportsList.filter(r => r.status === 'OPEN').length} active flags pending
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">System Status</span>
                <button
                  onClick={() => navigate('/admin/system-health')}
                  className="text-xs text-sky-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <span>View health metrics</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Broadcast Form inside Dashboard tab */}
            <div className="border-t border-slate-800 pt-6">
              <h3 className="text-sm font-bold text-white mb-4">Quick Actions: Publish Broadcast</h3>
              <form onSubmit={handleBroadcastSubmit} className="space-y-4 max-w-2xl">
                <input
                  type="text"
                  value={bTitle}
                  onChange={(e) => setBTitle(e.target.value)}
                  placeholder="Broadcast Title..."
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none"
                />
                <textarea
                  rows={3}
                  value={bContent}
                  onChange={(e) => setBContent(e.target.value)}
                  placeholder="Broadcast Content..."
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none resize-none"
                />
                <button
                  type="submit"
                  disabled={submittingBroadcast}
                  className="px-4 py-2 bg-purple-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Broadcast</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Users Directory Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-purple-400" />
                <span>Campus Users Directory ({filteredUsers.length})</span>
              </h2>
              <button onClick={fetchUsers} className="p-1 text-slate-400 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search user by display name, username, or email..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none"
              />
            </div>

            {loadingUsers ? (
              <p className="text-xs text-slate-400 text-center py-6">Loading user accounts...</p>
            ) : (
              <div className="overflow-x-auto border border-slate-850 rounded-2xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-500 uppercase text-[9px] font-bold tracking-wider">
                    <tr>
                      <th className="p-3">User Details</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Points</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 bg-slate-900/30">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-900/40">
                        <td className="p-3">
                          <div>
                            <p className="font-bold text-white">{u.displayName}</p>
                            <p className="text-[10px] text-sky-400">@{u.username || 'student'}</p>
                            <p className="text-[10px] text-slate-500">{u.email || u.phone || 'No email'}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.role === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {u.role || 'student'}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-amber-400">{u.points || 0} pts</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.profileStatus === 'suspended' ? 'bg-rose-500/25 text-rose-400' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {u.profileStatus || 'active'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => handleToggleUserRole(u.uid, u.role)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg"
                          >
                            Toggle Role
                          </button>
                          <button
                            onClick={() => handleToggleUserSuspension(u.uid, u.profileStatus)}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg ${
                              u.profileStatus === 'suspended'
                                ? 'bg-emerald-555/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-555/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {u.profileStatus === 'suspended' ? 'Activate' : 'Suspend'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Unified Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-400" />
                <span>Unified Moderation Reports Queue ({reportsList.length})</span>
              </h2>
              <div className="flex items-center gap-3">
                <select
                  value={reportFilter}
                  onChange={(e) => setReportFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white"
                >
                  <option value="ALL">All Reports</option>
                  <option value="OPEN">Open Only</option>
                  <option value="REVIEWING">Reviewing</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="DISMISSED">Dismissed</option>
                </select>
                <button onClick={fetchUnifiedReports} className="p-1 text-slate-400 hover:text-white">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {loadingReports ? (
              <p className="text-xs text-slate-400 text-center py-6">Fetching moderation requests...</p>
            ) : reportsList.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-8">No reports matches this filter status.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {reportsList.map((rep) => (
                  <div key={rep.id} className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-3 relative">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-850 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          rep.status === 'OPEN'
                            ? 'bg-rose-500/25 text-rose-400 border border-rose-500/30'
                            : rep.status === 'REVIEWING'
                              ? 'bg-amber-500/25 text-amber-400'
                              : 'bg-slate-800 text-slate-500'
                        }`}>
                          {rep.status}
                        </span>
                        <span className="text-[10px] text-sky-400 font-mono">Target: {rep.targetType} ({rep.targetId})</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {rep.createdAt ? new Date(rep.createdAt.toMillis?.() || rep.createdAt).toLocaleString() : ''}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="text-slate-400 font-bold">Reason: <span className="text-white font-medium">{rep.reason}</span></p>
                      {rep.description && <p className="text-slate-400">Notes: <span className="text-slate-200">{rep.description}</span></p>}
                      <p className="text-[10px] text-slate-500">Submitted by Reporter UID: {rep.reporterId}</p>
                    </div>

                    {/* Action buttons */}
                    {rep.status === 'OPEN' && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900">
                        <button
                          onClick={() => rep.id && handleResolveReport(rep.id, 'DISMISSED')}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg text-slate-300"
                        >
                          Dismiss Flag
                        </button>
                        <button
                          onClick={() => rep.id && handleResolveReport(rep.id, 'RESOLVED')}
                          className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-450 text-[10px] font-bold rounded-lg text-slate-950"
                        >
                          Mark Resolved
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm('Delete this reported content?')) {
                              await deleteDoc(doc(db, rep.targetType === 'post' ? 'posts' : rep.targetType === 'marketplace' ? 'marketplaceListings' : rep.targetType === 'opportunity' ? 'opportunities' : rep.targetType === 'event' ? 'events' : 'posts', rep.targetId));
                              if (rep.id) await handleResolveReport(rep.id, 'RESOLVED');
                              toast.success('Reported content removed.');
                            }
                          }}
                          className="px-2.5 py-1 bg-rose-500 hover:bg-rose-450 text-[10px] font-bold rounded-lg text-white"
                        >
                          Remove Content
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Groups Management */}
        {activeTab === 'groups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-purple-400" />
                <span>Campus Groups Registry ({filteredGroups.length})</span>
              </h2>
              <button onClick={fetchGroups} className="p-1 text-slate-400 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={groupSearchQuery}
              onChange={(e) => setGroupSearchQuery(e.target.value)}
              placeholder="Search group by name..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none"
            />

            {loadingGroups ? (
              <p className="text-xs text-slate-400 text-center">Loading campus groups...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredGroups.map((g) => (
                  <div key={g.id} className="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-xs">{g.name}</p>
                      <p className="text-[10px] text-slate-500">{g.memberCount || 0} members • Category: {g.category}</p>
                      <p className={`text-[10px] font-bold mt-1 ${g.active ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {g.active ? 'Active' : 'Deactivated'}
                      </p>
                    </div>
                    {g.active && (
                      <button
                        onClick={() => g.id && handleRemoveGroup(g.id)}
                        className="px-2 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500 hover:text-white rounded-lg text-[10px] font-bold transition-all"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Feed Posts Tab */}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <span>Feed Posts List ({filteredPosts.length})</span>
              </h2>
              <button onClick={fetchPosts} className="p-1 text-slate-400 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={postSearchQuery}
              onChange={(e) => setPostSearchQuery(e.target.value)}
              placeholder="Search posts by title or content..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none"
            />

            {loadingPosts ? (
              <p className="text-xs text-slate-400 text-center">Loading feed posts...</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredPosts.map((post) => (
                  <div key={post.id} className="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 text-[9px] font-mono uppercase">{post.category}</span>
                      <h4 className="font-bold text-white text-xs">{post.title || 'Untitled Post'}</h4>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{post.content}</p>
                    </div>
                    <button
                      onClick={() => post.id && handleDelete(post.id)}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 text-rose-400 hover:text-white rounded-xl transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Marketplace Tab */}
        {activeTab === 'marketplace' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-400" />
                <span>Marketplace Listings Registry ({filteredListings.length})</span>
              </h2>
              <button onClick={fetchListings} className="p-1 text-slate-400 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={listingSearchQuery}
              onChange={(e) => setListingSearchQuery(e.target.value)}
              placeholder="Search listings by title..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none"
            />

            {loadingListings ? (
              <p className="text-xs text-slate-400 text-center">Loading marketplace items...</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredListings.map((l) => (
                  <div key={l.id} className="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-xs">{l.title}</p>
                      <p className="text-[10px] text-slate-500">Price: ₹{l.price} • Status: {l.status}</p>
                    </div>
                    <button
                      onClick={() => l.id && handleRemoveListing(l.id)}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 text-rose-400 hover:text-white rounded-xl transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Opportunities Tab */}
        {activeTab === 'opportunities' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-400" />
                <span>Opportunities Hub Registry ({filteredOpps.length})</span>
              </h2>
              <button onClick={fetchOpps} className="p-1 text-slate-400 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={oppsSearchQuery}
              onChange={(e) => setOppsSearchQuery(e.target.value)}
              placeholder="Search opportunities by title..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none"
            />

            {loadingOpps ? (
              <p className="text-xs text-slate-400 text-center">Loading opportunities list...</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredOpps.map((o) => (
                  <div key={o.id} className="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-xs">{o.title}</p>
                      <p className="text-[10px] text-slate-500">{o.organizationName || o.organization} • Type: {o.type} ({o.status})</p>
                    </div>
                    <button
                      onClick={() => o.id && handleRemoveOpportunity(o.id)}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 text-rose-400 hover:text-white rounded-xl transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-400" />
                <span>Events Registry ({filteredEvents.length})</span>
              </h2>
              <button onClick={fetchEvents} className="p-1 text-slate-400 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={eventSearchQuery}
              onChange={(e) => setEventSearchQuery(e.target.value)}
              placeholder="Search events by title..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none"
            />

            {loadingEvents ? (
              <p className="text-xs text-slate-400 text-center">Loading events registry...</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredEvents.map((ev) => (
                  <div key={ev.id} className="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-xs">{ev.title}</p>
                      <p className="text-[10px] text-slate-500">RSVPs: {ev.rsvpCount || 0} attendee(s) • Date: {ev.date}</p>
                    </div>
                    <button
                      onClick={() => ev.id && handleRemoveEvent(ev.id)}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 text-rose-400 hover:text-white rounded-xl transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat Rollout Tab */}
        {activeTab === 'rollout' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-base font-bold text-white">Community Chat Rollout Flags</h2>
              <p className="text-xs text-slate-400 mt-1">Control system access of non-admin student users.</p>
            </div>

            {loadingFlag ? (
              <p className="text-xs text-slate-400 animate-pulse">Loading rollout config...</p>
            ) : (
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">Enable Chat feature</p>
                    <p className="text-[10px] text-slate-500">Toggle community access</p>
                  </div>
                  <button
                    onClick={() => handleSaveRollout(selectedPercentage, !chatFlag.enabled)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 ${
                      chatFlag.enabled ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{chatFlag.enabled ? 'ENABLED' : 'DISABLED'}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">Rollout Percentage</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={selectedPercentage}
                    onChange={(e) => setSelectedPercentage(parseInt(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0% (Kill Switch)</span>
                    <span className="text-purple-400 font-bold">{selectedPercentage}% Rollout</span>
                    <span>100% (All Users)</span>
                  </div>
                </div>

                <button
                  onClick={() => handleSaveRollout(selectedPercentage, chatFlag.enabled)}
                  className="px-4 py-2 bg-purple-500 text-slate-950 text-xs font-bold rounded-xl"
                >
                  Save Rollout Percentage
                </button>
              </div>
            )}
          </div>
        )}

        {/* Campus Alerts Tab */}
        {activeTab === 'campus-alerts' && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white border-b border-slate-800 pb-3">Active Campus Emergency Alerts</h2>
            {selectedAlertPostId ? (
              <AlertAdminDetail
                postId={selectedAlertPostId}
                onClose={() => setSelectedAlertPostId(null)}
              />
            ) : (
              <AlertHistory
                onSelectAlert={(id: string) => setSelectedAlertPostId(id)}
              />
            )}
          </div>
        )}

        {/* Platform Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <LineChart className="w-5 h-5 text-purple-400" />
                <span>Real-Time Platform Performance Metrics</span>
              </h2>
              <button onClick={fetchAnalytics} className="p-1 text-slate-400 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {loadingAnalytics ? (
              <p className="text-xs text-slate-400 text-center py-6">Aggregating database counters...</p>
            ) : !analytics ? (
              <p className="text-xs text-slate-400 text-center py-6">No metrics loaded.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Total Users', value: analytics.usersTotal, sub: `${analytics.usersNew} new this week` },
                  { label: 'Total Posts', value: analytics.postsTotal, sub: 'Main campus feed' },
                  { label: 'Total Comments', value: analytics.commentsTotal, sub: 'Across feed posts' },
                  { label: 'Friendships Formed', value: analytics.friendshipsTotal, sub: 'Social graph connections' },
                  { label: 'Campus Groups', value: analytics.groupsTotal, sub: `${analytics.groupMembershipsTotal} total members` },
                  { label: 'Marketplace Listings', value: analytics.listingsTotal, sub: `${analytics.listingsSold} items sold` },
                  { label: 'Active Opportunities', value: analytics.opportunitiesActive, sub: 'Active listings only' },
                  { label: 'Upcoming Events', value: analytics.eventsUpcoming, sub: `${analytics.eventsRsvps} RSVPs submitted` },
                  { label: 'Pending Safety Reports', value: analytics.reportsOpen, sub: `${analytics.reportsResolved} resolved logs` },
                ].map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500">{item.label}</span>
                    <p className="text-2xl font-black text-white">{item.value}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{item.sub}</p>
                  </div>
                ))}
              </div>

              {/* Trend comparisons section */}
              {analytics.trends && (
                <div className="mt-8 p-6 bg-slate-950 border border-slate-850 rounded-3xl space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 font-mono">Platform Growth Trends</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Users growth */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-white">Users Growth</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 bg-slate-900 border border-slate-850 rounded-xl text-center">
                          <span className="text-[9px] text-slate-500 block uppercase font-mono">Today vs Yesterday</span>
                          <span className="text-xs font-bold text-white">{analytics.trends.users.today} / {analytics.trends.users.yesterday}</span>
                        </div>
                        <div className="p-2 bg-slate-900 border border-slate-850 rounded-xl text-center">
                          <span className="text-[9px] text-slate-500 block uppercase font-mono">This Week vs Prev</span>
                          <span className="text-xs font-bold text-white">{analytics.trends.users.thisWeek} / {analytics.trends.users.prevWeek}</span>
                        </div>
                        <div className="p-2 bg-slate-900 border border-slate-850 rounded-xl text-center">
                          <span className="text-[9px] text-slate-500 block uppercase font-mono">This Month vs Prev</span>
                          <span className="text-xs font-bold text-white">{analytics.trends.users.thisMonth} / {analytics.trends.users.prevMonth}</span>
                        </div>
                      </div>
                    </div>

                    {/* Posts growth */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-white">Engagement Growth (Posts)</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 bg-slate-900 border border-slate-850 rounded-xl text-center">
                          <span className="text-[9px] text-slate-500 block uppercase font-mono">Today vs Yesterday</span>
                          <span className="text-xs font-bold text-white">{analytics.trends.posts.today} / {analytics.trends.posts.yesterday}</span>
                        </div>
                        <div className="p-2 bg-slate-900 border border-slate-850 rounded-xl text-center">
                          <span className="text-[9px] text-slate-500 block uppercase font-mono">This Week vs Prev</span>
                          <span className="text-xs font-bold text-white">{analytics.trends.posts.thisWeek} / {analytics.trends.posts.prevWeek}</span>
                        </div>
                        <div className="p-2 bg-slate-900 border border-slate-850 rounded-xl text-center">
                          <span className="text-[9px] text-slate-500 block uppercase font-mono">This Month vs Prev</span>
                          <span className="text-xs font-bold text-white">{analytics.trends.posts.thisMonth} / {analytics.trends.posts.prevMonth}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        )}

        {/* Moderator Logs Tab */}
        {activeTab === 'audit-logs' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3.5">
              <div className="space-y-0.5">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-purple-400" />
                  <span>Immutable Moderator Audit Trail Logs ({filteredAuditLogs.length})</span>
                </h2>
                <p className="text-[10px] text-slate-505 font-mono">Immutable audit history for regulatory security tracking</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Action Types</option>
                  <option value="delete_post">Delete Post</option>
                  <option value="ban_user">Ban User</option>
                  <option value="resolve_report">Resolve Report</option>
                  <option value="delete_group">Delete Group</option>
                  <option value="create_broadcast">Create Broadcast</option>
                  <option value="warn_user">Warn User</option>
                </select>
                <select
                  value={auditSeverityFilter}
                  onChange={(e) => setAuditSeverityFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Severities</option>
                  <option value="Critical">Critical Actions</option>
                  <option value="Warning">Warning Actions</option>
                  <option value="Info">Info Actions</option>
                </select>
                <button onClick={fetchAudits} className="p-2 bg-slate-900 border border-slate-850 rounded-xl text-slate-400 hover:text-white transition-all">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {loadingAudits ? (
              <p className="text-xs text-slate-400 text-center py-6">Loading audit trail...</p>
            ) : filteredAuditLogs.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-8">No matching audit logs found.</p>
            ) : (
              <div className="space-y-3">
                {filteredAuditLogs.map((log: any) => {
                  let severityColor = 'text-sky-400 bg-sky-500/10 border-sky-500/25';
                  if (log.severity === 'critical') {
                    severityColor = 'text-rose-455 bg-rose-500/10 border-rose-500/25';
                  } else if (log.severity === 'warning') {
                    severityColor = 'text-amber-455 bg-amber-500/10 border-amber-500/25';
                  }

                  return (
                    <div key={log.id} className="p-4 bg-slate-950 border border-slate-850 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase font-mono ${severityColor}`}>
                            {log.severity}
                          </span>
                          <p className="text-slate-400 font-bold text-[10px]">
                            Mod ID: <span className="text-purple-300 font-mono">{log.moderatorId}</span>
                          </p>
                        </div>
                        <p className="text-white">
                          Action: <span className="font-bold text-sky-400 font-mono">{log.action}</span> on {log.targetType} ({log.targetId})
                        </p>
                        {log.reason && <p className="text-slate-500 text-[10px]">Reason: {log.reason}</p>}
                      </div>
                      <span className="text-[10px] text-slate-605 font-mono whitespace-nowrap shrink-0 self-start sm:self-center">
                        {log.timestamp ? new Date(log.timestamp.toMillis?.() || log.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
