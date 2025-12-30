import { useEffect, useState, useRef, useCallback } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useGame } from '../context/GameContext';
import { GridOverlay } from '../components/GridOverlay';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { analyzeImage } from '../services/api';
import type { GameCard, CardResult, BoundingBox } from '../types';

const CONFIDENCE_THRESHOLD = 0.75;
const COUNTDOWN_DURATION = 3; // 3 seconds

export function Camera() {
  const { videoRef, isReady, error, startCamera, stopCamera, captureFrameAsync } =
    useCamera();
  const { state, setStep, setCards, reset, getCurrentPlayer } = useGame();

  const [identifiedCards, setIdentifiedCards] = useState<GameCard[]>([]);
  const [detectedBboxes, setDetectedBboxes] = useState<Map<number, BoundingBox>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Countdown and detection tracking
  const [countdown, setCountdown] = useState<number | null>(null);
  const [detectionResult, setDetectionResult] = useState<string | null>(null);
  const [bestDetection, setBestDetection] = useState<{
    cards: GameCard[];
    bboxes: Map<number, BoundingBox>;
    count: number;
  } | null>(null);

  const countdownRef = useRef<number | null>(null);
  const isCapturingRef = useRef(false);

  const currentPlayer = getCurrentPlayer();
  const playerIndex = state.currentPlayerIndex + 1;
  const totalPlayers = state.selectedPlayers.length;

  // Convert API response to GameCard array and extract bboxes
  // Always returns 9 cards (one for each position 0-8)
  const processResults = useCallback(
    (results: CardResult[]): { cards: GameCard[]; bboxes: Map<number, BoundingBox> } => {
      const bboxes = new Map<number, BoundingBox>();
      const detectedCards = new Map<number, GameCard>();

      // Process detected cards
      for (const result of results) {
        const position = result.position[0] * 3 + result.position[1];
        const topMatch = result.matches[0];

        detectedCards.set(position, {
          position,
          cardId: topMatch?.id ?? '',
          confidence: topMatch?.probability ?? 0,
          alternatives: result.matches.slice(0, 6),
        });

        if (result.bbox) {
          bboxes.set(position, result.bbox);
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

      return { cards, bboxes };
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
    if (count === 0) return 'Aucune carte détectée';
    if (count === 1) return '1 carte détectée';
    return `${count} cartes détectées`;
  }, []);

  // Start countdown
  const startCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_DURATION);
  }, []);

  // Capture and analyze
  const captureAndAnalyze = useCallback(async () => {
    if (isCapturingRef.current || !isReady) return;
    isCapturingRef.current = true;
    setIsAnalyzing(true);
    setCountdown(null);

    try {
      const blob = await captureFrameAsync();
      if (!blob) {
        setDetectionResult('Erreur de capture');
        startCountdown();
        return;
      }

      const response = await analyzeImage(blob);

      if (response.success && response.cards.length > 0) {
        const { cards: newCards, bboxes } = processResults(response.cards);
        setIdentifiedCards(newCards);
        setDetectedBboxes(bboxes);

        const highConfPositions = getHighConfidencePositions(newCards);
        const detectedCount = highConfPositions.size;

        // Update detection result message
        setDetectionResult(formatDetectionMessage(detectedCount));

        // Update best detection if this one has more cards
        if (!bestDetection || detectedCount > bestDetection.count) {
          setBestDetection({ cards: newCards, bboxes, count: detectedCount });
        }

        // Auto-validate if all 9 cards detected
        if (detectedCount === 9) {
          return; // Will be handled by auto-validate effect
        }
      } else {
        setDetectionResult('Aucune carte détectée');
      }

      // Start new countdown if not all 9 cards detected
      startCountdown();
    } catch (err) {
      console.error('Analysis error:', err);
      setDetectionResult("Erreur d'analyse");
      startCountdown();
    } finally {
      setIsAnalyzing(false);
      isCapturingRef.current = false;
    }
  }, [
    isReady,
    captureFrameAsync,
    processResults,
    getHighConfidencePositions,
    formatDetectionMessage,
    startCountdown,
    bestDetection,
  ]);

  // Start camera on mount
  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // Start countdown when camera is ready
  useEffect(() => {
    if (isReady && countdown === null && !isAnalyzing && !isValidating) {
      startCountdown();
    }
  }, [isReady, countdown, isAnalyzing, isValidating, startCountdown]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null || isAnalyzing || isValidating) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    if (countdown <= 0) {
      captureAndAnalyze();
      return;
    }

    countdownRef.current = window.setInterval(() => {
      setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [countdown, isAnalyzing, isValidating, captureAndAnalyze]);

  // Validate and proceed to review page
  const handleValidate = useCallback(() => {
    if (isValidating) return;
    setIsValidating(true);

    // Stop countdown
    setCountdown(null);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // Use best detection if available, otherwise use current identified cards
    const cardsToUse = bestDetection?.cards ?? identifiedCards;
    if (bestDetection?.bboxes) {
      setDetectedBboxes(bestDetection.bboxes);
    }

    // Set the cards and go to review
    setCards(cardsToUse);
    stopCamera();
    setStep('review');

    setIsValidating(false);
  }, [identifiedCards, bestDetection, setCards, stopCamera, setStep, isValidating]);

  // Auto-validate when all 9 cards are detected with high confidence
  useEffect(() => {
    const highConfPositions = getHighConfidencePositions(identifiedCards);
    if (highConfPositions.size === 9 && !isValidating) {
      handleValidate();
    }
  }, [identifiedCards, getHighConfidencePositions, isValidating, handleValidate]);

  // Handle back button - show confirmation
  const handleBack = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  // Confirm exit
  const confirmExit = useCallback(() => {
    stopCamera();
    reset();
  }, [stopCamera, reset]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh p-6 text-center overflow-hidden">
        <div className="bg-red-900/50 text-red-200 p-6 rounded-xl mb-6">
          <p className="text-lg font-semibold mb-2">Erreur caméra</p>
          <p>{error}</p>
        </div>
        <button
          onClick={handleBack}
          className="py-3 px-6 bg-dark-lighter text-white rounded-xl hover:bg-dark-card transition-colors"
        >
          Quitter
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-dark overflow-hidden">
      {/* Player indicator */}
      {currentPlayer && (
        <div className="p-3 bg-dark-lighter border-b border-white/10">
          <div className="flex items-center justify-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: currentPlayer.color }}
            >
              {playerIndex}
            </div>
            <span className="text-white font-medium">{currentPlayer.name}</span>
            <span className="text-white/40 text-sm">({playerIndex}/{totalPlayers})</span>
          </div>
        </div>
      )}

      {/* Camera view */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <div className="relative w-full max-w-sm aspect-[3/4]">
          {/* iOS requires playsInline and webkit-playsinline for inline video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            webkit-playsinline="true"
            muted
            className="absolute inset-0 w-full h-full object-cover rounded-lg"
          />
          <GridOverlay
            identifiedPositions={getHighConfidencePositions(identifiedCards)}
            detectedBboxes={detectedBboxes}
          />
        </div>
      </div>

      {/* Status and controls */}
      <div className="p-4 bg-dark-lighter">
        {/* Countdown circle and status */}
        <div className="flex items-center justify-center gap-4 mb-4">
          {/* Countdown circle */}
          {countdown !== null && countdown > 0 && !isAnalyzing && (
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-white/20"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="text-gold transition-all duration-1000 ease-linear"
                  strokeDasharray={`${(countdown / COUNTDOWN_DURATION) * 125.6} 125.6`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-white font-bold">
                {countdown}
              </span>
            </div>
          )}

          {/* Analyzing indicator */}
          {isAnalyzing && (
            <div className="bg-gold/90 text-dark px-4 py-2 rounded-full">
              <span className="animate-pulse">Analyse...</span>
            </div>
          )}

          {/* Detection result */}
          {detectionResult && !isAnalyzing && (
            <p className="text-center text-white/70">{detectionResult}</p>
          )}
        </div>

        {/* Best detection info */}
        {bestDetection && bestDetection.count > 0 && bestDetection.count < 9 && (
          <p className="text-center text-white/50 text-sm mb-3">
            Meilleure détection : {bestDetection.count} carte{bestDetection.count > 1 ? 's' : ''}
          </p>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleBack}
            className="flex-1 py-3 px-6 bg-dark-card text-white/70 rounded-xl
                       hover:bg-dark hover:text-white transition-colors"
          >
            Quitter
          </button>
          <button
            onClick={handleValidate}
            disabled={(!bestDetection || bestDetection.count === 0) && identifiedCards.length === 0 || isValidating}
            className="flex-1 py-3 px-6 bg-gold text-dark font-semibold rounded-xl
                       hover:bg-gold-light active:bg-gold-dark transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidating ? 'Validation...' : 'Valider'}
          </button>
        </div>
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
