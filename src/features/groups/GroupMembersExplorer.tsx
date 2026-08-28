import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGroupMembersPage, searchGroupMembers } from '../../services/groupMemberManagementService';
import { getOrCreateConversation } from '../../services/directMessageService';
import { useAuth } from '../../hooks/useAuth';
import type { GroupMember, GroupRole } from '../../types/group';
import { Search, MessageSquare, RefreshCw } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface GroupMembersExplorerProps {
  groupId: string;
}

export const GroupMembersExplorer: React.FC<GroupMembersExplorerProps> = ({ groupId }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [roleFilter, setRoleFilter] = useState<GroupRole | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMembers = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const results = await searchGroupMembers(groupId, searchQuery.trim(), 20);
        setMembers(results);
        setLastDoc(null);
      } else {
        const filter = roleFilter === 'all' ? undefined : (roleFilter as GroupRole);
        const res = await getGroupMembersPage(groupId, 20, null, filter);
        setMembers(res.members);
        setLastDoc(res.lastDoc);
      }
    } catch (err) {
      console.error('Failed to load group members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [groupId, roleFilter, searchQuery]);

  const handleLoadMore = async () => {
    if (!groupId || !lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const filter = roleFilter === 'all' ? undefined : (roleFilter as GroupRole);
      const res = await getGroupMembersPage(groupId, 20, lastDoc, filter);
      setMembers((prev) => [...prev, ...res.members]);
      setLastDoc(res.lastDoc);
    } catch (err) {
      console.error('Failed to load more members:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search group members..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs w-full sm:w-auto scrollbar-none">
          {(['all', 'owner', 'admin', 'moderator', 'member'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl font-bold uppercase text-[10px] transition-all whitespace-nowrap ${
                roleFilter === r
                  ? 'bg-sky-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Roster List */}
      {loading ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Loading members roster...</span>
        </div>
      ) : members.length === 0 ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
          No members found matching filter.
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl divide-y divide-slate-800/60 overflow-hidden">
          {members.map((m) => (
            <div key={m.uid} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                {m.photoURL ? (
                  <img src={m.photoURL} alt={m.displayName || 'Member'} className="w-10 h-10 rounded-2xl object-cover border border-slate-700" />
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-sm">
                    {(m.displayName || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-bold text-white truncate max-w-xs">{m.displayName || 'Campus Student'}</h4>
                  <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase bg-slate-800 text-sky-300 inline-block mt-0.5">
                    {m.role || 'Member'}
                  </span>
                </div>
              </div>

              <button
                onClick={async () => {
                  if (!currentUser) {
                    toast.error('Log in to message group members.');
                    return;
                  }
                  try {
                    const conv = await getOrCreateConversation(m.uid, currentUser, m.displayName);
                    navigate(`/messages/${conv.id}`);
                  } catch (err) {
                    navigate('/messages');
                  }
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1 shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                <span>Message</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Button */}
      {lastDoc && !searchQuery && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 rounded-2xl transition-colors flex items-center justify-center gap-2"
        >
          {loadingMore ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
          <span>Load More Members</span>
        </button>
      )}
    </div>
  );
};
