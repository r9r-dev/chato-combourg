import { useEffect, useState, useRef, useCallback } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useGame } from '../context/GameContext';
import { GridOverlay } from '../components/GridOverlay';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { analyzeImage } from '../services/api';
import type { GameCard, CardResult, BoundingBox } from '../types';

const CONFIDENCE_THRESHOLD = 0.75;
const CAPTURE_INTERVAL = 2000; // 2 seconds

export function Camera() {
  const { videoRef, isReady, error, startCamera, stopCamera, captureFrameAsync } =
    useCamera();
  const { state, setStep, setCards, reset, getCurrentPlayer } = useGame();

  const [identifiedCards, setIdentifiedCards] = useState<GameCard[]>([]);
  const [detectedBboxes, setDetectedBboxes] = useState<Map<number, BoundingBox>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Initialisation de la caméra...');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const isCapturingRef = useRef(false);

  const currentPlayer = getCurrentPlayer();
  const playerIndex = state.currentPlayerIndex + 1;
  const totalPlayers = state.selectedPlayers.length;

  // Convert API response to GameCard array and extract bboxes
  const processResults = useCallback(
    (results: CardResult[]): { cards: GameCard[]; bboxes: Map<number, BoundingBox> } => {
      const cards: GameCard[] = [];
      const bboxes = new Map<number, BoundingBox>();

      for (const result of results) {
        const position = result.position[0] * 3 + result.position[1];
        const topMatch = result.matches[0];

        cards.push({
          position,
          cardId: topMatch?.id ?? '',
          confidence: topMatch?.probability ?? 0,
          alternatives: result.matches.slice(0, 6),
        });

        if (result.bbox) {
          bboxes.set(position, result.bbox);
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

  // Capture and analyze
  const captureAndAnalyze = useCallback(async () => {
    if (isCapturingRef.current || !isReady) return;
    isCapturingRef.current = true;
    setIsAnalyzing(true);

    try {
      const blob = await captureFrameAsync();
      if (!blob) {
        setStatusMessage('Erreur de capture');
        return;
      }

      setStatusMessage('Analyse en cours...');
      const response = await analyzeImage(blob);

      if (response.success && response.cards.length > 0) {
        const { cards: newCards, bboxes } = processResults(response.cards);
        setIdentifiedCards(newCards);
        setDetectedBboxes(bboxes);

        const highConfPositions = getHighConfidencePositions(newCards);
        if (highConfPositions.size === 9) {
          setStatusMessage('Toutes les cartes identifiées !');
        } else {
          setStatusMessage('Placez les 9 cartes dans le cadre');
        }
      } else {
        setStatusMessage('Aucune carte détectée');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setStatusMessage('Erreur d\'analyse');
    } finally {
      setIsAnalyzing(false);
      isCapturingRef.current = false;
    }
  }, [
    isReady,
    captureFrameAsync,
    processResults,
    getHighConfidencePositions,
  ]);

  // Start camera on mount
  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // Start capture interval when camera is ready
  useEffect(() => {
    if (isReady && !intervalRef.current) {
      setStatusMessage('Placez les 9 cartes dans le cadre');
      // Initial capture
      captureAndAnalyze();
      // Then set interval
      intervalRef.current = window.setInterval(captureAndAnalyze, CAPTURE_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isReady, captureAndAnalyze]);

  // Validate and proceed to review page
  const handleValidate = useCallback(() => {
    if (isValidating) return;
    setIsValidating(true);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Set the cards and go to review
    setCards(identifiedCards);
    stopCamera();
    setStep('review');

    setIsValidating(false);
  }, [identifiedCards, setCards, stopCamera, setStep, isValidating]);

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

          {/* Analyzing indicator */}
          {isAnalyzing && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gold/90 text-dark px-4 py-2 rounded-full">
              <span className="animate-pulse">Analyse...</span>
            </div>
          )}
        </div>
      </div>

      {/* Status and controls */}
      <div className="p-4 bg-dark-lighter">
        <p className="text-center text-white/70 mb-4">{statusMessage}</p>

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
            disabled={identifiedCards.length === 0 || isValidating}
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
