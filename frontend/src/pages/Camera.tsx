import { useEffect, useState, useCallback, useRef } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useGame } from '../context/GameContext';
import { GridOverlay } from '../components/GridOverlay';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { analyzeImage, finalizeCapture, deleteCapture, getSettings, getServerHealth, type ServerHealth } from '../services/api';
import { localInference } from '../services/localInference';
import type { GameCard, CardResult, BoundingBox, OfflineMode, AnalyzeResponse } from '../types';

interface DetectionResult {
  bbox: BoundingBox;
  confidence: number;
}

const CONFIDENCE_THRESHOLD = 0.75;

/**
 * Tente d'extraire le modèle de l'appareil depuis le userAgent.
 */
function getDeviceModel(): string {
  const ua = navigator.userAgent;

  // iOS: "iPhone14,5" ou "iPad13,4" dans le userAgent (rarement exposé directement)
  // On cherche plutôt "iPhone" ou "iPad"
  if (/iPhone/.test(ua)) {
    return 'iPhone';
  }
  if (/iPad/.test(ua)) {
    return 'iPad';
  }

  // Android: cherche le modèle entre ";" et "Build/"
  // Ex: "Linux; Android 13; SM-G998B Build/..."
  const androidMatch = ua.match(/;\s*([^;]+)\s+Build\//);
  if (androidMatch) {
    return androidMatch[1].trim();
  }

  // Fallback: nombre de cores
  if (navigator.hardwareConcurrency) {
    return `${navigator.hardwareConcurrency} cores`;
  }

  return 'Unknown';
}

export function Camera() {
  const { videoRef, isReady, error, startCamera, stopCamera, captureFrameAsync, getDebugInfo, restartWithConstraints } =
    useCamera();
  const { state, setStep, setCards, reset, getCurrentPlayer } = useGame();

  const [identifiedCards, setIdentifiedCards] = useState<GameCard[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Capture state
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] = useState<string | null>(null);
  const [detections, setDetections] = useState<DetectionResult[]>([]);

  // Track current capture for finalization
  const currentCaptureIdRef = useRef<string | undefined>(undefined);
  const currentDetectionCountRef = useRef<number>(0);

  // Offline mode
  const [offlineMode, setOfflineMode] = useState<OfflineMode>('never');
  const [inferenceMode, setInferenceMode] = useState<'server' | 'local' | null>(null);
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [localModelVariant, setLocalModelVariant] = useState<string | null>(null);

  // Developer mode
  const [developerMode, setDeveloperMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    videoWidth: number;
    videoHeight: number;
    screenWidth: number;
    screenHeight: number;
    trackSettings: {
      width?: number;
      height?: number;
      facingMode?: string;
      aspectRatio?: number;
    } | null;
  } | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const currentPlayer = getCurrentPlayer();
  const playerIndex = state.currentPlayerIndex + 1;
  const totalPlayers = state.selectedPlayers.length;

  // Convert API response to GameCard array and detection results
  // Always returns 9 cards (one for each position 0-8)
  const processResults = useCallback(
    (results: CardResult[]): { cards: GameCard[]; detections: DetectionResult[] } => {
      const detectedCards = new Map<number, GameCard>();
      const detectionResults: DetectionResult[] = [];

      // Process detected cards
      for (const result of results) {
        const position = result.position[0] * 3 + result.position[1];
        const topMatch = result.matches[0];
        const confidence = topMatch?.probability ?? 0;

        detectedCards.set(position, {
          position,
          cardId: topMatch?.id ?? '',
          confidence,
          alternatives: result.matches.slice(0, 6),
        });

        // Store detection with bbox for overlay
        if (result.bbox) {
          detectionResults.push({
            bbox: result.bbox,
            confidence,
          });
        }
      }

      // Create array with all 9 positions (0-8)
      const cards: GameCard[] = [];
      for (let i = 0; i < 9; i++) {
        const detected = detectedCards.get(i);
        if (detected) {
          cards.push(detected);
        } else {
          // Create empty card for undetected position
          cards.push({
            position: i,
            cardId: '',
            confidence: 0,
            alternatives: [],
          });
        }
      }

      return { cards, detections: detectionResults };
    },
    []
  );

  // Get positions of cards with high confidence
  const getHighConfidencePositions = useCallback((cards: GameCard[]): Set<number> => {
    return new Set(
      cards
        .filter((c) => c.confidence >= CONFIDENCE_THRESHOLD)
        .map((c) => c.position)
    );
  }, []);

  // Format detection result message
  const formatDetectionMessage = useCallback((count: number): string => {
    if (count === 0) return 'Aucune carte detectee';
    if (count === 1) return '1 carte detectee';
    return `${count} cartes detectees`;
  }, []);

  // Analyze with server or local inference
  const runAnalysis = useCallback(async (blob: Blob): Promise<AnalyzeResponse> => {
    if (offlineMode === 'always' && await localInference.isAvailable()) {
      setInferenceMode('local');
      return await localInference.analyze(blob);
    }

    if (offlineMode === 'fallback') {
      // Try server first, fallback to local
      try {
        setInferenceMode('server');
        return await analyzeImage(blob);
      } catch (err) {
        console.warn('Server unavailable, using local inference:', err);
        if (await localInference.isAvailable()) {
          setInferenceMode('local');
          return await localInference.analyze(blob);
        }
        throw err;
      }
    }

    // Default: server only
    setInferenceMode('server');
    return await analyzeImage(blob);
  }, [offlineMode]);

  // Capture and analyze
  const handleCapture = useCallback(async () => {
    if (isAnalyzing || !isReady) return;
    setIsAnalyzing(true);

    // Store blob URL temporarily for potential display after analysis
    let tempImageUrl: string | null = null;

    try {
      const blob = await captureFrameAsync();
      if (!blob) {
        setDetectionResult('Erreur de capture');
        setIsAnalyzing(false);
        return;
      }

      // Create image URL but don't display yet
      tempImageUrl = URL.createObjectURL(blob);

      const response = await runAnalysis(blob);

      // Store capture ID for later finalization
      currentCaptureIdRef.current = response.capture_id;

      if (response.success && response.cards.length > 0) {
        const { cards: newCards, detections: newDetections } = processResults(response.cards);

        const highConfPositions = getHighConfidencePositions(newCards);
        const detectedCount = highConfPositions.size;
        currentDetectionCountRef.current = detectedCount;

        // If all 9 cards detected with high confidence, auto-validate directly
        if (detectedCount === 9) {
          // Don't show image, go straight to review
          URL.revokeObjectURL(tempImageUrl);
          setCards(newCards, currentCaptureIdRef.current);
          stopCamera();
          setStep('review');
          return;
        }

        // Show image and results for manual review
        setIdentifiedCards(newCards);
        setDetections(newDetections);
        setCapturedImageUrl(tempImageUrl);
        setDetectionResult(formatDetectionMessage(detectedCount));
      } else {
        // No cards detected - show image anyway for retry
        setCapturedImageUrl(tempImageUrl);
        setIdentifiedCards([]);
        setDetections([]);
        setDetectionResult('Aucune carte detectee');
        currentDetectionCountRef.current = 0;
      }
    } catch (err) {
      console.error('Analysis error:', err);
      // Clean up on error
      if (tempImageUrl) {
        URL.revokeObjectURL(tempImageUrl);
      }
      setDetectionResult("Erreur d'analyse");
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    isReady,
    captureFrameAsync,
    processResults,
    getHighConfidencePositions,
    formatDetectionMessage,
    isAnalyzing,
    setCards,
    stopCamera,
    setStep,
    runAnalysis,
  ]);

  // Reset to live view for retake
  const handleRetake = useCallback(async () => {
    // Finalize previous capture as failed (user took new capture)
    if (currentCaptureIdRef.current) {
      finalizeCapture(currentCaptureIdRef.current, {
        status: 'failed',
        detection_count: currentDetectionCountRef.current,
      });
      currentCaptureIdRef.current = undefined;
      currentDetectionCountRef.current = 0;
    }

    // Clean up previous image URL
    if (capturedImageUrl) {
      URL.revokeObjectURL(capturedImageUrl);
    }
    setCapturedImageUrl(null);
    setIdentifiedCards([]);
    setDetections([]);
    setDetectionResult(null);

    // Resume video playback after unhiding (iOS Safari suspends paused videos)
    if (videoRef.current) {
      // Check if video has valid source and stream is active
      const video = videoRef.current;
      const stream = video.srcObject as MediaStream | null;
      const isStreamActive = stream && stream.active && stream.getVideoTracks().some(t => t.readyState === 'live');

      if (!isStreamActive) {
        // Stream is not active, restart camera
        startCamera();
      } else {
        // Try to resume playback
        try {
          await video.play();
        } catch {
          // If play fails, restart camera
          startCamera();
        }
      }
    } else {
      // No video ref, restart camera
      startCamera();
    }
  }, [capturedImageUrl, videoRef, startCamera]);

  // Load settings and server health on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getSettings();
        if (settings.offline_mode) {
          setOfflineMode(settings.offline_mode as OfflineMode);
        }
        if (settings.developer_mode === 'true') {
          setDeveloperMode(true);
        }
      } catch {
        // Ignore - will use defaults
      }
    };

    const loadServerHealth = async () => {
      try {
        const health = await getServerHealth();
        setServerHealth(health);
      } catch {
        // Server unreachable
      }
    };

    const loadLocalModelInfo = async () => {
      try {
        const variant = await localInference.getModelVariant();
        setLocalModelVariant(variant);
      } catch {
        // No local model
      }
    };

    loadSettings();
    loadServerHealth();
    loadLocalModelInfo();
  }, []);

  // Start camera on mount
  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // Update debug info when camera is ready
  useEffect(() => {
    if (isReady && developerMode) {
      const info = getDebugInfo();
      setDebugInfo(info);
    }
  }, [isReady, developerMode, getDebugInfo]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clean up image URL
      if (capturedImageUrl) {
        URL.revokeObjectURL(capturedImageUrl);
      }
      // Delete pending capture if component unmounts without validation
      if (currentCaptureIdRef.current) {
        deleteCapture(currentCaptureIdRef.current);
      }
    };
  }, [capturedImageUrl]);

  // Validate and proceed to review page
  const handleValidate = useCallback(() => {
    if (isValidating) return;
    setIsValidating(true);

    // Set the cards with capture ID and go to review
    setCards(identifiedCards, currentCaptureIdRef.current);
    stopCamera();
    setStep('review');

    setIsValidating(false);
  }, [identifiedCards, setCards, stopCamera, setStep, isValidating]);


  // Handle back button - show confirmation
  const handleBack = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  // Confirm exit - cleanup pending capture
  const confirmExit = useCallback(() => {
    // Delete pending capture if exists
    if (currentCaptureIdRef.current) {
      deleteCapture(currentCaptureIdRef.current);
      currentCaptureIdRef.current = undefined;
    }
    stopCamera();
    reset();
  }, [stopCamera, reset]);

  // Check if we have any detected cards
  const hasDetectedCards = identifiedCards.some(c => c.confidence >= CONFIDENCE_THRESHOLD);

  if (error) {
    return (
      <div className="flex flex-col h-dvh bg-dark overflow-hidden">
        {/* Header with back button */}
        <div className="p-3 bg-dark-lighter border-b border-white/10">
          <div className="flex items-center">
            <button
              onClick={handleBack}
              className="p-2 -ml-2 text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-red-900/50 text-red-200 p-6 rounded-xl text-center">
            <p className="text-lg font-semibold mb-2">Erreur camera</p>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const isLiveMode = !capturedImageUrl;

  return (
    <div className="flex flex-col h-dvh bg-dark overflow-hidden">
      {/* Header with back button and player indicator */}
      <div className="p-3 bg-dark-lighter border-b border-white/10">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {currentPlayer && (
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: currentPlayer.color }}
              >
                {playerIndex}
              </div>
              <span className="text-white font-medium">{currentPlayer.name}</span>
              <span className="text-white/40 text-sm">({playerIndex}/{totalPlayers})</span>
            </div>
          )}
          <div className="w-10" />
        </div>
      </div>

      {/* Camera/capture/analyzing view */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {isAnalyzing ? (
          /* Analyzing screen */
          <div className="flex flex-col items-center justify-center gap-6">
            <h2 className="text-3xl font-bold text-white">Analyse...</h2>
            <div className="relative w-16 h-16">
              {/* Outer ring */}
              <div className="absolute inset-0 border-4 border-gold/30 rounded-full" />
              {/* Spinning ring */}
              <div className="absolute inset-0 border-4 border-transparent border-t-gold rounded-full animate-spin" />
              {/* Inner pulsing dot */}
              <div className="absolute inset-4 bg-gold/50 rounded-full animate-pulse" />
            </div>
            <p className="text-white/60 text-sm">Detection des cartes en cours</p>
            {inferenceMode && (
              <div className="text-xs text-center">
                {inferenceMode === 'local' ? (
                  <>
                    <p className="text-red-400 font-medium">Offline</p>
                    <p className="text-white/40">
                      ONNX {localModelVariant?.toUpperCase() ?? 'FP16'} - {getDeviceModel()}
                    </p>
                  </>
                ) : (
                  <p className="text-white/40">
                    {serverHealth?.inference.framework === 'openvino'
                      ? 'OpenVINO - Intel Core i5-6500 @3.2Ghz'
                      : 'PyTorch - Apple M4 @4.46Ghz'}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full max-w-sm aspect-[3/4]">
            {/* Live video feed - always mounted to preserve stream connection */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              webkit-playsinline="true"
              muted
              className={`absolute inset-0 w-full h-full rounded-lg ${
                developerMode ? 'object-contain bg-black' : 'object-cover'
              } ${isLiveMode ? '' : 'hidden'}`}
            />
            {isLiveMode ? (
              <>
                {!developerMode && <GridOverlay mode="viewfinder" />}
                {/* Developer debug overlay */}
                {developerMode && debugInfo && (
                  <div className="absolute top-2 left-2 right-2 bg-black/70 rounded-lg p-2 text-xs font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-green-400">DEV MODE</span>
                      <button
                        onClick={() => setShowDebugPanel(!showDebugPanel)}
                        className="text-white/60 hover:text-white px-2"
                      >
                        {showDebugPanel ? '[-]' : '[+]'}
                      </button>
                    </div>
                    <div className="text-white/80">
                      Video: {debugInfo.videoWidth}x{debugInfo.videoHeight}
                    </div>
                    <div className="text-white/80">
                      Screen: {debugInfo.screenWidth}x{debugInfo.screenHeight}
                    </div>
                    {debugInfo.trackSettings && (
                      <div className="text-white/60">
                        Track: {debugInfo.trackSettings.width}x{debugInfo.trackSettings.height}
                        {debugInfo.trackSettings.facingMode && ` (${debugInfo.trackSettings.facingMode})`}
                      </div>
                    )}
                    {/* Debug controls panel */}
                    {showDebugPanel && (
                      <div className="mt-2 pt-2 border-t border-white/20 space-y-2">
                        <div className="text-yellow-400 text-xs">Contraintes:</div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => restartWithConstraints({ width: { ideal: 1080 }, height: { ideal: 1440 } })}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500"
                          >
                            1080x1440
                          </button>
                          <button
                            onClick={() => restartWithConstraints({ width: { ideal: 1440 }, height: { ideal: 1080 } })}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500"
                          >
                            1440x1080
                          </button>
                          <button
                            onClick={() => restartWithConstraints({ width: { ideal: 720 }, height: { ideal: 1280 } })}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500"
                          >
                            720x1280
                          </button>
                          <button
                            onClick={() => restartWithConstraints({ width: { ideal: 1280 }, height: { ideal: 720 } })}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500"
                          >
                            1280x720
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => restartWithConstraints({ aspectRatio: { ideal: 3/4 } })}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-500"
                          >
                            AR 3:4
                          </button>
                          <button
                            onClick={() => restartWithConstraints({ aspectRatio: { ideal: 4/3 } })}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-500"
                          >
                            AR 4:3
                          </button>
                          <button
                            onClick={() => restartWithConstraints({ aspectRatio: { ideal: 9/16 } })}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-500"
                          >
                            AR 9:16
                          </button>
                          <button
                            onClick={() => restartWithConstraints({ aspectRatio: { ideal: 16/9 } })}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-500"
                          >
                            AR 16:9
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => restartWithConstraints({})}
                            className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500"
                          >
                            Defaut
                          </button>
                          <button
                            onClick={() => {
                              const info = getDebugInfo();
                              if (info) setDebugInfo(info);
                            }}
                            className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500"
                          >
                            Refresh Info
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Captured image */}
                <img
                  src={capturedImageUrl}
                  alt="Capture"
                  className="absolute inset-0 w-full h-full object-cover rounded-lg"
                />
                <GridOverlay
                  mode="results"
                  detections={detections}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-dark-lighter">
        {isAnalyzing ? (
          /* Analyzing mode: no controls */
          <div className="h-28" /> /* Spacer to maintain layout */
        ) : isLiveMode ? (
          /* Live mode: capture button */
          <div className="flex flex-col items-center">
            {/* Capture button with outer ring */}
            <div className="w-24 h-24 rounded-full bg-gray-700 p-1.5 flex items-center justify-center">
              <button
                onClick={handleCapture}
                disabled={!isReady}
                className="w-full h-full rounded-full bg-white
                           hover:bg-white/90 active:bg-white/70 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Capturer"
              />
            </div>
          </div>
        ) : (
          /* Results mode: detection info and action buttons */
          <div className="flex flex-col gap-4">
            {/* Detection result */}
            {detectionResult && (
              <p className="text-center text-white/70">{detectionResult}</p>
            )}

            {/* Action buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleRetake}
                className="flex-1 py-3 px-6 bg-dark-card text-white/70 rounded-xl
                           hover:bg-dark hover:text-white transition-colors"
              >
                Reprendre
              </button>
              <button
                onClick={handleValidate}
                disabled={!hasDetectedCards || isValidating}
                className="flex-1 py-3 px-6 bg-gold text-dark font-semibold rounded-xl
                           hover:bg-gold-light active:bg-gold-dark transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidating ? 'Validation...' : 'Valider'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Exit confirmation dialog */}
      {showExitConfirm && (
        <ConfirmDialog
          title="Quitter la partie ?"
          message="La partie en cours sera perdue."
          confirmLabel="Quitter"
          cancelLabel="Continuer"
          onConfirm={confirmExit}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
    </div>
  );
}
