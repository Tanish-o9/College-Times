import { useState, useRef, useCallback, useEffect } from 'react';

export type CameraFacingMode = 'user' | 'environment';
export type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'unknown';

export interface CameraState {
  isStreaming: boolean;
  permissionDenied: boolean;
  error: string | null;
  facingMode: CameraFacingMode;
  isRecording: boolean;
  recordingTime: number;
}

export const detectDeviceType = (): DeviceType => {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua)) {
    if (/ipad|tablet/i.test(ua)) return 'tablet';
    return 'mobile';
  }
  return 'desktop';
};

export const useMomentCamera = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [state, setState] = useState<CameraState>({
    isStreaming: false,
    permissionDenied: false,
    error: null,
    facingMode: 'user',
    isRecording: false,
    recordingTime: 0,
  });

  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setState((prev) => ({ ...prev, isStreaming: false, isRecording: false, recordingTime: 0 }));
  }, []);

  const attachStreamToVideo = useCallback((stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const startCamera = useCallback(
    async (facingMode: CameraFacingMode = 'user') => {
      stopTracks();
      setState((prev) => ({ ...prev, error: null, permissionDenied: false, isStreaming: false }));

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setState((prev) => ({
          ...prev,
          error: 'Camera access is not supported by your browser.',
          permissionDenied: true,
        }));
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false, // Do not request mic audio by default to avoid permission issues
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          // Fallback constraint
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        mediaStreamRef.current = stream;

        // Update state to trigger render, then attach stream
        setState((prev) => ({
          ...prev,
          isStreaming: true,
          facingMode,
          permissionDenied: false,
          error: null,
        }));

        // Attach stream immediately and retry after tick to ensure video element is bound
        attachStreamToVideo(stream);
        setTimeout(() => attachStreamToVideo(stream), 100);
      } catch (err: any) {
        let errorMsg = 'Failed to access camera.';
        let isDenied = false;

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMsg = 'Camera access was denied by browser settings.';
          isDenied = true;
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMsg = 'No camera device found on this device.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMsg = 'Camera is currently in use by another app.';
        }

        setState((prev) => ({
          ...prev,
          isStreaming: false,
          permissionDenied: isDenied,
          error: errorMsg,
        }));
      }
    },
    [stopTracks, attachStreamToVideo]
  );

  const toggleCamera = useCallback(() => {
    const nextMode: CameraFacingMode = state.facingMode === 'user' ? 'environment' : 'user';
    startCamera(nextMode);
  }, [state.facingMode, startCamera]);

  const capturePhoto = useCallback((): Promise<{ file: File; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      const stream = mediaStreamRef.current;

      if (!video || !stream) {
        reject(new Error('Camera stream is not active. Please retry.'));
        return;
      }

      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to create canvas context for photo.'));
        return;
      }

      if (state.facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size === 0) {
            reject(new Error('Captured photo was empty. Please retry.'));
            return;
          }
          const file = new File([blob], `camera_moment_${Date.now()}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve({ file, width, height });
        },
        'image/jpeg',
        0.95
      );
    });
  }, [state.facingMode]);

  const startRecording = useCallback(() => {
    if (!mediaStreamRef.current || state.isRecording) return;

    try {
      recordedChunksRef.current = [];
      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? { mimeType: 'video/webm;codecs=vp9' }
        : MediaRecorder.isTypeSupported('video/mp4')
        ? { mimeType: 'video/mp4' }
        : undefined;

      const recorder = new MediaRecorder(mediaStreamRef.current, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.start(200);

      setState((prev) => ({ ...prev, isRecording: true, recordingTime: 0 }));

      recordTimerRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.recordingTime >= 30) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            }
            return { ...prev, isRecording: false };
          }
          return { ...prev, recordingTime: prev.recordingTime + 1 };
        });
      }, 1000);
    } catch (err) {
      console.error('Video recording error:', err);
    }
  }, [state.isRecording]);

  const stopRecording = useCallback((): Promise<{ file: File; duration: number }> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        reject(new Error('No active video recording.'));
        return;
      }

      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }

      const duration = state.recordingTime;

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `camera_video_moment_${Date.now()}.${ext}`, {
          type: mimeType,
          lastModified: Date.now(),
        });
        setState((prev) => ({ ...prev, isRecording: false, recordingTime: 0 }));
        resolve({ file, duration });
      };

      recorder.stop();
    });
  }, [state.recordingTime]);

  useEffect(() => {
    return () => {
      stopTracks();
    };
  }, [stopTracks]);

  return {
    videoRef,
    state,
    startCamera,
    stopTracks,
    toggleCamera,
    capturePhoto,
    startRecording,
    stopRecording,
    deviceType: detectDeviceType(),
  };
};
