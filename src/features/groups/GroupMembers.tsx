import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getGroupMembersPage, leaveGroup } from '../../services/groupService';
import type { GroupMember } from '../../types/group';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Users, UserX, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface GroupMembersProps {
  groupId: string;
  isAdmin?: boolean;
}

export const GroupMembers: React.FC<GroupMembersProps> = ({ groupId, isAdmin = false }) => {
  const { currentUser } = useAuth();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const loadMembers = async (isInitial = true) => {
    if (!groupId) return;
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const result = await getGroupMembersPage(groupId, 20, isInitial ? null : lastDoc);
      setMembers((prev) => (isInitial ? result.members : [...prev, ...result.members]));
      setLastDoc(result.lastDoc);
      setHasMore(result.members.length === 20 && result.lastDoc !== null);
    } catch (err) {
      toast.error('Failed to load group members.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadMembers(true);
  }, [groupId]);

  const handleRemoveMember = async (targetUid: string) => {
    if (!isAdmin || !currentUser) return;
    try {
      await leaveGroup(groupId, targetUid);
      setMembers((prev) => prev.filter((m) => m.uid !== targetUid));
      toast.success('Member removed from group.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-sky-400" />
          <span>Group Members</span>
        </h3>
        <span className="text-[11px] font-mono text-slate-400">Max 50 / page</span>
      </div>

      {loading ? (
        <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl flex items-center justify-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Loading members...</span>
        </div>
      ) : members.length === 0 ? (
        <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl text-center text-slate-400 text-xs">
          No members found in this group yet.
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.uid}
              className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {member.photoURL ? (
                  <img
                    src={member.photoURL}
                    alt={member.displayName || 'Member'}
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 text-xs font-bold shrink-0">
                    {(member.displayName || member.uid).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs truncate">
                      {member.displayName || `Student (${member.uid.slice(0, 6)})`}
                    </span>
                    {member.role === 'admin' && (
                      <span className="px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-[9px] font-bold uppercase rounded">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {isAdmin && member.uid !== currentUser?.uid && (
                <button
                  onClick={() => handleRemoveMember(member.uid)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                  title="Remove Member"
                >
                  <UserX className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => loadMembers(false)}
              disabled={loadingMore}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-xs font-semibold text-sky-400 transition-all flex items-center justify-center gap-2"
            >
              {loadingMore ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Load More Members</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
