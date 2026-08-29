import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getPublicGroupsPage,
  getUserGroupIds,
  joinGroup,
  leaveGroup,
} from '../../services/groupService';
import type { CampusGroup } from '../../types/group';
import {
  Plus,
  RefreshCw,
  Lock,
  ChevronRight,
  Award
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CreateGroupModal } from '../groups/CreateGroupModal';

type FilterTab = 'all' | 'clubs' | 'organizations' | 'my_clubs';

export const ClubsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [clubs, setClubs] = useState<CampusGroup[]>([]);
  const [joinedClubIds, setJoinedClubIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionClubId, setActionClubId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [myGroupIds, publicResult] = await Promise.all([
        getUserGroupIds(currentUser.uid),
        getPublicGroupsPage(40),
      ]);

      setJoinedClubIds(new Set(myGroupIds));
      // Filter only groups of type 'club' or 'organization'
      const clubList = publicResult.groups.filter(
        (g) => g.type === 'club' || g.type === 'organization'
      );
      setClubs(clubList);
    } catch {
      toast.error('Failed to load clubs database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleJoin = async (clubId: string) => {
    if (!currentUser) return;
    setActionClubId(clubId);
    try {
      await joinGroup(clubId, currentUser);
      setJoinedClubIds((prev) => {
        const next = new Set(prev);
        next.add(clubId);
        return next;
      });
      toast.success('Successfully joined club!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to join club.');
    } finally {
      setActionClubId(null);
    }
  };

  const handleLeave = async (clubId: string) => {
    if (!currentUser) return;
    setActionClubId(clubId);
    try {
      await leaveGroup(clubId, currentUser.uid);
      setJoinedClubIds((prev) => {
        const next = new Set(prev);
        next.delete(clubId);
        return next;
      });
      toast.success('Left club workspace.');
    } catch {
      toast.error('Failed to leave club.');
    } finally {
      setActionClubId(null);
    }
  };

  const filteredClubs = clubs.filter((c) => {
    // 1. Tab filter
    if (activeTab === 'clubs' && c.type !== 'club') return false;
    if (activeTab === 'organizations' && c.type !== 'organization') return false;
    if (activeTab === 'my_clubs' && !joinedClubIds.has(c.id)) return false;

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchDesc = c.description.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }

    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header banner */}
      <div className="relative p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Award className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-white tracking-tight uppercase font-mono">Clubs & Organizations</h1>
          </div>
          <p className="text-xs text-slate-400">
            Discover student associations, cultural clubs, and technical bodies on campus.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Club</span>
          </button>
          <button
            onClick={loadData}
            className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-300 rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs / Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none text-xs">
          {[
            { id: 'all', label: 'All Associations' },
            { id: 'clubs', label: 'Student Clubs' },
            { id: 'organizations', label: 'College Bodies' },
            { id: 'my_clubs', label: 'My Subscriptions' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as FilterTab)}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${
                activeTab === t.id
                  ? 'bg-purple-500/10 border border-purple-500/30 text-purple-400'
                  : 'bg-slate-900/40 border border-slate-850 text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search clubs & societies..."
          className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/40 w-full sm:w-64"
        />
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
          <span>Loading clubs registry...</span>
        </div>
      ) : filteredClubs.length === 0 ? (
        <div className="p-16 text-center text-slate-500 text-xs italic bg-slate-900 border border-slate-850 rounded-3xl">
          No clubs or organizations found matching filter coordinates.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClubs.map((club) => {
            const isJoined = joinedClubIds.has(club.id);
            const isPrivate = club.visibility === 'private';

            return (
              <div
                key={club.id}
                className="p-5 bg-slate-900 border border-slate-850 hover:border-purple-500/25 rounded-3xl flex flex-col justify-between gap-4 transition-all relative overflow-hidden group shadow-md"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 bg-slate-950 border border-slate-850 text-purple-400 rounded-full font-mono text-[9px] font-bold uppercase">
                      {club.type}
                    </span>
                    {isPrivate && (
                      <span className="text-slate-500" title="Private Group">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-purple-400 transition-colors">
                    {club.name}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {club.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {club.memberCount || 0} Members
                  </span>

                  <div className="flex gap-2">
                    {isJoined ? (
                      <button
                        onClick={() => handleLeave(club.id)}
                        disabled={actionClubId === club.id}
                        className="px-3 py-1 bg-slate-950 border border-slate-850 hover:border-rose-500/20 hover:text-rose-400 text-slate-450 font-bold text-[10px] uppercase rounded-lg transition-all"
                      >
                        Joined
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoin(club.id)}
                        disabled={actionClubId === club.id}
                        className="px-3 py-1 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-[10px] uppercase rounded-lg transition-all shadow-md"
                      >
                        Join
                      </button>
                    )}

                    <button
                      onClick={() => navigate(`/clubs/${club.id}`)}
                      className="p-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Club Modal */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onGroupCreated={loadData}
      />
    </div>
  );
};
