import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import { reactToGroupInstant, reportGroupInstant, deleteGroupInstant } from '../../services/groupInstantService';
import type { GroupInstant } from '../../types/group';
import { X, ChevronLeft, ChevronRight, MessageSquare, Flag, Trash2, Heart, ThumbsUp, Flame, Smile, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface GroupInstantViewerProps {
  isOpen: boolean;
  onClose: () => void;
  instants: GroupInstant[];
  initialIndex?: number;
  groupId: string;
}

const EMOJI_LIST = [
  { symbol: '❤️', icon: Heart, label: 'Heart' },
  { symbol: '👍', icon: ThumbsUp, label: 'Like' },
  { symbol: '🔥', icon: Flame, label: 'Fire' },
  { symbol: '😂', icon: Smile, label: 'Laugh' },
  { symbol: '😮', icon: AlertCircle, label: 'Wow' },
];

export const GroupInstantViewer: React.FC<GroupInstantViewerProps> = ({
  isOpen,
  onClose,
  instants,
  initialIndex = 0,
  groupId,
}) => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');

  useOverlayBackHandler(isOpen, onClose);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setCurrentMediaIndex(0);
    setProgress(0);
  }, [initialIndex, isOpen]);

  const currentInstant = instants[currentIndex];

  // Auto-advance progress bar timer (5 seconds per slide)
  useEffect(() => {
    if (!isOpen || isPaused || !currentInstant) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, isPaused, currentIndex, currentMediaIndex, instants.length]);

  if (!isOpen || !currentInstant) return null;

  const mediaList = currentInstant.media && currentInstant.media.length > 0 ? currentInstant.media : [];

  const handleNext = () => {
    setProgress(0);
    if (mediaList.length > 0 && currentMediaIndex < mediaList.length - 1) {
      setCurrentMediaIndex((prev) => prev + 1);
    } else if (currentIndex < instants.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setCurrentMediaIndex(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    setProgress(0);
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex((prev) => prev - 1);
    } else if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setCurrentMediaIndex(0);
    }
  };

  const handleReact = async (emoji: string) => {
    if (!currentUser) return;
    try {
      await reactToGroupInstant(groupId, currentInstant.id, emoji, currentUser.uid);
      toast.success(`Reacted ${emoji}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to react.');
    }
  };

  const handleReplyInChat = () => {
    onClose();
    navigate(`/chat?channel=group-${groupId}&instantId=${currentInstant.id}`);
  };

  const handleDelete = async () => {
    if (!currentUser) return;
    try {
      await deleteGroupInstant(groupId, currentInstant.id, currentUser.uid);
      toast.success('Instant removed.');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete.');
    }
  };

  const handleReport = async () => {
    if (!currentUser) return;
    try {
      await reportGroupInstant(groupId, currentInstant.id, 'Inappropriate content', currentUser.uid);
      toast.success('Report submitted.');
    } catch (err: any) {
      toast.error('Failed to submit report.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center select-none overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Main Container */}
      <div
        className="relative w-full max-w-md h-full max-h-[92vh] sm:rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 flex flex-col shadow-2xl"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Progress Segmented Bar */}
        <div className="absolute top-0 left-0 right-0 z-30 p-3 bg-gradient-to-b from-slate-950/90 to-transparent space-y-2">
          <div className="flex gap-1.5 w-full">
            {mediaList.length > 0 ? (
              mediaList.map((_, idx) => (
                <div key={idx} className="h-1 flex-1 bg-slate-800/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-100 ease-linear"
                    style={{
                      width:
                        idx < currentMediaIndex
                          ? '100%'
                          : idx === currentMediaIndex
                          ? `${progress}%`
                          : '0%',
                    }}
                  />
                </div>
              ))
            ) : (
              <div className="h-1 flex-1 bg-slate-800/80 rounded-full overflow-hidden">
                <div className="h-full bg-white" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>

          {/* Author Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                {currentInstant.senderAvatar ? (
                  <img src={currentInstant.senderAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  currentInstant.senderName.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">{currentInstant.senderName}</span>
                <span className="text-[10px] text-slate-400 font-mono">24h Group Moment</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {currentUser?.uid === currentInstant.senderId || userProfile?.role === 'admin' ? (
                <button onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors" title="Delete Instant">
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleReport} className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors" title="Report Instant">
                  <Flag className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition-colors" title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Media / Content Viewport */}
        <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden">
          {mediaList.length > 0 ? (
            <img
              src={mediaList[currentMediaIndex]}
              alt="Instant moment"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="p-8 text-center space-y-3 max-w-xs">
              <p className="text-base font-medium text-white leading-relaxed">{currentInstant.caption}</p>
            </div>
          )}

          {/* Touch Navigation Overlay */}
          <div className="absolute inset-0 flex z-20">
            <button onClick={handlePrev} className="w-1/3 h-full cursor-pointer focus:outline-none" aria-label="Previous slide" />
            <button onClick={handleNext} className="w-2/3 h-full cursor-pointer focus:outline-none" aria-label="Next slide" />
          </div>
        </div>

        {/* Bottom Caption & Interactions */}
        <div className="z-30 p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          {mediaList.length > 0 && currentInstant.caption && (
            <p className="text-xs text-slate-200 leading-relaxed max-h-16 overflow-y-auto">
              {currentInstant.caption}
            </p>
          )}

          {/* Reaction Bar */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-2">
              {EMOJI_LIST.map(({ symbol, label }) => {
                const count = currentInstant.reactionCounts?.[symbol] || 0;
                return (
                  <button
                    key={symbol}
                    onClick={() => handleReact(symbol)}
                    className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs flex items-center gap-1 transition-all active:scale-95"
                    title={`React ${label}`}
                  >
                    <span>{symbol}</span>
                    {count > 0 && <span className="text-[10px] text-slate-400 font-mono">{count}</span>}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleReplyInChat}
              className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Group Chat</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
