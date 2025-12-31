import { useRef, useState, useCallback, useEffect } from 'react';

interface UseCameraOptions {
  facingMode?: 'user' | 'environment';
}

export function useCamera(options: UseCameraOptions = {}) {
  const { facingMode = 'environment' } = options;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // iOS Safari requires specific constraints
      // Portrait aspect ratio 3:4 for card grids
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1080 },
          height: { ideal: 1440 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;

        // iOS requires waiting for loadedmetadata before play
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            video.play()
              .then(() => resolve())
              .catch(reject);
          };
          // Timeout fallback
          setTimeout(() => resolve(), 3000);
        });

        setIsReady(true);
      }
    } catch (err) {
      let message = 'Impossible d\'accéder à la caméra';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          message = 'Accès à la caméra refusé. Veuillez autoriser l\'accès dans les paramètres.';
        } else if (err.name === 'NotFoundError') {
          message = 'Aucune caméra détectée.';
        } else {
          message = err.message;
        }
      }
      setError(message);
      console.error('Camera error:', err);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }, []);

  const captureFrame = useCallback((): Blob | null => {
    if (!videoRef.current || !isReady) return null;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');

    // Use square crop from center
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Calculate crop offset to center
    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;

    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size);

    // Convert to blob
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.85
      );
    }) as unknown as Blob | null;
  }, [isReady]);

  const captureFrameAsync = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !isReady) return null;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Capture raw video frame without any rotation
    // The browser handles display orientation automatically
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.85
      );
    });
  }, [isReady]);

  // Get debug info about current video dimensions
  const getDebugInfo = useCallback(() => {
    if (!videoRef.current || !isReady) return null;

    const video = videoRef.current;
    const track = streamRef.current?.getVideoTracks()[0];
    const settings = track?.getSettings();

    return {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      trackSettings: settings ? {
        width: settings.width,
        height: settings.height,
        facingMode: settings.facingMode,
        aspectRatio: settings.aspectRatio,
      } : null,
    };
  }, [isReady]);

  // Restart camera with new constraints (for debugging)
  const restartWithConstraints = useCallback(async (newConstraints: MediaTrackConstraints) => {
    stopCamera();

    try {
      setError(null);

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          ...newConstraints,
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;

        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            video.play()
              .then(() => resolve())
              .catch(reject);
          };
          setTimeout(() => resolve(), 3000);
        });

        setIsReady(true);
      }
    } catch (err) {
      let message = 'Impossible d\'accéder à la caméra';
      if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      console.error('Camera error:', err);
    }
  }, [facingMode, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    isReady,
    error,
    startCamera,
    stopCamera,
    captureFrame,
    captureFrameAsync,
    getDebugInfo,
    restartWithConstraints,
  };
}
