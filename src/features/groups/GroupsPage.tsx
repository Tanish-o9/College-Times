import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  searchGroups,
  getUserGroupIds,
  joinGroup,
  leaveGroup,
  seedStandardCampusGroups,
  getGroupById,
} from '../../services/groupService';
import { deleteGroupPermanently } from '../../services/groupManagementService';
import type { CampusGroup, CampusGroupType } from '../../types/group';
import {
  Users,
  Search,
  Building2,
  GraduationCap,
  Globe,
  Sparkles,
  Plus,
  Check,
  RefreshCw,
  Lock,
  Key,
  ChevronRight,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';

import { CreateGroupModal } from './CreateGroupModal';
import { JoinGroupByCodeModal } from './JoinGroupByCodeModal';
import { JoinGroupWithPasswordModal } from './JoinGroupWithPasswordModal';
import { useScrollRestoration } from '../../hooks/useScrollRestoration';

type FilterTab = 'all' | 'campus' | 'department' | 'batch' | 'community' | 'my_groups';

export const GroupsPage: React.FC = () => {
  const { currentUser, userProfile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [groups, setGroups] = useState<CampusGroup[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionGroupId, setActionGroupId] = useState<string | null>(null);

  useScrollRestoration('groups', !loading);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinCodeModalOpen, setIsJoinCodeModalOpen] = useState(false);
  const [initialJoinCode, setInitialJoinCode] = useState('');
  const [passwordPromptGroup, setPasswordPromptGroup] = useState<CampusGroup | null>(null);

  const handleDeleteGroup = async (group: CampusGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || actionGroupId) return;

    if (!window.confirm(`Are you sure you want to permanently delete "${group.name}"? This action cannot be undone.`)) {
      return;
    }

    setActionGroupId(group.id);
    try {
      await deleteGroupPermanently(group.id, currentUser, isAdmin);
      toast.success(`Group "${group.name}" deleted permanently.`);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      setJoinedGroupIds((prev) => {
        const next = new Set(prev);
        next.delete(group.id);
        return next;
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete group.');
    } finally {
      setActionGroupId(null);
    }
  };

  // Check URL query parameters for pass codes (e.g. ?code=CT-7K4P9X or /groups/join?code=...)
  useEffect(() => {
    const codeParam = searchParams.get('code') || searchParams.get('joinCode');
    if (codeParam) {
      setInitialJoinCode(codeParam.toUpperCase());
      setIsJoinCodeModalOpen(true);
    }
  }, [searchParams]);

  const loadGroupsAndFilter = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const myGroupIds = await getUserGroupIds(currentUser.uid);
      setJoinedGroupIds(new Set(myGroupIds));

      let fetchedGroups: CampusGroup[] = [];
      if (activeTab === 'my_groups') {
        if (myGroupIds.length > 0) {
          const groupSnaps = await Promise.all(myGroupIds.map((id) => getGroupById(id)));
          fetchedGroups = groupSnaps.filter((g): g is CampusGroup => g !== null);
          if (searchQuery.trim()) {
            const term = searchQuery.trim().toLowerCase();
            fetchedGroups = fetchedGroups.filter(
              (g) =>
                g.name.toLowerCase().includes(term) ||
                g.description?.toLowerCase().includes(term)
            );
          }
        }
      } else {
        const cat = activeTab !== 'all' ? activeTab : 'all';
        fetchedGroups = await searchGroups(searchQuery, cat, 50);
      }

      // Auto-seed default campus groups if 0 groups found in database
      if (fetchedGroups.length === 0 && !searchQuery.trim() && activeTab === 'all') {
        await seedStandardCampusGroups(currentUser);
        fetchedGroups = await searchGroups('', 'all', 50);
      }

      setGroups(fetchedGroups);
    } catch (err) {
      console.error('Error loading campus groups:', err);
      toast.error('Failed to load campus groups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadGroupsAndFilter, 200);
    return () => clearTimeout(timer);
  }, [currentUser, searchQuery, activeTab]);

  const handleJoinPublic = async (group: CampusGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || actionGroupId) return;

    if (group.hasPassword || group.visibility === 'private') {
      setPasswordPromptGroup(group);
      return;
    }

    setActionGroupId(group.id);
    try {
      await joinGroup(group.id, currentUser, userProfile);
      setJoinedGroupIds((prev) => new Set([...prev, group.id]));
      toast.success(`Joined ${group.name}! 🎉`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to join group.');
    } finally {
      setActionGroupId(null);
    }
  };

  const handleLeave = async (group: CampusGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || actionGroupId) return;
    setActionGroupId(group.id);

    try {
      await leaveGroup(group.id, currentUser.uid);
      setJoinedGroupIds((prev) => {
        const next = new Set(prev);
        next.delete(group.id);
        return next;
      });
      setGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, memberCount: Math.max(0, g.memberCount - 1) } : g))
      );
      toast.success(`Left ${group.name}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave group.');
    } finally {
      setActionGroupId(null);
    }
  };

  const getGroupTypeBadge = (type: CampusGroupType) => {
    switch (type) {
      case 'department':
        return { color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', label: 'Department' };
      case 'batch':
        return { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Batch' };
      case 'campus':
        return { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', label: 'Campus' };
      case 'community':
      default:
        return { color: 'bg-sky-500/10 text-sky-400 border-sky-500/20', label: 'Community' };
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-slate-900/80 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-sky-500/20 via-purple-500/20 to-pink-500/20 rounded-full blur-3xl -z-0 pointer-events-none animate-gradient-x animate-float-slow opacity-70" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 border border-sky-500/30 rounded-full text-xs font-semibold text-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.2)]">
              <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
              <span>Campus Community Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-sky-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
              Campus Groups & Clubs
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Discover departments, graduation batches, tech societies, and student communities. Join public groups or enter a private pass code.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setIsJoinCodeModalOpen(true)}
              className="px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs rounded-2xl shadow-[0_0_12px_rgba(251,191,36,0.15)] hover:-translate-y-0.5 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Key className="w-4 h-4 text-amber-400" />
              <span>Join with Pass Code</span>
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-black text-xs rounded-2xl shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:-translate-y-0.5 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create Group</span>
            </button>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Category Tabs */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search groups by name, category, department, or batch..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors shadow-inner"
            />
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: 'All Groups', icon: Globe },
            { id: 'campus', label: 'Campus', icon: Building2 },
            { id: 'department', label: 'Departments', icon: GraduationCap },
            { id: 'batch', label: 'Batches', icon: Users },
            { id: 'community', label: 'Communities', icon: Sparkles },
            { id: 'my_groups', label: `Joined (${joinedGroupIds.size})`, icon: Check },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as FilterTab)}
                className={`px-4 py-2 rounded-xl border text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all ${
                  active
                    ? 'bg-sky-500/10 border-sky-500/40 text-sky-400 shadow-md'
                    : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Group Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Groups Found</h3>
          <p className="text-slate-400 text-xs max-w-sm mx-auto">
            No campus groups match your search criteria or category filter. Try clearing filters or create a new group.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-sky-500 text-slate-950 font-bold text-xs rounded-xl"
          >
            Create Campus Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {groups.map((group) => {
            const isOwner = Boolean(currentUser && (group.createdBy === currentUser.uid || (group as any).ownerId === currentUser.uid));
            const isOwnerOrAdmin = Boolean(currentUser && (isOwner || isAdmin));
            const isJoined = joinedGroupIds.has(group.id) || isOwner;
            const badge = getGroupTypeBadge(group.type);
            const isPrivate = group.visibility === 'private';

            return (
              <div
                key={group.id}
                onClick={() => navigate(`/groups/${group.id}`)}
                className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800/90 hover:border-sky-500/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/10 rounded-3xl p-5 shadow-xl flex flex-col justify-between cursor-pointer group transition-all duration-200 ease-out relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-500/30 text-sky-300 font-extrabold flex items-center justify-center text-sm shrink-0">
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-extrabold text-white truncate group-hover:text-sky-400 transition-colors">
                          {group.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${badge.color}`}>
                            {group.category || badge.label}
                          </span>

                          <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                            {isPrivate ? (
                              <Lock className="w-3 h-3 text-amber-400" />
                            ) : (
                              <Globe className="w-3 h-3 text-emerald-400" />
                            )}
                            <span>{isPrivate ? 'Private' : 'Public'}</span>
                          </span>

                          {group.hasPassword && (
                            <span className="px-2 py-0.5 rounded-full border border-sky-500/20 bg-sky-500/10 text-sky-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                              <Key className="w-2.5 h-2.5" />
                              <span>Password</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isOwnerOrAdmin && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteGroup(group, e)}
                        disabled={actionGroupId === group.id}
                        title="Delete Group Permanently"
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0"
                      >
                        {actionGroupId === group.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {group.description || 'Campus community group for collaborative discussions and activities.'}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-semibold text-slate-200">{group.memberCount || 1}</span>
                    <span>members</span>
                  </div>

                  {isOwner ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/groups/${group.id}`);
                      }}
                      className="px-3.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                    >
                      <span>Open (Owner)</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : isJoined ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleLeave(group, e)}
                        disabled={actionGroupId === group.id}
                        title="Leave Group"
                        className="px-2.5 py-1.5 bg-slate-950 hover:bg-rose-500/10 hover:text-rose-400 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 transition-colors"
                      >
                        {actionGroupId === group.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>Leave</span>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/groups/${group.id}`);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                      >
                        <span>Open</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : isPrivate || group.hasPassword ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPasswordPromptGroup(group);
                      }}
                      className="px-3.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Pass Code</span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleJoinPublic(group, e)}
                      disabled={actionGroupId === group.id}
                      className="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1 transition-all"
                    >
                      {actionGroupId === group.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>Join Group</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onGroupCreated={(newGroup) => {
          setGroups((prev) => [newGroup, ...prev]);
          setJoinedGroupIds((prev) => new Set([...prev, newGroup.id]));
          loadGroupsAndFilter();
        }}
      />

      <JoinGroupByCodeModal
        isOpen={isJoinCodeModalOpen}
        onClose={() => setIsJoinCodeModalOpen(false)}
        initialCode={initialJoinCode}
        onJoined={(groupId) => {
          setJoinedGroupIds((prev) => new Set([...prev, groupId]));
          loadGroupsAndFilter();
        }}
      />

      <JoinGroupWithPasswordModal
        isOpen={passwordPromptGroup !== null}
        onClose={() => setPasswordPromptGroup(null)}
        group={passwordPromptGroup}
        onJoined={(groupId) => {
          setJoinedGroupIds((prev) => new Set([...prev, groupId]));
          setGroups((prev) =>
            prev.map((g) => (g.id === groupId ? { ...g, memberCount: g.memberCount + 1 } : g))
          );
        }}
      />
    </div>
  );
};
