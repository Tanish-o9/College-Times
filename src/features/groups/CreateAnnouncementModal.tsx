import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { createGroupAnnouncement } from '../../services/groupAnnouncementService';
import { Megaphone, X, Send, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface CreateAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  onCreated?: () => void;
}

export const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({
  isOpen,
  onClose,
  groupId,
  onCreated,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !currentUser || !title.trim() || !content.trim() || submitting) return;

    setSubmitting(true);
    try {
      await createGroupAnnouncement(
        groupId,
        title.trim(),
        content.trim(),
        priority,
        currentUser,
        userProfile
      );
      toast.success(priority === 'urgent' ? 'Urgent announcement published & FCM broadcast sent!' : 'Announcement published!');
      setTitle('');
      setContent('');
      setPriority('normal');
      onClose();
      if (onCreated) onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-amber-400" />
          <span>New Group Announcement</span>
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Message Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Write official announcement..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-amber-500/50 resize-none"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Priority Level</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'normal' | 'important' | 'urgent')}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="normal">Normal (In-app Feed & Timeline)</option>
              <option value="important">Important (Pinned Banner)</option>
              <option value="urgent">Urgent (FCM Push Topic Broadcast)</option>
            </select>
          </div>

          {priority === 'urgent' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Urgent announcements send 1 FCM push broadcast to all group members with zero per-user notification writes.</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Publish Announcement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
