import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { StoryView } from '../../types/story';
import { getStoryViewers } from '../../services/storyService';
import { X, Eye, RefreshCw, User, ChevronRight } from 'lucide-react';

interface StoryViewersProps {
  storyId: string;
  onClose: () => void;
}

export const StoryViewers: React.FC<StoryViewersProps> = ({ storyId, onClose }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [viewers, setViewers] = useState<StoryView[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!storyId || !currentUser) return;
    const fetchViewers = async () => {
      setLoading(true);
      try {
        const list = await getStoryViewers(storyId, currentUser);
        setViewers(list);
      } catch (err) {
        console.error('Error fetching story viewers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchViewers();
  }, [storyId, currentUser]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 z-10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-400" />
            <span>Story Viewers ({viewers.length})</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
          {loading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Loading viewers...</span>
            </div>
          ) : viewers.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500 italic">No views yet.</p>
          ) : (
            viewers.map((viewer, idx) => (
              <div
                key={viewer.userId || idx}
                onClick={() => {
                  if (viewer.userId) {
                    onClose();
                    navigate(`/profile/${viewer.userId}`);
                  }
                }}
                className="flex items-center justify-between p-2.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-indigo-500/40 rounded-2xl cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs">
                    {viewer.userAvatar ? (
                      <img src={viewer.userAvatar} alt={viewer.userName} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">{viewer.userName || 'Student'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span className="text-[10px] font-mono">
                    {viewer.viewedAt
                      ? typeof viewer.viewedAt.toDate === 'function'
                        ? viewer.viewedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : new Date(viewer.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
