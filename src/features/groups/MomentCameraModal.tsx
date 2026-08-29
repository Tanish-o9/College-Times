import React, { useEffect, useRef } from 'react';
import { useMomentCamera } from '../../hooks/useMomentCamera';
import { useOverlayBackHandler } from '../../hooks/useOverlayBackHandler';
import { X, Camera, RefreshCw, AlertCircle, Video, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

interface MomentCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMediaCaptured: (media: {
    file: File;
    sourceType: 'camera';
    type: 'image' | 'video';
    width?: number;
    height?: number;
    duration?: number;
  }) => void;
}

export const MomentCameraModal: React.FC<MomentCameraModalProps> = ({
  isOpen,
  onClose,
  onMediaCaptured,
}) => {
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);

  const {
    videoRef,
    state,
    startCamera,
    stopTracks,
    toggleCamera,
    capturePhoto,
    startRecording,
    stopRecording,
    deviceType,
  } = useMomentCamera();

  useOverlayBackHandler(isOpen, () => {
    stopTracks();
    onClose();
  });

  useEffect(() => {
    if (isOpen) {
      startCamera('user');
    } else {
      stopTracks();
    }
  }, [isOpen, startCamera, stopTracks]);

  if (!isOpen) return null;

  const handleCapturePhoto = async () => {
    try {
      const { file, width, height } = await capturePhoto();
      stopTracks();
      onMediaCaptured({
        file,
        sourceType: 'camera',
        type: 'image',
        width,
        height,
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to capture photo.');
    }
  };

  const handleStopRecording = async () => {
    try {
      const { file, duration } = await stopRecording();
      stopTracks();
      onMediaCaptured({
        file,
        sourceType: 'camera',
        type: 'video',
        duration,
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to stop video recording.');
    }
  };

  const handleNativeCameraFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const file = files[0];
    const isVideo = file.type.startsWith('video/');

    stopTracks();
    onMediaCaptured({
      file,
      sourceType: 'camera',
      type: isVideo ? 'video' : 'image',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between items-center p-4 sm:p-6 overflow-hidden">
      {/* Hidden Native Camera Input Fallback */}
      <input
        type="file"
        ref={nativeCameraInputRef}
        onChange={handleNativeCameraFile}
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
      />

      {/* Header Bar */}
      <div className="w-full max-w-md flex items-center justify-between z-20 shrink-0 py-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Camera Viewfinder</h2>
            <p className="text-[10px] text-slate-400">Captured in app • {deviceType}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Native Camera App Trigger */}
          <button
            onClick={() => nativeCameraInputRef.current?.click()}
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-purple-300 text-[11px] font-bold rounded-xl transition-all flex items-center gap-1"
            title="Open Native Phone Camera App"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Native App</span>
          </button>

          <button
            onClick={() => {
              stopTracks();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white bg-slate-900/80 border border-slate-800 rounded-full transition-all"
            title="Close Camera"
            aria-label="Close Camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewfinder Area */}
      <div className="relative w-full max-w-md aspect-[9/16] sm:aspect-[3/4] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center my-auto">
        {/* Video Element (ALWAYS Mounted to ensure videoRef is never null) */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            state.isStreaming ? 'opacity-100' : 'opacity-0 absolute'
          } ${state.facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* Loading / Error States Overlay */}
        {!state.isStreaming && (state.error || state.permissionDenied) && (
          <div className="p-6 text-center space-y-4 max-w-xs z-10">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">Camera Permission Needed</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{state.error}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => startCamera(state.facingMode)}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                Retry In-App Camera
              </button>
              <button
                onClick={() => nativeCameraInputRef.current?.click()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-all"
              >
                Use Native Phone Camera
              </button>
            </div>
          </div>
        )}

        {!state.isStreaming && !state.error && !state.permissionDenied && (
          <div className="flex flex-col items-center gap-2 text-slate-400 text-xs font-medium z-10">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
            <span>Starting Camera Stream...</span>
          </div>
        )}

        {/* Live Recording Counter Badge */}
        {state.isRecording && (
          <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-rose-600/90 text-white font-mono text-xs font-bold rounded-full flex items-center gap-2 shadow-lg animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>00:{state.recordingTime.toString().padStart(2, '0')} / 00:30</span>
          </div>
        )}
      </div>

      {/* Control Actions Footer */}
      <div className="w-full max-w-md flex items-center justify-around z-20 shrink-0 py-3 bg-slate-950/60 backdrop-blur-md rounded-3xl border border-slate-800/80">
        {/* Flip Front/Back Camera */}
        <button
          onClick={toggleCamera}
          disabled={!state.isStreaming || state.isRecording}
          className="p-3 text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-full transition-all disabled:opacity-40"
          title="Switch Front / Back Camera"
          aria-label="Switch Front / Back Camera"
        >
          <RefreshCw className="w-5 h-5" />
        </button>

        {/* Shutter Capture Button */}
        {!state.isRecording ? (
          <button
            onClick={handleCapturePhoto}
            disabled={!state.isStreaming}
            className="w-18 h-18 rounded-full border-4 border-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center shadow-2xl disabled:opacity-40"
            title="Tap to Capture Photo"
            aria-label="Tap to Capture Photo"
          >
            <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/80" />
          </button>
        ) : (
          <button
            onClick={handleStopRecording}
            className="w-18 h-18 rounded-full border-4 border-rose-500 bg-rose-600 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center shadow-2xl animate-pulse"
            title="Stop Video Recording"
            aria-label="Stop Video Recording"
          >
            <div className="w-6 h-6 rounded-md bg-white" />
          </button>
        )}

        {/* Video Mode Record Trigger */}
        {!state.isRecording ? (
          <button
            onClick={startRecording}
            disabled={!state.isStreaming}
            className="p-3 text-rose-400 hover:text-rose-300 bg-slate-900 border border-slate-800 rounded-full transition-all disabled:opacity-40"
            title="Record Video (Up to 30s)"
            aria-label="Record Video (Up to 30s)"
          >
            <Video className="w-5 h-5" />
          </button>
        ) : (
          <span className="text-[10px] font-bold text-rose-400 font-mono animate-pulse">RECORDING</span>
        )}
      </div>
    </div>
  );
};
