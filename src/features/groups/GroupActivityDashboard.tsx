import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { BackButton } from '../../components/BackButton';
import { getGroupById } from '../../services/groupService';
import { canManageMembers } from '../../services/groupPermissionService';
import type { CampusGroup, GroupRole } from '../../types/group';
import {
  BarChart3,
  Users,
  Sparkles,
  ShieldAlert,
  Megaphone,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const GroupActivityDashboard: React.FC = () => {
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

      setStats({
        memberCount: g?.memberCount || 0,
        announcementsCount: annSnap.size,
        momentsCount: momSnap.size,
        reportsCount: repSnap.size,
      });
    } catch (err) {
      toast.error('Failed to load activity dashboard.');
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
          <BackButton customFallback={`/groups/${groupId}`} />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white truncate">
              {group?.name || 'Group Dashboard'}
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Activity & Analytics Overview</p>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading activity dashboard...</span>
          </div>
        ) : !canView ? (
          <div className="p-8 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-center space-y-3 text-rose-300 text-xs">
            <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="font-bold">Access Denied: Only group managers can view activity dashboard.</p>
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
                <span className="text-[10px] text-slate-500 block font-mono">Capacity: 10,000</span>
              </div>

              {/* Moments Count */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Moments</span>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">{stats.momentsCount}</div>
                <span className="text-[10px] text-slate-500 block font-mono">Permanent</span>
              </div>

              {/* Announcements Count */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Announcements</span>
                  <Megaphone className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">{stats.announcementsCount}</div>
                <span className="text-[10px] text-slate-500 block font-mono">FCM Topic Broadcast</span>
              </div>

              {/* Pending Reports */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Reports</span>
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">{stats.reportsCount}</div>
                <span className="text-[10px] text-slate-500 block font-mono">Moderation Queue</span>
              </div>
            </div>

            {/* Quick Administrative Shortcuts */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-400" />
                <span>Management Shortcuts</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => navigate(`/groups/${groupId}/members`)}
                  className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left transition-colors group"
                >
                  <Users className="w-5 h-5 text-sky-400 mb-2" />
                  <span className="text-xs font-bold text-white block group-hover:text-sky-300">Manage Members</span>
                  <span className="text-[10px] text-slate-400">Roles, demotions, bans</span>
                </button>

                <button
                  onClick={() => navigate(`/groups/${groupId}/moderation`)}
                  className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left transition-colors group"
                >
                  <ShieldAlert className="w-5 h-5 text-purple-400 mb-2" />
                  <span className="text-xs font-bold text-white block group-hover:text-purple-300">Moderation Queue</span>
                  <span className="text-[10px] text-slate-400">Member & content reports</span>
                </button>

                <button
                  onClick={() => navigate(`/groups/${groupId}/settings`)}
                  className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left transition-colors group"
                >
                  <BarChart3 className="w-5 h-5 text-amber-400 mb-2" />
                  <span className="text-xs font-bold text-white block group-hover:text-amber-300">Group Settings</span>
                  <span className="text-[10px] text-slate-400">Metadata & invite pass</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
