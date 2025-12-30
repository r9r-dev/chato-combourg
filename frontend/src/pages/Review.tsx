import { useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { CardGrid } from '../components/CardGrid';
import { CardSelector } from '../components/CardSelector';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { finalizeCapture } from '../services/api';
import type { CardLabel } from '../types';

export function Review() {
  const {
    state,
    setStep,
    updateCard,
    recalculateCurrentPlayerScore,
    saveCurrentPlayerAndNext,
    reset,
    getCurrentPlayer,
  } = useGame();

  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const currentPlayer = getCurrentPlayer();
  const playerIndex = state.currentPlayerIndex + 1;
  const totalPlayers = state.selectedPlayers.length;

  // Calculate score when cards change
  useEffect(() => {
    if (state.cards.length === 9) {
      recalculateCurrentPlayerScore();
    }
  }, [state.cards, state.keys, state.coins, recalculateCurrentPlayerScore]);

  // Handle card click to open selector
  const handleCardClick = useCallback((position: number) => {
    setSelectedPosition(position);
  }, []);

  // Handle card selection from selector
  const handleCardSelect = useCallback(
    (cardId: string) => {
      if (selectedPosition !== null) {
        updateCard(selectedPosition, cardId);
        setSelectedPosition(null);
      }
    },
    [selectedPosition, updateCard]
  );

  // Validate and proceed to next player or summary
  const handleValidate = useCallback(async () => {
    if (isValidating) return;
    setIsValidating(true);

    // Finalize capture for training data
    if (state.captureId) {
      // Check if any cards were corrected
      const hasCorrections = state.originalCards?.some((orig) => {
        const current = state.cards.find(c => c.position === orig.position);
        return current?.cardId !== orig.cardId;
      }) ?? false;

      // Prepare card labels for training
      const originalLabels: CardLabel[] = (state.originalCards ?? []).map(c => ({
        position: c.position,
        card_id: c.cardId,
      }));

      const finalLabels: CardLabel[] = state.cards.map(c => ({
        position: c.position,
        card_id: c.cardId,
      }));

      // Finalize with appropriate status
      finalizeCapture(state.captureId, {
        status: hasCorrections ? 'fixed' : 'success',
        detection_count: state.originalCards?.filter(c => c.cardId).length ?? 0,
        original_cards: originalLabels,
        final_cards: finalLabels,
      });
    }

    const hasMorePlayers = await saveCurrentPlayerAndNext();

    if (hasMorePlayers) {
      setStep('keys');
    } else {
      setStep('summary');
    }

    setIsValidating(false);
  }, [saveCurrentPlayerAndNext, setStep, isValidating, state.captureId, state.cards, state.originalCards]);

  // Get selected card data
  const selectedCard =
    selectedPosition !== null
      ? state.cards.find((c) => c.position === selectedPosition)
      : null;

  // Get score detail for selected card
  const selectedScoreDetail =
    selectedPosition !== null && state.score
      ? state.score.details.find((d) => d.position === selectedPosition)
      : null;

  if (!currentPlayer) {
    return null;
  }

  return (
    <div className="flex flex-col h-dvh bg-dark overflow-hidden">
      {/* Header with player info */}
      <div className="flex items-center justify-between p-4 bg-dark-lighter border-b border-white/10">
        <button
          onClick={() => setShowExitConfirm(true)}
          className="text-white/60 hover:text-white"
        >
          Quitter
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: currentPlayer.color }}
          >
            {playerIndex}
          </div>
          <span className="text-white font-medium">{currentPlayer.name}</span>
          <span className="text-white/40 text-sm">
            ({playerIndex}/{totalPlayers})
          </span>
        </div>
        <div className="w-16" />
      </div>

      {/* Keys and coins display */}
      <div className="flex justify-center gap-8 py-3 bg-dark-lighter border-b border-gold/20">
        <div className="flex items-center gap-2">
          <span className="text-white/60">Clés</span>
          <span className="text-xl font-bold text-gold">{state.keys}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/60">Pièces</span>
          <span className="text-xl font-bold text-gold">{state.coins}</span>
        </div>
      </div>

      {/* Card grid */}
      <div className="flex-1 min-h-0">
        <CardGrid
          cards={state.cards}
          scoreDetails={state.score?.details ?? null}
          onCardClick={handleCardClick}
        />
      </div>

      {/* Score display */}
      <ScoreDisplay
        totalScore={state.score?.total_score ?? null}
        keysBonus={state.score?.keys_bonus ?? 0}
        cardsScore={state.score?.cards_score ?? 0}
      />

      {/* Validate button */}
      <div className="p-3 bg-dark-lighter">
        <button
          onClick={handleValidate}
          disabled={state.cards.length !== 9 || isValidating}
          className="w-full py-4 px-8 bg-gold text-dark font-semibold text-lg rounded-xl
                     hover:bg-gold-light active:bg-gold-dark transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isValidating
            ? 'Validation...'
            : playerIndex < totalPlayers
            ? 'Joueur suivant'
            : 'Voir les résultats'}
        </button>
      </div>

      {/* Card selector modal */}
      {selectedCard && (
        <CardSelector
          position={selectedCard.position}
          currentCardId={selectedCard.cardId}
          alternatives={selectedCard.alternatives}
          scoreDetail={selectedScoreDetail ?? null}
          onSelect={handleCardSelect}
          onClose={() => setSelectedPosition(null)}
        />
      )}

      {/* Exit confirmation dialog */}
      <ConfirmDialog
        isOpen={showExitConfirm}
        title="Quitter la partie ?"
        message="La partie en cours sera perdue."
        confirmLabel="Quitter"
        cancelLabel="Continuer"
        onConfirm={reset}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
}
