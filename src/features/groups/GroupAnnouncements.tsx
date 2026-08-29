import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getGroupAnnouncements, pinAnnouncement } from '../../services/groupAnnouncementService';
import { canCreateAnnouncement } from '../../services/groupPermissionService';
import { CreateAnnouncementModal } from './CreateAnnouncementModal';
import { Megaphone, Plus, Pin, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GroupAnnouncement, GroupRole } from '../../types/group';

interface GroupAnnouncementsProps {
  groupId: string;
  userRole?: GroupRole;
}

export const GroupAnnouncements: React.FC<GroupAnnouncementsProps> = ({ groupId, userRole = 'member' }) => {
  const { userProfile } = useAuth();
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadAnnouncements = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const list = await getGroupAnnouncements(groupId, 20);
      setAnnouncements(list);
    } catch (err) {
      console.error('Failed to load group announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, [groupId]);

  const handleTogglePin = async (ann: GroupAnnouncement) => {
    if (!ann.id) return;
    try {
      await pinAnnouncement(groupId, ann.id, !ann.pinned);
      toast.success(ann.pinned ? 'Announcement unpinned.' : 'Announcement pinned.');
      loadAnnouncements();
    } catch {
      toast.error('Failed to toggle announcement pin status.');
    }
  };

  const canCreate = canCreateAnnouncement(userRole, userProfile?.role);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-amber-400" />
          <span>Official Announcements</span>
        </h2>

        {canCreate && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Announcement</span>
          </button>
        )}
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
          <span>Loading announcements...</span>
        </div>
      ) : announcements.length === 0 ? (
        <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
          No announcements published yet.
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className={`p-5 rounded-3xl border space-y-2.5 transition-all ${
                ann.pinned || ann.priority === 'urgent'
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(userRole === 'owner' || userRole === 'admin') ? (
                    <button
                      onClick={() => handleTogglePin(ann)}
                      className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-amber-400 transition-colors"
                      title={ann.pinned ? 'Unpin Announcement' : 'Pin Announcement'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${ann.pinned ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                  ) : (
                    ann.pinned && <Pin className="w-4 h-4 text-amber-400" />
                  )}
                  <span className="font-bold text-xs text-white">{ann.title}</span>
                </div>
                {ann.priority && (
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${
                      ann.priority === 'urgent'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : ann.priority === 'important'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {ann.priority}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{ann.content}</p>

              <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>By: {ann.creatorName || 'Admin'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      <CreateAnnouncementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        groupId={groupId}
        onCreated={loadAnnouncements}
      />
    </div>
  );
};
