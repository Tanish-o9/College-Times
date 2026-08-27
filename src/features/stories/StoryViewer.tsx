import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { GroupedAuthorStories, Story } from '../../types/story';
import { recordStoryView, reactToStory, deleteStory } from '../../services/storyService';
import { StoryViewers } from './StoryViewers';
import toast from 'react-hot-toast';
import { 
  X, 
  Eye, 
  Trash2, 
  Send 
} from 'lucide-react';

interface StoryViewerProps {
  group: GroupedAuthorStories;
  onClose: () => void;
  onStoryDeleted: () => void;
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const StoryViewer: React.FC<StoryViewerProps> = ({
  group,
  onClose,
  onStoryDeleted,
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [isViewersOpen, setIsViewersOpen] = useState<boolean>(false);

  const activeStory: Story | undefined = group.stories[currentIndex];
  const isAuthor = currentUser?.uid === group.authorId;

  // Record view on story active
  useEffect(() => {
    if (activeStory && currentUser) {
      recordStoryView(activeStory.id, currentUser).catch(() => {});
    }
    setProgress(0);
  }, [currentIndex, activeStory, currentUser]);

  // 5-second progress timer
  useEffect(() => {
    if (isPaused || isViewersOpen || !activeStory) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < group.stories.length - 1) {
            setCurrentIndex((i) => i + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + 2; // 2% per 100ms = 5000ms duration
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused, isViewersOpen, currentIndex, group.stories.length, activeStory]);

  const handleNext = () => {
    if (currentIndex < group.stories.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleReact = async (emoji: string) => {
    if (!activeStory || !currentUser) return;
    try {
      await reactToStory(activeStory.id, emoji, currentUser);
      toast.success(`Reacted ${emoji}`);
    } catch (err) {
      toast.error('Failed to react to story.');
    }
  };

  const handleDelete = async () => {
    if (!activeStory || !currentUser) return;
    try {
      await deleteStory(activeStory.id, currentUser);
      toast.success('Story deleted.');
      onStoryDeleted();
      onClose();
    } catch (err) {
      toast.error('Failed to delete story.');
    }
  };

  const handleReplyDM = () => {
    if (!group.authorId || !currentUser) return;
    const conversationId = [currentUser.uid, group.authorId].sort().join('_');
    onClose();
    navigate(`/messages/${conversationId}`);
  };

  if (!activeStory) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-0 sm:p-4">
      <div 
        className="relative w-full max-w-sm h-full sm:h-[85vh] sm:rounded-3xl bg-slate-900 overflow-hidden flex flex-col justify-between shadow-2xl select-none"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Header & Progress Bars */}
        <div className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-slate-950/90 via-slate-950/40 to-transparent z-20 space-y-2">
          {/* Progress bar indicators */}
          <div className="flex items-center gap-1">
            {group.stories.map((s, idx) => (
              <div key={s.id} className="flex-1 h-1 bg-slate-700/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-100 ease-linear"
                  style={{
                    width:
                      idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Author Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center border border-indigo-500/40">
                {group.authorAvatar ? (
                  <img src={group.authorAvatar} alt={group.authorName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  group.authorName.charAt(0)
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white leading-tight">{group.authorName}</h4>
                <p className="text-[10px] text-slate-400">24h Story</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAuthor && (
                <button
                  onClick={handleDelete}
                  className="p-1.5 bg-slate-950/80 hover:bg-rose-500/20 text-rose-400 rounded-full border border-rose-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 bg-slate-950/80 text-slate-300 hover:text-white rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Story Body Presentation */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          {activeStory.mediaType === 'image' && activeStory.mediaUrl ? (
            <img
              src={activeStory.mediaUrl}
              alt="Story Content"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-tr ${activeStory.backgroundStyle || 'from-indigo-600 to-purple-700'} flex items-center justify-center p-6 text-center`}>
              <p className="text-white font-bold text-lg leading-relaxed whitespace-pre-wrap">
                {activeStory.text}
              </p>
            </div>
          )}

          {/* Navigation Overlay Click Areas */}
          <div onClick={handlePrev} className="absolute left-0 top-0 bottom-0 w-1/3 z-10" />
          <div onClick={handleNext} className="absolute right-0 top-0 bottom-0 w-1/3 z-10" />
        </div>

        {/* Bottom Actions Bar */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800/80 z-20 space-y-2">
          {isAuthor ? (
            <button
              onClick={() => setIsViewersOpen(true)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4 text-indigo-400" />
              <span>Viewed by {activeStory.viewCount || 0}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {/* Quick Reactions */}
              <div className="flex-1 flex items-center justify-around bg-slate-900/90 border border-slate-800 py-1.5 rounded-2xl">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className="text-base hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Reply via Direct Message */}
              <button
                onClick={handleReplyDM}
                className="p-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl text-xs font-bold flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Viewer List Modal for Story Author */}
      {isViewersOpen && (
        <StoryViewers
          storyId={activeStory.id}
          onClose={() => setIsViewersOpen(false)}
        />
      )}
    </div>
  );
};
