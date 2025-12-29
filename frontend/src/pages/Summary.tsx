import { useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { CardGrid } from '../components/CardGrid';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { CardSelector } from '../components/CardSelector';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function Summary() {
  const {
    state,
    updateCard,
    recalculateScore,
    reset,
  } = useGame();

  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Calculate score on mount and when cards/keys/coins change
  useEffect(() => {
    if (state.cards.length === 9) {
      recalculateScore();
    }
  }, [state.cards, state.keys, state.coins, recalculateScore]);

  // Handle card selection
  const handleCardClick = useCallback((position: number) => {
    setSelectedPosition(position);
  }, []);

  // Handle card change from selector
  const handleCardSelect = useCallback(
    (cardId: string) => {
      if (selectedPosition !== null) {
        updateCard(selectedPosition, cardId);
        setSelectedPosition(null);
      }
    },
    [selectedPosition, updateCard]
  );

  // Get selected card data
  const selectedCard = selectedPosition !== null
    ? state.cards.find((c) => c.position === selectedPosition)
    : null;

  // Get score detail for selected card
  const selectedScoreDetail = selectedPosition !== null && state.score
    ? state.score.details.find((d) => d.position === selectedPosition)
    : null;

  return (
    <div className="flex flex-col h-dvh bg-dark overflow-hidden">
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

      {/* Restart button */}
      <div className="p-3 bg-dark-lighter">
        <button
          onClick={() => setShowExitConfirm(true)}
          className="w-full py-2.5 px-6 bg-dark-card text-white/70 rounded-xl
                     hover:bg-dark hover:text-white transition-colors
                     border border-gold/20 hover:border-gold/50"
        >
          Recommencer
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
      {showExitConfirm && (
        <ConfirmDialog
          title="Quitter la partie ?"
          message="La partie en cours sera perdue."
          confirmLabel="Quitter"
          cancelLabel="Continuer"
          onConfirm={reset}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
    </div>
  );
}
