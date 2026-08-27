import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import {
  reactToGroupInstant,
  reportGroupInstant,
  deleteGroupInstant,
  getGroupInstantMedia,
} from '../../services/groupInstantService';
import type { GroupInstant, GroupInstantMedia } from '../../types/group';
import { X, MessageSquare, Flag, Trash2, Heart, ThumbsUp, Flame, Smile, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [subcollectionMedia, setSubcollectionMedia] = useState<GroupInstantMedia[]>([]);

  useOverlayBackHandler(isOpen, onClose);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setCurrentMediaIndex(0);
  }, [initialIndex, isOpen]);

  const currentInstant = instants[currentIndex];

  // Fetch subcollection media items when instant changes
  useEffect(() => {
    if (!isOpen || !currentInstant || !groupId) return;

    getGroupInstantMedia(groupId, currentInstant.id, 50)
      .then((mediaDocs) => {
        if (mediaDocs && mediaDocs.length > 0) {
          setSubcollectionMedia(mediaDocs);
        } else {
          setSubcollectionMedia([]);
        }
      })
      .catch(() => setSubcollectionMedia([]));
  }, [isOpen, groupId, currentInstant?.id]);

  if (!isOpen || !currentInstant) return null;

  // Resolve media URLs array (subcollection takes priority, fallback to parent media array)
  const mediaUrls: string[] =
    subcollectionMedia.length > 0
      ? subcollectionMedia.map((m) => m.downloadUrl)
      : currentInstant.media && currentInstant.media.length > 0
      ? currentInstant.media
      : [];

  const totalPhotosCount = currentInstant.mediaCount || mediaUrls.length;

  const handleNext = () => {
    if (mediaUrls.length > 0 && currentMediaIndex < mediaUrls.length - 1) {
      setCurrentMediaIndex((prev) => prev + 1);
    } else if (currentIndex < instants.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setCurrentMediaIndex(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
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
      await deleteGroupInstant(groupId, currentInstant.id, currentUser, userProfile);
      toast.success('Instant removed.');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete.');
    }
  };

  const handleReport = async () => {
    if (!currentUser) return;
    try {
      await reportGroupInstant(groupId, currentInstant.id, 'Inappropriate content', currentUser);
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
      <div className="relative w-full max-w-md h-full max-h-[92vh] sm:rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 flex flex-col shadow-2xl">
        {/* Top Header Bar */}
        <div className="absolute top-0 left-0 right-0 z-30 p-3 bg-gradient-to-b from-slate-950/90 to-transparent space-y-2">
          {/* Top Status Counter */}
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono font-bold px-1">
            <span>
              {mediaUrls.length > 0 ? `Photo ${currentMediaIndex + 1} of ${totalPhotosCount}` : 'Text Moment'}
            </span>
            <span>Moment {currentIndex + 1} of {instants.length}</span>
          </div>

          {/* Author Header */}
          <div className="flex items-center justify-between pt-1">
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
                <span className="text-[10px] text-purple-400 font-mono font-bold">Permanent Group Moment</span>
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
          {mediaUrls.length > 0 ? (
            <img
              src={mediaUrls[currentMediaIndex]}
              alt="Group moment"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="p-8 text-center space-y-3 max-w-xs">
              <p className="text-base font-medium text-white leading-relaxed">{currentInstant.caption}</p>
            </div>
          )}

          {/* Navigation Controls */}
          {currentMediaIndex > 0 || currentIndex > 0 ? (
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : null}

          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-800 text-white rounded-full transition-colors"
            title="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Caption & Interactions */}
        <div className="z-30 p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          {mediaUrls.length > 0 && currentInstant.caption && (
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
