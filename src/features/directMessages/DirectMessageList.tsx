import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DirectConversation } from '../../types/directMessage';
import { useAuth } from '../../hooks/useAuth';
import { getOrCreateConversation, deleteConversation } from '../../services/directMessageService';
import { subscribeToMemberPresence } from '../../services/presenceService';
import { NewDirectMessageModal } from './NewDirectMessageModal';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { 
  MessageSquare, 
  Search, 
  Plus, 
  RefreshCw, 
  User,
  Trash2
} from 'lucide-react';

type ListTab = 'All' | 'Requests' | 'Archived';

export const DirectMessageList: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState<ListTab>('All');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Listen to conversations in realtime
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    const convsRef = collection(db, 'conversations');
    const q = query(
      convsRef,
      where('participantIds', 'array-contains', currentUser.uid),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          updatedAt: data.updatedAt || data.createdAt || null
        } as DirectConversation;
      });

      // Sort in-memory to avoid index requirement
      list.sort((a, b) => {
        const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
        const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
        return tB - tA;
      });

      setConversations(list);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to conversations:', err);
      toast.error('Failed to load chats.');
      setLoading(false);
    });

    import('../../services/activityStateService').then(({ markScopeAsRead }) => {
      markScopeAsRead(currentUser.uid, 'messages').catch(() => {});
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Subscribe to presence of conversation partners
  useEffect(() => {
    if (!currentUser || conversations.length === 0) return;
    const targetUids = conversations
      .map((c) => c.participantIds.find((id) => id !== currentUser.uid))
      .filter((id): id is string => !!id);

    if (targetUids.length === 0) return;
    const unsubscribe = subscribeToMemberPresence(targetUids, (statusMap) => {
      setOnlineMap(statusMap);
    });
    return () => unsubscribe();
  }, [conversations, currentUser]);

  const handleUserSelected = async (targetUid: string, targetName: string) => {
    if (!currentUser) return;
    try {
      const conv = await getOrCreateConversation(targetUid, currentUser, targetName);
      navigate(`/messages/${conv.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to open conversation.');
    }
  };

  const filteredConversations = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    return conversations.filter((c) => {
      const uid = currentUser?.uid || '';
      const isArchived = c.participantMeta?.[uid]?.archived === true;

      if (selectedTab === 'Requests' && c.status !== 'pending') return false;
      if (selectedTab === 'Archived' && !isArchived) return false;
      if (selectedTab === 'All' && isArchived) return false;

      if (qLower) {
        const names = Object.values(c.participantNames || {}).join(' ').toLowerCase();
        const preview = (c.lastMessagePreview || '').toLowerCase();
        if (!names.includes(qLower) && !preview.includes(qLower)) return false;
      }

      return true;
    });
  }, [conversations, selectedTab, searchQuery, currentUser]);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <MessageSquare className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Direct Messages</h1>
          </div>
          <p className="text-xs text-slate-400">
            Private 1-on-1 conversations, message requests, and student connections.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Private Message</span>
        </button>
      </div>

      {/* Search Bar & Tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search private conversations..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          {(['All', 'Requests', 'Archived'] as ListTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                selectedTab === tab
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-md'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation List */}
      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
          <span>Loading conversations...</span>
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="p-12 bg-slate-900/60 border border-slate-800 rounded-3xl text-center space-y-3">
          <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">No Private Conversations</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {selectedTab === 'Requests' ? 'No pending message requests.' : 'Start a private conversation with a campus peer!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredConversations.map((conv) => {
            const uid = currentUser?.uid || '';
            const targetUid = conv.participantIds.find((id) => id !== uid);
            const targetName = targetUid && conv.participantNames
              ? conv.participantNames[targetUid] || 'Campus Peer'
              : 'Campus Peer';

            const isPending = conv.status === 'pending';

            const isOnline = targetUid ? onlineMap[targetUid] : false;
            const myMeta = conv.participantMeta?.[uid];
            const isUnread =
              conv.lastMessageSenderId !== uid &&
              conv.lastMessageId &&
              (!myMeta?.lastReadAt ||
                (conv.lastMessageAt?.toMillis ? conv.lastMessageAt.toMillis() : new Date(conv.lastMessageAt).getTime()) >
                (myMeta.lastReadAt?.toMillis ? myMeta.lastReadAt.toMillis() : new Date(myMeta.lastReadAt).getTime()));

            return (
              <div
                key={conv.id}
                onClick={() => navigate(`/messages/${conv.id}`)}
                className={`p-4 bg-slate-900/80 hover:bg-slate-800/80 border rounded-2xl flex items-center justify-between gap-4 cursor-pointer transition-all shadow-md ${
                  isUnread ? 'border-indigo-500/50' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3.5 truncate">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
                      <User className="w-5 h-5" />
                    </div>
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                    )}
                  </div>

                  <div className="truncate space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-xs font-bold truncate ${isUnread ? 'text-white' : 'text-slate-200'}`}>
                        {targetName}
                      </h4>
                      {isPending && (
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full text-[10px] font-bold">
                          REQUEST
                        </span>
                      )}
                      {isUnread && (
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                      )}
                    </div>

                    <p className={`text-xs truncate ${isUnread ? 'text-slate-200 font-semibold' : 'text-slate-400'}`}>
                      {conv.lastMessagePreview || 'No messages yet.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-[10px] text-slate-500 font-mono">
                    {conv.updatedAt
                      ? typeof conv.updatedAt.toDate === 'function'
                        ? conv.updatedAt.toDate().toLocaleDateString()
                        : new Date(conv.updatedAt).toLocaleDateString()
                      : ''}
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete chat with ${targetName}?`)) {
                        try {
                          await deleteConversation(conv.id, currentUser!);
                          toast.success('Chat deleted.');
                        } catch (err) {
                          toast.error('Failed to delete chat.');
                        }
                      }
                    }}
                    className="p-2 text-slate-500 hover:text-rose-400 bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/20 rounded-xl transition-all"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Conversation Modal */}
      <NewDirectMessageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectUser={handleUserSelected}
      />
    </div>
  );
};
