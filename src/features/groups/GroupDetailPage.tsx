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
import { GroupMembers } from './GroupMembers';
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
  ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

export const GroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<CampusGroup | null>(null);
  const [isMember, setIsMember] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionBusy, setActionBusy] = useState<boolean>(false);

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

  useEffect(() => {
    loadGroupDetails();
  }, [groupId, currentUser]);

  const handleToggleMembership = async () => {
    if (!group || !currentUser || actionBusy) return;
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
              {group?.type || 'Group'} Metadata
            </p>
          </div>
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
                    <span className="text-xs text-slate-400 font-mono uppercase">
                      {group.type} • {group.visibility}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleToggleMembership}
                  disabled={actionBusy}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                    isMember
                      ? 'bg-emerald-500/10 hover:bg-rose-500/20 text-emerald-400 hover:text-rose-400 border border-emerald-500/30 hover:border-rose-500/30'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                  }`}
                >
                  {isMember ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Joined</span>
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

              <div className="flex items-center gap-6 pt-2 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>{group.memberCount} Members</span>
                </div>
                {group.batchYear && (
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-amber-400" />
                    <span>Batch {group.batchYear}</span>
                  </div>
                )}
                {group.departmentId && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-purple-400" />
                    <span>Dept {group.departmentId.toUpperCase()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Paginated Group Members Component */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl">
              <GroupMembers groupId={group.id} isAdmin={userProfile?.role === 'admin'} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
