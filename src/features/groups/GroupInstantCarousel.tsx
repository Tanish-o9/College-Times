import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { subscribeToActiveGroupInstants } from '../../services/groupInstantService';
import type { GroupInstant } from '../../types/group';
import { CreateGroupInstantModal } from './CreateGroupInstantModal';
import { GroupInstantViewer } from './GroupInstantViewer';
import { Plus, Sparkles } from 'lucide-react';

interface GroupInstantCarouselProps {
  groupId: string;
  groupName: string;
  isMember: boolean;
}

export const GroupInstantCarousel: React.FC<GroupInstantCarouselProps> = ({
  groupId,
  groupName,
  isMember: _isMember,
}) => {
  const { currentUser } = useAuth();

  const [instants, setInstants] = useState<GroupInstant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [viewedIds, setViewedIds] = useState<Set<string>>(() => {
    try {
      const storageKey = `ct_viewed_moments_${currentUser?.uid || 'guest'}`;
      const saved = localStorage.getItem(storageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markAsViewed = (id: string) => {
    setViewedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        const storageKey = `ct_viewed_moments_${currentUser?.uid || 'guest'}`;
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [selectedViewerIndex, setSelectedViewerIndex] = useState<number>(0);
  const [hasNewInstantsPill, setHasNewInstantsPill] = useState<boolean>(false);

  useEffect(() => {
    if (!groupId) return;

    setLoading(true);
    const unsubscribe = subscribeToActiveGroupInstants(
      groupId,
      (freshInstants) => {
        setInstants((prev) => {
          if (prev.length > 0 && freshInstants.length > prev.length) {
            setHasNewInstantsPill(true);
          }
          return freshInstants;
        });
        setLoading(false);
      },
      20
    );

    return () => unsubscribe();
  }, [groupId]);

  const handleOpenViewer = (index: number) => {
    setSelectedViewerIndex(index);
    setHasNewInstantsPill(false);
    setIsViewerOpen(true);
  };

  const unviewedInstants = instants.filter((m) => {
    const isOwner = m.senderId === currentUser?.uid;

    // OWNER ALWAYS SEES THEIR OWN CREATED MOMENT (so they can manage/delete it)
    if (isOwner) return true;

    // FOR OTHER MEMBERS: ONE-VIEW ONLY RULE
    const isViewedLocally = viewedIds.has(m.id);
    const isViewedInFirestore = Array.isArray(m.viewedBy) && m.viewedBy.includes(currentUser?.uid || '');
    return !isViewedLocally && !isViewedInFirestore;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Group Moments (Permanent)</span>
        </div>

        {hasNewInstantsPill && (
          <button
            onClick={() => handleOpenViewer(0)}
            className="px-2.5 py-1 bg-purple-500 text-white font-bold text-[10px] rounded-full animate-bounce shadow-lg flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>New Moments</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
        {/* Share Instant Trigger */}
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex flex-col items-center gap-1.5 shrink-0 group"
        >
            <div className="w-14 h-14 rounded-full bg-slate-900 border-2 border-dashed border-purple-500/50 group-hover:border-purple-400 text-purple-400 flex items-center justify-center transition-all shadow-md">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 group-hover:text-purple-300">
              + Moment
            </span>
          </button>

        {/* Instants Roster */}
        {loading ? (
          <div className="flex items-center gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 animate-pulse shrink-0" />
            ))}
          </div>
        ) : unviewedInstants.length === 0 ? (
          <div className="text-[11px] text-slate-500 italic py-3">
            No unviewed group moments right now. Be the first to share a moment!
          </div>
        ) : (
          unviewedInstants.map((instant, idx) => (
            <button
              key={instant.id}
              onClick={() => handleOpenViewer(idx)}
              className="flex flex-col items-center gap-1.5 shrink-0 group"
            >
              <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-purple-500 via-indigo-500 to-sky-400 shadow-lg transition-transform group-hover:scale-105">
                <div className="w-full h-full rounded-full bg-slate-950 p-0.5 overflow-hidden">
                  {instant.senderAvatar ? (
                    <img src={instant.senderAvatar} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center">
                      {instant.senderName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-300 truncate max-w-[60px]">
                {instant.senderName.split(' ')[0]}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Modals */}
      <CreateGroupInstantModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        groupId={groupId}
        groupName={groupName}
      />

      <GroupInstantViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        instants={unviewedInstants}
        initialIndex={selectedViewerIndex}
        groupId={groupId}
        onInstantViewed={markAsViewed}
      />
    </div>
  );
};
