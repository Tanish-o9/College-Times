import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { shareContentToDM, shareContentToGroup, copyShareLink } from '../services/shareService';
import type { ShareableContent } from '../services/shareService';
import { getUserGroupIds, getGroupById } from '../services/groupService';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { X, Send, Link, MessageSquare, Users, Copy, Check, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: ShareableContent;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, content }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Targets lists
  const [dms, setDms] = useState<{ id: string; name: string }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);

  // Selection
  const [selectedTarget, setSelectedTarget] = useState<{ type: 'dm' | 'group'; id: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const loadTargets = async () => {
      setLoading(true);
      try {
        // 1. Fetch conversations (DMs)
        const convsRef = collection(db, 'conversations');
        const qDms = query(
          convsRef,
          where('participantIds', 'array-contains', currentUser.uid),
          limit(15)
        );
        const dmsSnap = await getDocs(qDms);
        const dmsList = dmsSnap.docs.map((docSnap) => {
          const data = docSnap.data();
          const targetUid = data.participantIds?.find((id: string) => id !== currentUser.uid);
          const targetName = targetUid && data.participantNames ? data.participantNames[targetUid] || 'Campus Student' : 'Campus Student';
          return {
            id: docSnap.id,
            name: targetName,
          };
        });
        setDms(dmsList);

        // 2. Fetch groups
        const groupIds = await getUserGroupIds(currentUser.uid);
        const groupsList = await Promise.all(
          groupIds.slice(0, 15).map(async (id) => {
            const group = await getGroupById(id);
            return {
              id,
              name: group?.name || 'Campus Group',
            };
          })
        );
        setGroups(groupsList);
      } catch (err) {
        console.error('Failed to load share targets:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTargets();
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    const success = await copyShareLink(content.deepLink);
    if (success) {
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy link.');
    }
  };

  const handleShare = async () => {
    if (!currentUser || !selectedTarget || sending) return;
    setSending(true);
    try {
      if (selectedTarget.type === 'dm') {
        await shareContentToDM(content, selectedTarget.id, currentUser);
        toast.success(`Shared to chat with ${dms.find((d) => d.id === selectedTarget.id)?.name}!`);
      } else {
        await shareContentToGroup(content, selectedTarget.id, currentUser);
        toast.success(`Shared to group ${groups.find((g) => g.id === selectedTarget.id)?.name}!`);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to share content.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>Share: {content.title}</span>
        </h3>

        {/* Copy Link Button */}
        <button
          onClick={handleCopyLink}
          className="w-full p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl flex items-center justify-between text-slate-300 transition-all text-xs"
        >
          <div className="flex items-center gap-2">
            <Link className="w-4 h-4 text-indigo-400" />
            <span>Copy shareable link</span>
          </div>
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-500" />}
        </button>

        <div className="border-t border-slate-800 pt-3 space-y-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Share Internally</span>

          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-4 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Loading recipients...</span>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {dms.length === 0 && groups.length === 0 && (
                <p className="text-xs text-slate-500 italic py-4 text-center">No active chats or groups found.</p>
              )}

              {/* Direct Messages List */}
              {dms.map((dm) => (
                <button
                  key={dm.id}
                  onClick={() => setSelectedTarget({ type: 'dm', id: dm.id })}
                  className={`w-full p-2.5 rounded-xl border text-xs text-left transition-all flex items-center gap-2 ${
                    selectedTarget?.type === 'dm' && selectedTarget.id === dm.id
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300 font-bold'
                      : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="truncate">{dm.name}</span>
                </button>
              ))}

              {/* Groups List */}
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedTarget({ type: 'group', id: group.id })}
                  className={`w-full p-2.5 rounded-xl border text-xs text-left transition-all flex items-center gap-2 ${
                    selectedTarget?.type === 'group' && selectedTarget.id === group.id
                      ? 'bg-purple-500/10 border-purple-500/40 text-purple-300 font-bold'
                      : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Users className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="truncate">{group.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={!selectedTarget || sending}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-500/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Share</span>
          </button>
        </div>
      </div>
    </div>
  );
};
