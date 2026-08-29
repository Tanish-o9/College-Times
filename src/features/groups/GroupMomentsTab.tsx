import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { subscribeToActiveGroupInstants } from '../../services/groupInstantService';
import type { GroupInstant, MomentSourceType } from '../../types/group';
import { MomentCameraModal } from './MomentCameraModal';
import { MomentComposerModal } from './MomentComposerModal';
import { GroupInstantViewer } from './GroupInstantViewer';
import {
  Camera,
  Image as ImageIcon,
  Sparkles,
  Eye,
  Clock,
  UserCheck,
  AlertCircle,
  Video,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface GroupMomentsTabProps {
  groupId: string;
  groupName: string;
  isMember: boolean;
  userRole?: string;
}

export const GroupMomentsTab: React.FC<GroupMomentsTabProps> = ({
  groupId,
  groupName,
  isMember,
}) => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canPost = isMember || Boolean(currentUser);

  const [moments, setMoments] = useState<GroupInstant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<'latest' | 'top' | 'mine'>('latest');

  // Modals state
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [selectedViewerIndex, setSelectedViewerIndex] = useState<number>(0);

  // Active composer media item
  const [composerMedia, setComposerMedia] = useState<{
    file: File;
    sourceType: MomentSourceType;
    type: 'image' | 'video';
    width?: number;
    height?: number;
    duration?: number;
  } | null>(null);

  // Real-time listener for moments
  useEffect(() => {
    if (!groupId) return;

    setLoading(true);
    const unsubscribe = subscribeToActiveGroupInstants(
      groupId,
      (freshInstants) => {
        setMoments(freshInstants);
        setLoading(false);
      },
      30
    );

    return () => unsubscribe();
  }, [groupId]);

  // Handle Gallery Selection
  const handleGalleryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const file = files[0];
    const isVideo = file.type.startsWith('video/');
    const maxBytes = isVideo ? 25 * 1024 * 1024 : 10 * 1024 * 1024;

    if (file.size > maxBytes) {
      toast.error(`File '${file.name}' exceeds ${isVideo ? '25MB' : '10MB'} limit.`);
      return;
    }

    setComposerMedia({
      file,
      sourceType: 'gallery',
      type: isVideo ? 'video' : 'image',
    });
    setIsComposerOpen(true);
    e.target.value = '';
  };

  // Handle Camera Capture Return safely without popstate collisions
  const handleMediaCaptured = (captured: {
    file: File;
    sourceType: 'camera';
    type: 'image' | 'video';
    width?: number;
    height?: number;
    duration?: number;
  }) => {
    setComposerMedia(captured);
    setIsCameraOpen(false);
    setTimeout(() => {
      setIsComposerOpen(true);
    }, 150);
  };

  const [viewedIds, setViewedIds] = useState<Set<string>>(() => {
    try {
      const storageKey = `ct_viewed_moments_${currentUser?.uid || 'guest'}`;
      const saved = localStorage.getItem(storageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markAsViewed = (ids: string | string[]) => {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return;

    setViewedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      idList.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      if (!changed) return prev;

      try {
        const storageKey = `ct_viewed_moments_${currentUser?.uid || 'guest'}`;
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const [viewerInstants, setViewerInstants] = useState<GroupInstant[]>([]);

  const filteredMoments = moments.filter((m) => {
    const isOwner = m.senderId === currentUser?.uid;

    // OWNER ALWAYS SEES THEIR OWN CREATED MOMENT (so they can manage/delete it)
    if (isOwner) {
      return true;
    }

    // FOR OTHER MEMBERS: ONE-VIEW ONLY RULE (Hide once viewed)
    const isViewedLocally = viewedIds.has(m.id);
    const isViewedInFirestore = Array.isArray(m.viewedBy) && m.viewedBy.includes(currentUser?.uid || '');

    if (isViewedLocally || isViewedInFirestore) {
      return false;
    }

    return true;
  });

  const handleOpenViewer = (index: number) => {
    // Freeze moment list snapshot so real-time Firestore updates never shrink array while user is watching!
    setViewerInstants([...filteredMoments]);
    setSelectedViewerIndex(index);
    setIsViewerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Hidden Gallery Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleGalleryFileSelect}
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
        className="hidden"
      />

      {/* Main Action Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 text-white flex items-center justify-center shadow-lg shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Group Moments</span>
                <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-mono font-bold rounded-full">
                  24h Expiration
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Share instant visual updates and daily college life moments with members.
              </p>
            </div>
          </div>

          {/* Capture & Upload Buttons */}
          {canPost ? (
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setIsCameraOpen(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>Capture Moment</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-2xl transition-all flex items-center gap-2 active:scale-95"
              >
                <ImageIcon className="w-4 h-4 text-sky-400" />
                <span>Upload Gallery</span>
              </button>
            </div>
          ) : (
            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-400 text-xs rounded-xl flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Join group to post moments</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveFilter('latest')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeFilter === 'latest'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>All Active</span>
          </button>

          <button
            onClick={() => setActiveFilter('mine')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeFilter === 'mine'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>My Moments</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-mono">
          {filteredMoments.length} active moment{filteredMoments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Moments Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[3/4] bg-slate-900 border border-slate-800 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : filteredMoments.length === 0 ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
            <Camera className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white">No active moments yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Be the first member to capture or upload a moment for {groupName}!
          </p>

          {canPost && (
            <button
              onClick={() => setIsCameraOpen(true)}
              className="mt-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs rounded-2xl transition-all shadow-md inline-flex items-center gap-1.5"
            >
              <Camera className="w-4 h-4" />
              <span>Capture First Moment</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredMoments.map((moment, idx) => {
            const hasMedia = moment.media && moment.media.length > 0;
            const coverUrl = hasMedia ? moment.media[0] : null;
            const isVideo = moment.type === 'video';

            return (
              <div
                key={moment.id}
                onClick={() => handleOpenViewer(idx)}
                className="relative aspect-[3/4] bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-3xl overflow-hidden cursor-pointer group shadow-lg transition-all hover:scale-[1.02]"
              >
                {/* Media Cover */}
                {coverUrl ? (
                  isVideo ? (
                    <video
                      src={coverUrl}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={coverUrl}
                      alt="Moment preview"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )
                ) : (
                  <div className="w-full h-full p-4 bg-gradient-to-tr from-purple-950/60 to-slate-900 flex items-center justify-center text-center">
                    <p className="text-xs font-semibold text-purple-200 line-clamp-4">{moment.caption}</p>
                  </div>
                )}

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40 pointer-events-none" />

                {/* Top Source Badge */}
                <div className="absolute top-2.5 left-2.5 z-10">
                  <span
                    className={`px-2 py-0.5 text-[9px] font-bold rounded-full backdrop-blur-md border flex items-center gap-1 ${
                      moment.sourceType === 'camera'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'bg-slate-900/80 text-sky-300 border-slate-700'
                    }`}
                  >
                    {moment.sourceType === 'camera' ? (
                      <Camera className="w-2.5 h-2.5 text-purple-300" />
                    ) : (
                      <ImageIcon className="w-2.5 h-2.5 text-sky-400" />
                    )}
                    <span>{moment.sourceType === 'camera' ? 'Camera' : 'Gallery'}</span>
                  </span>
                </div>

                {/* Video Icon Badge */}
                {isVideo && (
                  <div className="absolute top-2.5 right-2.5 z-10 p-1 bg-slate-950/80 border border-slate-700 rounded-lg backdrop-blur-md text-purple-300">
                    <Video className="w-3 h-3" />
                  </div>
                )}

                {/* Bottom Author & Stats Footer */}
                <div className="absolute bottom-3 left-3 right-3 z-10 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-[10px] flex items-center justify-center overflow-hidden shrink-0">
                      {moment.senderAvatar ? (
                        <img src={moment.senderAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        moment.senderName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="text-xs font-bold text-white truncate">{moment.senderName}</span>
                  </div>

                  {moment.caption && (
                    <p className="text-[11px] text-slate-300 line-clamp-1 opacity-90">{moment.caption}</p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                    {moment.viewCount !== undefined && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-slate-400" />
                        <span>{moment.viewCount}</span>
                      </span>
                    )}
                    <span className="text-[9px] text-purple-300 font-bold">Expires in 24h</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <MomentCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onMediaCaptured={handleMediaCaptured}
      />

      <MomentComposerModal
        isOpen={isComposerOpen}
        onClose={() => {
          setIsComposerOpen(false);
          setComposerMedia(null);
        }}
        groupId={groupId}
        groupName={groupName}
        mediaItem={composerMedia}
        onInstantCreated={() => {
          setIsComposerOpen(false);
          setComposerMedia(null);
        }}
        onRetakeCamera={() => {
          setIsComposerOpen(false);
          setIsCameraOpen(true);
        }}
        onChooseGallery={() => {
          setIsComposerOpen(false);
          fileInputRef.current?.click();
        }}
      />

      <GroupInstantViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        instants={viewerInstants}
        initialIndex={selectedViewerIndex}
        groupId={groupId}
        onInstantViewed={markAsViewed}
      />
    </div>
  );
};
