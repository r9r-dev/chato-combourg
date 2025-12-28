import { useEffect, useState, useRef, useCallback } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useGame } from '../context/GameContext';
import { GridOverlay } from '../components/GridOverlay';
import { analyzeImage } from '../services/api';
import type { GameCard, CardResult } from '../types';

const CONFIDENCE_THRESHOLD = 0.75;
const CAPTURE_INTERVAL = 2000; // 2 seconds

export function Camera() {
  const { videoRef, isReady, error, startCamera, stopCamera, captureFrameAsync } =
    useCamera();
  const { setStep, setCards } = useGame();

  const [identifiedCards, setIdentifiedCards] = useState<GameCard[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Initialisation de la caméra...');
  const intervalRef = useRef<number | null>(null);
  const isCapturingRef = useRef(false);

  // Convert API response to GameCard array
  const processResults = useCallback(
    (results: CardResult[]): GameCard[] => {
      return results.map((result) => {
        const position = result.position[0] * 3 + result.position[1];
        const topMatch = result.matches[0];
        return {
          position,
          cardId: topMatch?.id ?? '',
          confidence: topMatch?.probability ?? 0,
          alternatives: result.matches.slice(0, 6),
        };
      });
    },
    []
  );

  // Count cards with high confidence
  const getHighConfidenceCount = useCallback((cards: GameCard[]): number => {
    return cards.filter((c) => c.confidence >= CONFIDENCE_THRESHOLD).length;
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
        const newCards = processResults(response.cards);
        setIdentifiedCards(newCards);

        const highConfCount = getHighConfidenceCount(newCards);
        if (highConfCount === 9) {
          // All cards identified with high confidence
          setStatusMessage('Toutes les cartes identifiées !');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          // Wait a moment then proceed
          setTimeout(() => {
            stopCamera();
            setCards(newCards);
            setStep('summary');
          }, 500);
        } else {
          setStatusMessage(`${highConfCount}/9 cartes identifiées`);
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
    getHighConfidenceCount,
    stopCamera,
    setCards,
    setStep,
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

  // Manual capture and proceed
  const handleManualCapture = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Do one final capture
    await captureAndAnalyze();

    // Proceed with whatever we have
    stopCamera();
    setCards(identifiedCards);
    setStep('summary');
  }, [captureAndAnalyze, stopCamera, setCards, setStep, identifiedCards]);

  // Handle back button
  const handleBack = useCallback(() => {
    stopCamera();
    setStep('landing');
  }, [stopCamera, setStep]);

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
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-dark overflow-hidden">
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
          <GridOverlay identifiedCount={getHighConfidenceCount(identifiedCards)} />

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
            Retour
          </button>
          <button
            onClick={handleManualCapture}
            className="flex-1 py-3 px-6 bg-gold text-dark font-semibold rounded-xl
                       hover:bg-gold-light active:bg-gold-dark transition-colors"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
