import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getGroupById } from '../../services/groupService';
import { canManageMembers } from '../../services/groupPermissionService';
import type { CampusGroup, GroupRole } from '../../types/group';
import {
  ArrowLeft,
  Users,
  Sparkles,
  ShieldAlert,
  Megaphone,
  RefreshCw,
  Activity,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const GroupInsightsPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<CampusGroup | null>(null);
  const [userRole, setUserRole] = useState<GroupRole>('member');
  const [loading, setLoading] = useState<boolean>(true);

  // Statistics
  const [stats, setStats] = useState({
    memberCount: 0,
    announcementsCount: 0,
    momentsCount: 0,
    reportsCount: 0,
    pinnedCount: 0,
  });

  const loadData = async () => {
    if (!groupId || !currentUser) return;
    setLoading(true);
    try {
      const g = await getGroupById(groupId);
      setGroup(g);

      const memberRef = doc(db, 'groups', groupId, 'members', currentUser.uid);
      const snap = await getDoc(memberRef);
      if (snap.exists()) {
        setUserRole(snap.data().role || 'member');
      }

      // Read aggregate counts safely
      const annSnap = await getDocs(query(collection(db, 'groups', groupId, 'announcements'), limit(50)));
      const momSnap = await getDocs(query(collection(db, 'groups', groupId, 'instants'), limit(50)));
      const repSnap = await getDocs(query(collection(db, 'groups', groupId, 'memberReports'), limit(50)));
      const pinSnap = await getDocs(query(collection(db, 'groups', groupId, 'pinnedItems'), limit(20)));

      setStats({
        memberCount: g?.memberCount || 0,
        announcementsCount: annSnap.size,
        momentsCount: momSnap.size,
        reportsCount: repSnap.size,
        pinnedCount: pinSnap.size,
      });
    } catch (err) {
      toast.error('Failed to load group engagement insights.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [groupId, currentUser]);

  const canView = canManageMembers(userRole, userProfile?.role);

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
              {group?.name || 'Group Insights'}
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Engagement Analytics & Performance</p>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading group insights...</span>
          </div>
        ) : !canView ? (
          <div className="p-8 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-center space-y-3 text-rose-300 text-xs">
            <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="font-bold">Access Denied: Only group managers can view engagement insights.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Member Count */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total Members</span>
                  <Users className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">{stats.memberCount}</div>
                <span className="text-[10px] text-slate-500 block font-mono">10K Max Capacity</span>
              </div>

              {/* Moments Count */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Moments</span>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">{stats.momentsCount}</div>
                <span className="text-[10px] text-purple-400 block font-mono">Permanent Stories</span>
              </div>

              {/* Announcements Count */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Announcements</span>
                  <Megaphone className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">{stats.announcementsCount}</div>
                <span className="text-[10px] text-amber-400 block font-mono">FCM Topic Broadcast</span>
              </div>

              {/* Pinned Items */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Pinned Content</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">{stats.pinnedCount}</div>
                <span className="text-[10px] text-emerald-400 block font-mono">Max 20 Pins</span>
              </div>
            </div>

            {/* Engagement Summary Card */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                <span>Engagement Overview</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-1">
                  <span className="font-bold text-slate-200 block">Notification Strategy</span>
                  <p className="text-slate-400 text-[11px]">0 per-user broadcast writes; 1 FCM topic publish to topic group_{groupId}.</p>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-1">
                  <span className="font-bold text-slate-200 block">Scalability Architecture</span>
                  <p className="text-slate-400 text-[11px]">Bounded cursor pagination (max 50) across members, moments, posts, and activities.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
