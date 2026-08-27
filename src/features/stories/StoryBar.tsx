import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { GroupedAuthorStories } from '../../types/story';
import { getActiveCampusStories } from '../../services/storyService';
import { StoryViewer } from './StoryViewer';
import { CreateStoryModal } from './CreateStoryModal';
import { Plus, User } from 'lucide-react';

export const StoryBar: React.FC = () => {
  const { currentUser } = useAuth();
  const [groupedAuthors, setGroupedAuthors] = useState<GroupedAuthorStories[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupedAuthorStories | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

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

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 shadow-xl backdrop-blur-xl mb-6">
      <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-none">
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
          <div className="flex items-center gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-14 h-14 rounded-full bg-slate-800/60 animate-pulse shrink-0" />
            ))}
          </div>
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
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
                      {group.authorName.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-300 truncate max-w-[64px]">
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
