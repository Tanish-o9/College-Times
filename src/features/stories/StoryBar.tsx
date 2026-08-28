import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { GroupedAuthorStories } from '../../types/story';
import { getActiveCampusStories } from '../../services/storyService';
import { StoryViewer } from './StoryViewer';
import { CreateStoryModal } from './CreateStoryModal';
import { Plus, User, ChevronLeft, ChevronRight } from 'lucide-react';

export const StoryBar: React.FC = () => {
  const { currentUser } = useAuth();
  const [groupedAuthors, setGroupedAuthors] = useState<GroupedAuthorStories[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupedAuthorStories | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Scroll container ref for drag-scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const fetchStories = async () => {
    setLoading(true);
    try {
      const list = await getActiveCampusStories(currentUser || undefined);
      setGroupedAuthors(list);
    } catch (err) {
      console.error('Error loading stories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, [currentUser]);

  // Update scroll arrow visibility
  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    return () => el.removeEventListener('scroll', updateScrollButtons);
  }, [groupedAuthors, loading]);

  // Mouse drag-scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current = true;
    startX.current = e.pageX - el.offsetLeft;
    scrollLeft.current = el.scrollLeft;
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (scrollRef.current) {
      scrollRef.current.style.cursor = 'grab';
      scrollRef.current.style.userSelect = '';
    }
  };

  const scrollBy = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 200 : -200, behavior: 'smooth' });
  };

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 shadow-xl backdrop-blur-xl mb-6 relative">
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scrollBy('left')}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-full flex items-center justify-center text-slate-300 shadow-lg transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scrollBy('right')}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-full flex items-center justify-center text-slate-300 shadow-lg transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        className="flex items-start gap-4 overflow-x-auto pb-1 select-none"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          cursor: 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Your Story (+) Button */}
        <div
          onClick={() => setIsCreateOpen(true)}
          className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0"
        >
          <div className="relative w-14 h-14 rounded-full bg-slate-950 border-2 border-indigo-500/40 p-0.5 group-hover:border-indigo-400 transition-all flex items-center justify-center">
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Your Story"
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                <User className="w-6 h-6" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center border-2 border-slate-900 shadow-md">
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors">
            Your Story
          </span>
        </div>

        {/* Active Campus Story Rings */}
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="w-14 h-14 rounded-full bg-slate-800/60 animate-pulse" />
                <div className="w-10 h-2.5 bg-slate-800/60 rounded-full animate-pulse" />
              </div>
            ))}
          </>
        ) : (
          groupedAuthors.map((group) => (
            <div
              key={group.authorId}
              onClick={() => setSelectedGroup(group)}
              className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0"
            >
              <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-pink-500 via-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-all">
                <div className="w-full h-full rounded-full bg-slate-950 p-0.5">
                  {group.authorAvatar ? (
                    <img
                      src={group.authorAvatar}
                      alt={group.authorName}
                      className="w-full h-full rounded-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
                      {group.authorName.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-300 truncate max-w-[64px] text-center">
                {group.authorName.split(' ')[0]}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Story Player Modal */}
      {selectedGroup && (
        <StoryViewer
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onStoryDeleted={fetchStories}
        />
      )}

      {/* Story Creation Modal */}
      <CreateStoryModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={fetchStories}
      />
    </div>
  );
};
