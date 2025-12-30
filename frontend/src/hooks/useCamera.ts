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

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Get screen orientation to handle device rotation
    // portrait-primary: normal portrait
    // portrait-secondary: upside-down portrait (180°)
    // landscape-primary: normal landscape (90° clockwise)
    // landscape-secondary: inverted landscape (90° counter-clockwise)
    const orientation = screen.orientation?.type || 'portrait-primary';

    // Determine rotation needed based on video dimensions and screen orientation
    const isVideoLandscape = videoWidth > videoHeight;

    let rotation = 0; // radians
    let outputWidth = videoWidth;
    let outputHeight = videoHeight;

    if (isVideoLandscape) {
      // Video is landscape, need to rotate to portrait
      if (orientation === 'landscape-secondary') {
        rotation = -Math.PI / 2; // -90°
      } else {
        rotation = Math.PI / 2; // 90°
      }
      outputWidth = videoHeight;
      outputHeight = videoWidth;
    } else {
      // Video is portrait
      if (orientation === 'portrait-secondary') {
        rotation = Math.PI; // 180°
      }
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    if (rotation !== 0) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rotation);
      ctx.translate(-videoWidth / 2, -videoHeight / 2);
    }

    ctx.drawImage(video, 0, 0);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.85
      );
    });
  }, [isReady]);

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
  };
}
