import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getPublicGroups,
  getUserGroupIds,
  joinGroup,
  leaveGroup,
  seedStandardCampusGroups,
} from '../../services/groupService';
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
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

import { CreateGroupModal } from './CreateGroupModal';

export const GroupsPage: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<CampusGroup[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | CampusGroupType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionGroupId, setActionGroupId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [allGroups, myGroupIds] = await Promise.all([
        getPublicGroups(),
        getUserGroupIds(currentUser.uid),
      ]);

      setGroups(allGroups);
      setJoinedGroupIds(new Set(myGroupIds));
    } catch (err) {
      toast.error('Failed to load campus groups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleJoin = async (group: CampusGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || actionGroupId) return;
    setActionGroupId(group.id);

    try {
      await joinGroup(group.id, currentUser, userProfile);
      setJoinedGroupIds((prev) => new Set([...prev, group.id]));
      setGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, memberCount: g.memberCount + 1 } : g))
      );
      toast.success(`Joined ${group.name}`);
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

  const handleSeedDefaults = async () => {
    if (!currentUser || userProfile?.role !== 'admin') return;
    toast.loading('Seeding standard campus groups...', { id: 'seed-groups' });
    try {
      await seedStandardCampusGroups(currentUser, userProfile);
      toast.success('Standard campus groups initialized!', { id: 'seed-groups' });
      await loadData();
    } catch (err: any) {
      toast.error('Failed to seed groups.', { id: 'seed-groups' });
    }
  };

  const filteredGroups = groups.filter((g) => {
    const matchesTab = activeTab === 'all' || g.type === activeTab;
    const matchesSearch =
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 py-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white">Campus Groups</h1>
            <p className="text-[11px] text-slate-400">Discover departments, batches & communities</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Group</span>
          </button>

          {userProfile?.role === 'admin' && (
            <button
              onClick={handleSeedDefaults}
              className="px-3.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Init Groups</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Search & Tabs */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search departments, batches, or community groups..."
              className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-2xl text-white text-xs placeholder:text-slate-500 focus:outline-none transition-all"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'all', label: 'All Groups', icon: <Users className="w-3.5 h-3.5" /> },
              { id: 'campus', label: 'Campus', icon: <Globe className="w-3.5 h-3.5" /> },
              { id: 'department', label: 'Departments', icon: <Building2 className="w-3.5 h-3.5" /> },
              { id: 'batch', label: 'Batches', icon: <GraduationCap className="w-3.5 h-3.5" /> },
              { id: 'community', label: 'Communities', icon: <Sparkles className="w-3.5 h-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Group Grid */}
        {loading ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-3 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading campus groups...</span>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-3">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-xs font-semibold">No groups match your search or filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => {
              const isJoined = joinedGroupIds.has(group.id);
              const isBusy = actionGroupId === group.id;

              return (
                <div
                  key={group.id}
                  onClick={() => navigate(`/groups/${group.id}`)}
                  className="p-5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                        {group.type === 'department' ? (
                          <Building2 className="w-5 h-5" />
                        ) : group.type === 'batch' ? (
                          <GraduationCap className="w-5 h-5" />
                        ) : group.type === 'campus' ? (
                          <Globe className="w-5 h-5" />
                        ) : (
                          <Sparkles className="w-5 h-5 text-purple-400" />
                        )}
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px] font-bold uppercase">
                        {group.type}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-white text-sm group-hover:text-sky-400 transition-colors">
                        {group.name}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-snug">
                        {group.description || 'Campus student group'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-sky-400" />
                      <span>{group.memberCount} members</span>
                    </span>

                    {isJoined ? (
                      <button
                        onClick={(e) => handleLeave(group, e)}
                        disabled={isBusy}
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-rose-500/20 text-emerald-400 hover:text-rose-400 border border-emerald-500/30 hover:border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Joined</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleJoin(group, e)}
                        disabled={isBusy}
                        className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Join</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onGroupCreated={() => loadData()}
      />
    </div>
  );
};
